#!/usr/bin/env node
// scripts/mapa.mjs
//
// Para una RPC o una tabla: que migraciones la tocan, cual es la definicion
// vigente segun el repo, y que codigo la llama.
//
// ── POR QUE EXISTE ──
// En este repo el camino entre el codigo y la base pasa por strings:
// `.rpc('x')` y `.from('t')`. Ningun analizador de codigo los une con la
// migracion que los define. Se probo graphify el 26/sep: 3923 nodos y cero
// aristas entre `platformKds.js` y `cerrar_ticket_de_cocina`. Hasta ahora eso
// se resolvia con un grep por base, otro por el codigo, y deduciendo a mano
// cual de las definiciones era la ultima.
//
// Se calcula en el momento leyendo los archivos: no hay indice que regenerar
// ni que pueda quedar viejo.
//
// ── LO QUE NO DICE ──
// Que esta DESPLEGADO. La funcion en produccion puede no ser la de la ultima
// migracion (paso con signup_tenant). Por eso el script imprime la consulta
// que la trae; check-functions-drift.mjs compara las criticas.
//
// ── USO ──
//   npm run mapa -- cerrar_ticket_de_cocina
//   npm run mapa -- ticket     # sin match exacto, sugiere nombres parecidos
//   npm run mapa               # resumen: lo que el repo no cierra

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname, sep } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// Se importa desde src/test/mapa.test.js: el CLI corre solo si se lo ejecuta.
const ES_MAIN = process.argv[1]
  && fileURLToPath(import.meta.url) === process.argv[1];

/* Las dos bases tienen migraciones separadas y varias tablas existen en las
   dos con columnas distintas (orders, order_items, coupons, profiles). Mezclar
   los lados es justo el error que hay que evitar, asi que se reportan aparte. */
export const BASES = [
  { lado: 'edificio', dir: 'platform/migrations' },
  { lado: 'legacy', dir: 'supabase/migrations' },
];

// Donde se busca quien llama.
export const CODIGO = [
  'src', 'api', 'middleware.js', 'scripts', 'e2e',
  'platform/functions', 'platform/scripts', 'platform/qa-lite', 'platform/tests',
  'supabase/functions',
];

const EXTENSIONES = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs']);
const IGNORAR_DIRS = new Set(['node_modules', 'dist', 'coverage']);

/* ── SQL ─────────────────────────────────────────────────────────────────── */

/**
 * Borra los comentarios SQL sin mover nada de lugar: cada caracter comentado
 * pasa a espacio y los saltos de linea se conservan, asi los numeros de linea
 * siguen siendo los del archivo.
 */
export function sinComentarios(texto) {
  const blanco = (s) => s.replace(/[^\n]/g, ' ');
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, blanco)
    .replace(/--[^\n]*/g, blanco);
}

function lineador(texto) {
  const saltos = [];
  for (let i = 0; i < texto.length; i++) if (texto[i] === '\n') saltos.push(i);
  return (idx) => {
    let lo = 0, hi = saltos.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (saltos[mid] < idx) lo = mid + 1; else hi = mid;
    }
    return lo + 1;
  };
}

/** Lo que hay entre el `(` en `desde` y su `)`, contando anidados. */
function entreParentesis(texto, desde) {
  let prof = 0;
  for (let i = desde; i < texto.length; i++) {
    if (texto[i] === '(') prof++;
    else if (texto[i] === ')') {
      prof--;
      if (prof === 0) return texto.slice(desde + 1, i);
    }
  }
  return null;
}

function partirComas(s) {
  const partes = [];
  let prof = 0, buf = '';
  for (const ch of s) {
    if (ch === '(') prof++;
    if (ch === ')') prof--;
    if (ch === ',' && prof === 0) { partes.push(buf); buf = ''; } else buf += ch;
  }
  if (buf.trim()) partes.push(buf);
  return partes;
}

