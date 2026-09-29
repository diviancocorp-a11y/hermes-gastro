#!/usr/bin/env node
// scripts/check-edificio-alcanzable.mjs
//
// Todo lo que el build del edificio puede ejecutar tiene que hablarle a algo
// que el edificio tiene. Recorre los imports desde src/main.jsx (estaticos y
// dinamicos, con los alias de vite) y cruza cada `.from('t')` y `.rpc('f')`
// alcanzable contra lo que definen las migraciones de platform/migrations.
//
// ── POR QUE EXISTE ──
// El 28/sep el catalogo del edificio tiraba en cada visita un ERROR en
// Postgres (settings sin sesion -> 42501 de private.tiene_rol) y ocho 404
// contra tablas del modelo single-tenant: feature_flags, theme_config,
// category_groups... Todo caia en un fallback y la pantalla se veia bien, asi
// que ningun test, build ni smoke lo vio. check-supabase-columns no lo agarra
// porque clasifica archivos a mano (PLATFORM_PATHS) y esos estaban del lado
// legacy. Aca no se clasifica nada: si el edificio lo puede cargar, cuenta.
//
// ── LO PENDIENTE ──
// scripts/llamadas-legacy-pendientes.json lista lo que ya estaba roto cuando
// nacio el check. Solo puede achicarse: una llamada nueva que no este ahi
// falla, y una que ya no existe tambien (hay que sacarla, para que la lista
// sea siempre la verdad). La salida para una entrada es borrar el codigo
// legacy o crear el objeto en el edificio, nunca agrandar la lista.
//
// ── LO QUE NO DICE ──
// Si lo DESPLEGADO coincide con la migracion (eso es check-functions-drift),
// ni si una rama es inalcanzable en runtime: el analisis es por archivo. Una
// rama `if (!business.platform)` cuenta igual, y esta bien que cuente: el
// edificio es la unica verdad, lo que no corre en el se borra.
//
// Uso: npm run check:alcanzable
//      npm run check:alcanzable -- --podar   saca de la lista lo ya resuelto

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { indexar, llamadasEn, firmasVivas } from './mapa.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..');
export const PENDIENTES = 'scripts/llamadas-legacy-pendientes.json';

const ENTRADA = 'src/main.jsx';
// Los mismos que resolve.alias de vite.config.js para CLIENT=edificio.
const ALIAS = {
  '@business': 'clients/edificio/business.js',
  '@dico/core': 'src',
};
const EXTENSIONES = ['', '.js', '.jsx', '.mjs', '.ts', '.tsx', '/index.js', '/index.jsx'];
const ES_CODIGO = /\.(m?jsx?|tsx?)$/;
const RE_IMPORT = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

const posix = (p) => p.split(sep).join('/');