const TIPO_MULTIPALABRA = /^(double precision|character varying|bit varying|(timestamp|time)( with(out)? time zone)?)$/;
const ALIAS_TIPO = {
  timestamptz: 'timestamp with time zone',
  timetz: 'time with time zone',
  int: 'integer',
  int4: 'integer',
  int8: 'bigint',
  int2: 'smallint',
  bool: 'boolean',
  varchar: 'character varying',
  float8: 'double precision',
  float4: 'real',
};

/**
 * La firma de una funcion como la identifica Postgres: solo los tipos de los
 * argumentos de entrada. Es lo que decide si `create or replace` pisa a la
 * anterior o crea un overload al lado.
 *
 * `p_tenant_id uuid, p_sector_id uuid default null` -> `uuid, uuid`
 * `uuid, uuid` (como se escribe en un drop)          -> `uuid, uuid`
 */
export function firma(args) {
  if (args == null) return null;
  return partirComas(args)
    .map((p) => p.replace(/\s+(default\s|=)[\s\S]*$/i, '').trim().toLowerCase())
    .filter(Boolean)
    .map((p) => {
      let t = p.split(/\s+/);
      if (t[0] === 'out') return null; // los OUT no son parte de la firma
      if (['in', 'inout', 'variadic'].includes(t[0])) t = t.slice(1);
      const sinTypmod = (s) => s.replace(/\s*\([^)]*\)/g, '');
      if (t.length > 1 && !TIPO_MULTIPALABRA.test(sinTypmod(t.join(' ')).replace(/\[\]$/, ''))) {
        t = t.slice(1); // el primero era el nombre del parametro
      }
      let tipo = sinTypmod(t.join(' ')).replace(/^public\./, '');
      const arr = tipo.endsWith('[]') ? '[]' : '';
      tipo = tipo.replace(/\[\]$/, '');
      return (ALIAS_TIPO[tipo] || tipo) + arr;
    })
    .filter(Boolean)
    .join(', ');
}

const ID = String.raw`(?:"?([a-z_][a-z0-9_]*)"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?`;

const PATRONES = [
  { tipo: 'funcion', accion: 'crea', re: new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?function\s+${ID}\s*\(`, 'gi'), args: 'requeridos' },
  { tipo: 'funcion', accion: 'borra', re: new RegExp(String.raw`\bdrop\s+function\s+(?:if\s+exists\s+)?${ID}\s*(\()?`, 'gi'), args: 'opcionales' },
  { tipo: 'tabla', accion: 'crea', re: new RegExp(String.raw`\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?${ID}`, 'gi') },
  { tipo: 'tabla', accion: 'altera', re: new RegExp(String.raw`\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${ID}`, 'gi') },
  { tipo: 'tabla', accion: 'borra', re: new RegExp(String.raw`\bdrop\s+table\s+(?:if\s+exists\s+)?${ID}`, 'gi') },
  { tipo: 'vista', accion: 'crea', re: new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?${ID}`, 'gi') },
  { tipo: 'vista', accion: 'borra', re: new RegExp(String.raw`\bdrop\s+(?:materialized\s+)?view\s+(?:if\s+exists\s+)?${ID}`, 'gi') },
];

/** Todo lo que una migracion crea, altera o borra, en orden de aparicion. */
export function definicionesEn(texto, archivo) {
  const limpio = sinComentarios(texto);
  const linea = lineador(limpio);
  const eventos = [];
  for (const { tipo, accion, re, args } of PATRONES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(limpio))) {
      const [todo, esquema, nombre] = m;
      let f = null;
      if (args) {
        const abre = m.index + todo.lastIndexOf('(');
        const conParentesis = args === 'requeridos' || m[3] === '(';
        f = conParentesis ? firma(entreParentesis(limpio, abre) ?? '') : null;
      }
      eventos.push({
        tipo, accion, archivo,
        esquema: (esquema || 'public').toLowerCase(),
        nombre: nombre.toLowerCase(),
        firma: f,
        linea: linea(m.index),
        pos: m.index,
      });
    }
  }
  return eventos.sort((a, b) => a.pos - b.pos);
}