function resolver(root, desde, spec) {
  let base;
  if (spec.startsWith('.')) {
    base = join(dirname(desde), spec);
  } else {
    const alias = Object.keys(ALIAS).find((a) => spec === a || spec.startsWith(`${a}/`));
    if (!alias) return null; // paquete de node_modules
    base = join(root, ALIAS[alias] + spec.slice(alias.length));
  }
  for (const ext of EXTENSIONES) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

/** Modulos alcanzables desde la entrada: Map<ruta absoluta, quien lo importo>. */
export function grafo(root = ROOT, entrada = ENTRADA) {
  const padres = new Map();
  const cola = [[join(root, entrada), null]];
  while (cola.length) {
    const [archivo, padre] = cola.pop();
    if (padres.has(archivo)) continue;
    padres.set(archivo, padre);
    if (!ES_CODIGO.test(archivo)) continue;
    const texto = readFileSync(archivo, 'utf8');
    RE_IMPORT.lastIndex = 0;
    let m;
    while ((m = RE_IMPORT.exec(texto))) {
      const destino = resolver(root, archivo, m[1] || m[2] || m[3]);
      if (destino && !padres.has(destino)) cola.push([destino, archivo]);
    }
  }
  return padres;
}

/** Tablas, vistas y funciones de public que las migraciones del edificio dejan vivas. */
export function objetosDelEdificio(root = ROOT) {
  const { lados } = indexar({ root, codigo: [] });
  const eventos = lados.find((l) => l.lado === 'edificio').eventos.filter((e) => e.esquema === 'public');
  const vivos = new Set();
  const funciones = new Map();
  for (const ev of eventos) {
    if (ev.tipo === 'funcion') {
      if (!funciones.has(ev.nombre)) funciones.set(ev.nombre, []);
      funciones.get(ev.nombre).push(ev);
    } else if (ev.accion === 'crea') {
      vivos.add(`from:${ev.nombre}`);
    } else if (ev.accion === 'borra') {
      vivos.delete(`from:${ev.nombre}`);
    }
  }
  for (const [nombre, evs] of funciones) {
    if (firmasVivas(evs).length) vivos.add(`rpc:${nombre}`);
  }
  return vivos;
}

/** { 'src/x.js': ['from:t', 'rpc:f'] } con lo alcanzable que el edificio no tiene. */
export function llamadasHuerfanas({ root = ROOT, padres = grafo(root), vivos = objetosDelEdificio(root) } = {}) {
  const out = {};
  for (const abs of padres.keys()) {
    if (!ES_CODIGO.test(abs)) continue;
    const archivo = posix(relative(root, abs));
    for (const c of llamadasEn(readFileSync(abs, 'utf8'), archivo)) {
      const clave = `${c.via}:${c.nombre}`;
      if (vivos.has(clave)) continue;
      (out[archivo] ||= new Set()).add(clave);
    }
  }
  return Object.fromEntries(
    Object.keys(out).sort().map((a) => [a, [...out[a]].sort()]),
  );
}

/** Diferencias entre lo encontrado y la lista de pendientes. */
export function comparar(encontradas, pendientes) {
  const nuevas = [];
  const resueltas = [];
  const archivos = new Set([...Object.keys(encontradas), ...Object.keys(pendientes)]);
  for (const archivo of [...archivos].sort()) {
    const hoy = new Set(encontradas[archivo] || []);
    const antes = new Set(pendientes[archivo] || []);
    for (const c of hoy) if (!antes.has(c)) nuevas.push({ archivo, llamada: c });
    for (const c of antes) if (!hoy.has(c)) resueltas.push({ archivo, llamada: c });
  }
  return { nuevas, resueltas };
}

/** La lista de pendientes sin las entradas ya resueltas (nunca agrega). */
export function podar(pendientes, resueltas) {
  const out = {};
  for (const [archivo, llamadas] of Object.entries(pendientes)) {
    const quedan = llamadas.filter((c) => !resueltas.some((r) => r.archivo === archivo && r.llamada === c));
    if (quedan.length) out[archivo] = quedan;
  }
  return out;
}

function cadena(padres, root, archivo) {
  const pasos = [];
  for (let x = join(root, archivo); x; x = padres.get(x)) pasos.push(posix(relative(root, x)));
  return pasos.reverse().join(' > ');
}

const ES_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const PODAR = process.argv.includes('--podar');

if (ES_MAIN) {
  const padres = grafo();
  const encontradas = llamadasHuerfanas({ padres });
  const { pendientes } = JSON.parse(readFileSync(join(ROOT, PENDIENTES), 'utf8'));
  const { nuevas, resueltas } = comparar(encontradas, pendientes);
  const total = Object.values(encontradas).reduce((n, l) => n + l.length, 0);

  if (nuevas.length) {
    console.error(`\n✗ ${nuevas.length} llamada(s) nuevas a algo que el edificio no tiene:\n`);
    for (const { archivo, llamada } of nuevas) {
      console.error(`  ${llamada}  en ${archivo}`);
      console.error(`    se llega por: ${cadena(padres, ROOT, archivo)}`);
    }
    console.error('\n  O el objeto se crea en platform/migrations, o el codigo legacy se borra.');
    console.error(`  No se agrega a ${PENDIENTES}: esa lista solo se achica.\n`);
  }
  if (resueltas.length && PODAR && !nuevas.length) {
    const doc = JSON.parse(readFileSync(join(ROOT, PENDIENTES), 'utf8'));
    doc.pendientes = podar(doc.pendientes, resueltas);
    writeFileSync(join(ROOT, PENDIENTES), `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`✓ ${resueltas.length} entrada(s) resuelta(s) fuera de ${PENDIENTES}:`);
    for (const { archivo, llamada } of resueltas) console.log(`  ${llamada}  en ${archivo}`);
  } else if (resueltas.length) {
    console.error(`\n✗ ${resueltas.length} entrada(s) de ${PENDIENTES} que ya no pasan. Sacalas:\n`);
    for (const { archivo, llamada } of resueltas) console.error(`  ${llamada}  en ${archivo}`);
    console.error('\n  npm run check:alcanzable -- --podar las saca (y nunca agrega nuevas).\n');
  }
  if (nuevas.length || (resueltas.length && !PODAR)) process.exit(1);
  console.log(`✓ ${padres.size} modulos alcanzables desde ${ENTRADA}; ${total} llamada(s) legacy pendientes, ninguna nueva.`);
}