/**
 * Las firmas que quedan vivas despues de recorrer los eventos en orden.
 * Mas de una es un riesgo real: una llamada que no las distinga falla en
 * runtime, no al desplegar. Paso con cerrar_ticket_de_cocina hasta la 0075.
 */
export function firmasVivas(eventos) {
  const vivas = new Map();
  for (const ev of eventos) {
    if (ev.tipo !== 'funcion') continue;
    if (ev.accion === 'crea') vivas.set(ev.firma, ev);
    else if (ev.firma == null) vivas.clear(); // drop sin argumentos: la unica que habia
    else vivas.delete(ev.firma);
  }
  return [...vivas.values()];
}

/* ── Codigo ──────────────────────────────────────────────────────────────── */

const RE_RPC = /\.rpc\(\s*['"`]([a-z_][a-z0-9_]*)['"`]/gi;
const RE_REST_RPC = /\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)/gi;
const RE_FROM = /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/gi;

/** Las llamadas a la base de un archivo: `.rpc('x')`, `/rest/v1/rpc/x` y `.from('t')`. */
export function llamadasEn(texto, archivo) {
  const linea = lineador(texto);
  const lineas = texto.split('\n');
  const out = [];
  const esComentario = (n) => /^\s*(\/\/|\*)/.test(lineas[n - 1] || '');

  for (const [re, via] of [[RE_RPC, 'rpc'], [RE_REST_RPC, 'rpc'], [RE_FROM, 'from']]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(texto))) {
      // supabase.storage.from('logos') es un bucket, no una tabla
      if (via === 'from' && /\bstorage\s*$/.test(texto.slice(Math.max(0, m.index - 80), m.index))) continue;
      const n = linea(m.index);
      if (esComentario(n)) continue;
      out.push({ nombre: m[1].toLowerCase(), via, archivo, linea: n });
    }
  }
  return out;
}

/* ── Indice ──────────────────────────────────────────────────────────────── */

function archivosDeCodigo(root, entradas) {
  const out = [];
  const walk = (abs) => {
    if (!existsSync(abs)) return;
    const st = statSync(abs);
    if (st.isFile()) {
      if (EXTENSIONES.has(extname(abs))) out.push(abs);
      return;
    }
    for (const e of readdirSync(abs)) {
      if (e.startsWith('.') || IGNORAR_DIRS.has(e)) continue;
      walk(join(abs, e));
    }
  };
  for (const e of entradas) walk(join(root, e));
  return out;
}

const posix = (p) => p.split(sep).join('/');

/** Tests y e2e: sus mocks llaman nombres que no tienen por que existir. */
export const esTest = (archivo) => /(^|\/)(test|tests|e2e)\/|\.test\./.test(archivo);

/** Lee migraciones y codigo UNA vez y devuelve todo lo necesario para consultar. */
export function indexar({ root = ROOT, bases = BASES, codigo = CODIGO } = {}) {
  const lados = bases.map(({ lado, dir }) => {
    const abs = join(root, dir);
    const migraciones = existsSync(abs)
      ? readdirSync(abs)
        .filter((f) => f.endsWith('.sql'))
        .sort() // 0001..0075 y 000_/2026xxxx_: orden lexicografico == cronologico
        .map((archivo) => ({ archivo, texto: readFileSync(join(abs, archivo), 'utf8') }))
      : [];
    const eventos = migraciones.flatMap(({ archivo, texto }) => definicionesEn(texto, archivo));
    return { lado, dir, migraciones, eventos };
  });

  const llamadas = archivosDeCodigo(root, codigo)
    .filter((abs) => abs !== fileURLToPath(import.meta.url))
    .flatMap((abs) => llamadasEn(readFileSync(abs, 'utf8'), posix(relative(root, abs))));

  return { lados, llamadas };
}

/** Lineas de las migraciones que nombran a `nombre` sin ser una definicion. */
function mencionesEn(lado, nombre) {
  const re = new RegExp(String.raw`\b${nombre}\b`, 'i');
  const propias = new Set(lado.eventos.filter((e) => e.nombre === nombre).map((e) => `${e.archivo}:${e.linea}`));
  const out = [];
  for (const { archivo, texto } of lado.migraciones) {
    sinComentarios(texto).split('\n').forEach((l, i) => {
      if (re.test(l) && !propias.has(`${archivo}:${i + 1}`)) out.push({ archivo, linea: i + 1 });
    });
  }
  return out;
}

export function mapear(indice, consulta) {
  const nombre = String(consulta).toLowerCase().replace(/^.*\./, '');
  const lados = indice.lados.map((lado) => {
    const eventos = lado.eventos.filter((e) => e.nombre === nombre);
    return {
      lado: lado.lado,
      dir: lado.dir,
      eventos,
      vivas: firmasVivas(eventos),
      menciones: eventos.length ? mencionesEn(lado, nombre) : [],
    };
  });
  const llamadas = indice.llamadas.filter((l) => l.nombre === nombre);
  const encontrado = llamadas.length > 0 || lados.some((l) => l.eventos.length > 0);
  return { nombre, lados, llamadas, encontrado };
}

/** Nombres conocidos que contienen la consulta, para cuando no hay match exacto. */
export function sugerencias(indice, consulta, max = 15) {
  const q = String(consulta).toLowerCase();
  const todos = new Set([
    ...indice.lados.flatMap((l) => l.eventos.map((e) => e.nombre)),
    ...indice.llamadas.map((l) => l.nombre),
  ]);
  return [...todos].filter((n) => n.includes(q)).sort().slice(0, max);
}

/**
 * Lo que el repo no cierra solo:
 *  - RPC que el codigo llama y ninguna migracion de ninguna de las dos bases
 *    define: se crearon a mano y el repo no las puede reconstruir
 *  - funciones con mas de una firma viva segun las migraciones
 */
export function resumen(indice) {
  const definidas = new Set(indice.lados.flatMap((l) => l.eventos.filter((e) => e.tipo === 'funcion').map((e) => e.nombre)));
  const rpcs = new Map();
  for (const l of indice.llamadas.filter((x) => x.via === 'rpc' && !esTest(x.archivo))) {
    if (!rpcs.has(l.nombre)) rpcs.set(l.nombre, l);
  }
  const tablas = new Set(indice.llamadas.filter((x) => x.via === 'from').map((x) => x.nombre));
  const huerfanas = [...rpcs.values()].filter((l) => !definidas.has(l.nombre))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const overloads = [];
  for (const lado of indice.lados) {
    const porNombre = new Map();
    for (const e of lado.eventos) {
      if (e.tipo !== 'funcion') continue;
      if (!porNombre.has(e.nombre)) porNombre.set(e.nombre, []);
      porNombre.get(e.nombre).push(e);
    }
    for (const [nombre, evs] of porNombre) {
      const vivas = firmasVivas(evs);
      if (vivas.length > 1) overloads.push({ lado: lado.lado, nombre, vivas });
    }
  }
  return { rpcs: rpcs.size, tablas: tablas.size, huerfanas, overloads };
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const tty = process.stdout.isTTY;
const c = (cod) => (s) => (tty ? `\x1b[${cod}m${s}\x1b[0m` : s);
const negrita = c(1), gris = c(90), amarillo = c(33), verde = c(32);

function compactar(items, max = 8) {
  const porArchivo = new Map();
  for (const { archivo, linea } of items) {
    if (!porArchivo.has(archivo)) porArchivo.set(archivo, []);
    porArchivo.get(archivo).push(linea);
  }
  const partes = [...porArchivo].map(([a, ls]) => `${a}:${ls.join(',')}`);
  const resto = partes.length - max;
  return partes.slice(0, max).join('\n    ') + (resto > 0 ? `\n    (+${resto} archivos mas)` : '');
}

function imprimir(r) {
  const tipos = [...new Set(r.lados.flatMap((l) => l.eventos.map((e) => e.tipo)))];
  console.log(`\n${negrita(r.nombre)}${tipos.length ? gris(` — ${tipos.join(' y ')}`) : ''}\n`);

  for (const lado of r.lados) {
    console.log(`${negrita(lado.lado)} ${gris(`· ${lado.dir}`)}`);
    if (!lado.eventos.length) { console.log(gris('  (nada)\n')); continue; }

    const vigentes = new Set(lado.vivas);
    const cambios = lado.eventos.filter((e) => e.tipo === 'tabla' && e.accion === 'altera');
    for (const e of lado.eventos) {
      if (cambios.includes(e)) continue;
      const f = e.tipo === 'funcion' && e.firma != null ? ` (${e.firma})` : '';
      const marca = vigentes.has(e) ? verde('  <- vigente') : '';
      console.log(`  ${e.accion.padEnd(6)} ${e.archivo}:${e.linea}${f}${marca}`);
    }
    if (cambios.length) {
      console.log(`  altera ${gris(`en ${cambios.length} lugar(es):`)}\n    ${compactar(cambios)}`);
    }
    if (lado.vivas.length > 1) {
      console.log(amarillo(`  ! ${lado.vivas.length} firmas vivas segun el repo: ${lado.vivas.map((v) => `(${v.firma})`).join(' ')}`));
      console.log(amarillo('    una llamada que no las distinga falla en runtime, no al desplegar'));
    }
    if (lado.menciones.length) {
      console.log(`  ${gris('mencionada en:')}\n    ${compactar(lado.menciones)}`);
    }
    console.log('');
  }

  console.log(negrita('llamadas'));
  if (!r.llamadas.length) console.log(gris('  (ninguna en el codigo)'));
  const orden = [...r.llamadas].sort((a, b) => esTest(a.archivo) - esTest(b.archivo) || a.archivo.localeCompare(b.archivo));
  for (const l of orden) {
    const lado = l.archivo.startsWith('supabase/') ? gris(' [legacy]') : '';
    const test = esTest(l.archivo) ? gris(' (test)') : '';
    console.log(`  ${`${l.archivo}:${l.linea}`.padEnd(52)} ${l.via}${lado}${test}`);
  }

  if (r.lados.some((l) => l.eventos.some((e) => e.tipo === 'funcion'))) {
    console.log(`\n${gris('Lo desplegado puede no ser lo de la migracion. Traelo:')}`);
    console.log(`  select pg_get_functiondef(p.oid) from pg_proc p where p.proname = '${r.nombre}';`);
  }
  console.log('');
}

function imprimirResumen(s) {
  console.log(`\nEl codigo llama ${s.rpcs} RPC y ${s.tablas} tablas.\n`);
  console.log(negrita(`RPC que ninguna migracion define (${s.huerfanas.length})`));
  console.log(gris('  se crearon a mano en alguna de las dos bases: el repo no puede reconstruirlas'));
  for (const h of s.huerfanas) console.log(`  ${h.nombre.padEnd(34)} ${gris(`${h.archivo}:${h.linea}`)}`);
  console.log(`\n${negrita(`Funciones con mas de una firma viva (${s.overloads.length})`)}`);
  for (const o of s.overloads) {
    console.log(`  ${o.nombre.padEnd(34)} ${gris(o.lado)} ${o.vivas.map((v) => `(${v.firma})`).join(' ')}`);
  }
  console.log(`\n${gris('Detalle de una: npm run mapa -- <nombre>')}\n`);
}

if (ES_MAIN) {
  const consulta = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const indice = indexar();
  if (!consulta) {
    imprimirResumen(resumen(indice));
  } else {
    const r = mapear(indice, consulta);
    if (r.encontrado) {
      imprimir(r);
    } else {
      const s = sugerencias(indice, r.nombre);
      console.log(`\nNada se llama "${r.nombre}".`);
      if (s.length) console.log(`Parecidos:\n  ${s.join('\n  ')}`);
      console.log('');
      process.exitCode = 1;
    }
  }
}
