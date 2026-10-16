#!/usr/bin/env node
// scripts/check-migraciones-compatibles.mjs  ·  npm run check:expandir
//
// Una migracion nueva no puede romper al codigo que esta en produccion.
// Regla "expandir y despues contraer" de CLAUDE.md.
//
// ── POR QUE EXISTE ──
// La base es UNA y la comparten todos los deploys de Vercel. La migracion se
// aplica antes del push a main, asi que el deploy anterior corre contra ella
// un rato; despues de un Instant Rollback, todo el tiempo que dure. Ademas hay
// clientes con el chunk viejo en cache (HERMES-GASTRO-G). Borrar o renombrar
// algo que ese codigo usa lo rompe, y el rollback no lo arregla.
//
// ── QUE MIRA ──
// Sentencias que rompen al codigo anterior: drop column/table/view/type/
// function, rename, set not null y cambio de tipo de columna. Lee los
// ARCHIVOS de platform/migrations/, sin credenciales.
//
// ── COMO SE APRUEBA ──
// Si la migracion es el paso de contraer (lo viejo ya no lo usa ningun deploy
// que pueda volver), el archivo lleva un comentario:
//   -- contraer: <por que ya no lo usa nadie>
// Un drop function que solo suma argumentos con
// default no hace falta: lo reconoce solo (ver FIRMA COMPATIBLE). Las
// anteriores a PRIMERA_REVISADA son historia.
//
// ── LIMITES ──
// No entra en los cuerpos de funciones ($$ ... $$): ahi un drop es de tablas
// temporales, no del esquema. Los bloques `do $$ ... $$` si se leen. Un
// `execute format(...)` que arma el drop en un string no se ve.
//
// Uso:
//   node scripts/check-migraciones-compatibles.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRACIONES = join(REPO, 'platform', 'migrations');

// 0001-0095 son anteriores a la regla (16/oct/2026).
export const PRIMERA_REVISADA = 96;

const ROMPEN = [
  [/\bdrop\s+column\b/gi, 'borra una columna'],
  [/\bdrop\s+table\b/gi, 'borra una tabla'],
  [/\bdrop\s+(?:materialized\s+)?view\b/gi, 'borra una vista'],
  [/\bdrop\s+type\b/gi, 'borra un tipo'],
  [/\bdrop\s+function\b/gi, 'borra una funcion o le cambia la firma'],
  [/\balter\s+(?:table|view|function|type)\b[^;]*?\brename\b/gi, 'renombra'],
  [/\bset\s+not\s+null\b/gi, 'vuelve NOT NULL una columna'],
  [/\balter\s+column\s+"?\w+"?\s+(?:set\s+data\s+)?type\b/gi, 'cambia el tipo de una columna'],
];

// El motivo va en la misma linea: `\s` cruzaria el salto y aprobaria una marca vacia.
const MARCA = /^[ \t]*--[ \t]*contraer:[ \t]*\S/im;

const enBlanco = (s) => s.replace(/[^\n]/g, ' ');

/** SQL sin comentarios ni cuerpos de funcion, con los saltos de linea en su lugar. */
function soloEsquema(sql) {
  return String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//g, enBlanco)
    .replace(/--[^\n]*/g, enBlanco)
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, (cuerpo, _tag, pos, todo) =>
      (/\bdo\s*$/i.test(todo.slice(0, pos)) ? cuerpo : enBlanco(cuerpo)));
}

export function numeroDe(archivo) {
  const m = String(archivo).match(/^(\d+)/);
  return m ? Number(m[1]) : Infinity;
}

// ── FIRMA COMPATIBLE ──
// `drop function f(viejos)` + `create function f(nuevos)` en la misma migracion
// pasa sin marca si la llamada vieja sigue andando: cada argumento viejo esta
// con el mismo nombre y tipo (PostgREST llama por nombre), los nuevos tienen
// default y el `returns` no cambia. La firma vieja sale de las migraciones
// anteriores; si no se encuentra, cuenta como que rompe.

const ALIAS = {
  int: 'integer', int4: 'integer', int8: 'bigint', bool: 'boolean',
  varchar: 'character varying', timestamptz: 'timestamp with time zone',
};
const tipo = (s) => {
  const t = s.toLowerCase().replace(/"/g, '').replace(/\bpublic\./g, '').replace(/\s+/g, ' ').trim();
  return ALIAS[t] ?? t;
};

/** Texto entre el `(` de `desde` y su `)`, cortado por las comas de primer nivel. */
function argumentos(sql, desde) {
  const items = [];
  let nivel = 0;
  let actual = '';
  for (let i = desde; i < sql.length; i++) {
    const c = sql[i];
    if (c === '(' && nivel++ === 0) continue;
    if (c === ')' && --nivel === 0) {
      if (actual.trim()) items.push(actual.trim());
      return { items, fin: i + 1 };
    }
    if (c === ',' && nivel === 1) { items.push(actual.trim()); actual = ''; continue; }
    actual += c;
  }
  return { items, fin: sql.length };
}

const FUNCION = String.raw`function\s+(?:if\s+exists\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(`;
const RETURNS = /^\s*returns\s+([\s\S]*?)\s*(?=\b(?:language|as|security|set|stable|immutable|volatile|strict|called|parallel|cost|rows)\b)/i;

/** create/drop de funciones del archivo, en orden. */
function eventosDeFunciones(limpio) {
  const eventos = [];
  for (const [re, tipoEv] of [
    [new RegExp(String.raw`create\s+(?:or\s+replace\s+)?` + FUNCION, 'gi'), 'create'],
    [new RegExp(String.raw`drop\s+` + FUNCION, 'gi'), 'drop'],
  ]) {
    let m;
    while ((m = re.exec(limpio))) {
      const { items, fin } = argumentos(limpio, m.index + m[0].length - 1);
      const nombre = `${(m[1] || 'public').toLowerCase()}.${m[2].toLowerCase()}`;
      const ev = { tipo: tipoEv, pos: m.index, nombre };
      if (tipoEv === 'drop') {
        ev.clave = `${nombre}(${items.map(tipo).join(',')})`;
      } else {
        ev.args = items.map((a) => {
          const conDefault = /\s(?:default|=)\s/i.test(` ${a} `);
          const [, n, ty] = a.replace(/\s(?:default|=)\s[\s\S]*$/i, '').match(/^(?:in\s+)?"?(\w+)"?\s+([\s\S]+)$/i) || [];
          return { nombre: n?.toLowerCase(), tipo: ty ? tipo(ty) : null, conDefault };
        });
        ev.clave = `${nombre}(${ev.args.map((a) => a.tipo).join(',')})`;
        ev.returns = tipo((limpio.slice(fin).match(RETURNS) || [])[1] || '');
      }
      eventos.push(ev);
    }
  }
  return eventos.sort((a, b) => a.pos - b.pos);
}

function firmaCompatible(vieja, nueva) {
  if (!vieja || !nueva || vieja.returns !== nueva.returns) return false;
  if (vieja.args.some((a) => !a.nombre || !a.tipo)) return false;
  const nuevos = new Map(nueva.args.map((a) => [a.nombre, a]));
  if (!vieja.args.every((a) => nuevos.get(a.nombre)?.tipo === a.tipo)) return false;
  const viejos = new Set(vieja.args.map((a) => a.nombre));
  return nueva.args.every((a) => viejos.has(a.nombre) || a.conDefault);
}

/**
 * Sentencias que rompen al deploy anterior, en migraciones que no se declaran
 * como paso de contraer.
 * @param {{ archivo: string, sql: string }[]} migraciones en orden: las
 *   anteriores a `desde` no se reportan pero dan las firmas viejas
 * @returns {{ archivo: string, linea: number, que: string, texto: string }[]}
 */
export function hallazgos(migraciones, desde = PRIMERA_REVISADA) {
  const salida = [];
  const firmas = new Map();
  for (const { archivo, sql } of migraciones) {
    const limpio = soloEsquema(sql);
    const revisar = numeroDe(archivo) >= desde && !MARCA.test(sql);
    const dropsCompatibles = new Set();
    const eventos = eventosDeFunciones(limpio);
    eventos.forEach((ev) => {
      if (ev.tipo === 'create') { firmas.set(ev.clave, ev); return; }
      // La nueva puede crearse antes o despues del drop, en el mismo archivo.
      const nueva = eventos.find((e) => e.tipo === 'create' && e.nombre === ev.nombre && e.clave !== ev.clave);
      if (firmaCompatible(firmas.get(ev.clave), nueva)) dropsCompatibles.add(ev.pos);
      firmas.delete(ev.clave);
    });
    if (!revisar) continue;
    const lineas = String(sql).split('\n');
    for (const [re, que] of ROMPEN) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(limpio))) {
        if (dropsCompatibles.has(m.index)) continue;
        const linea = limpio.slice(0, m.index).split('\n').length;
        salida.push({ archivo, linea, que, texto: lineas[linea - 1].trim() });
      }
    }
  }
  return salida.sort((a, b) => a.archivo.localeCompare(b.archivo) || a.linea - b.linea);
}

function leerMigraciones(dir = MIGRACIONES) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((archivo) => ({ archivo, sql: readFileSync(join(dir, archivo), 'utf8') }));
}

const ES_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (ES_MAIN) {
  const migraciones = leerMigraciones();
  const malos = hallazgos(migraciones);
  const revisadas = migraciones.filter((m) => numeroDe(m.archivo) >= PRIMERA_REVISADA).length;
  if (malos.length === 0) {
    console.log(`✓ ${revisadas} migracion(es) desde la ${String(PRIMERA_REVISADA).padStart(4, '0')}, ninguna rompe al deploy anterior`);
  } else {
    console.error(`✗ ${malos.length} sentencia(s) que rompen al codigo que esta en produccion:`);
    for (const h of malos) console.error(`    ${h.archivo}:${h.linea}  ${h.que}  →  ${h.texto}`);
    console.error('');
    console.error('  La base es una sola: el deploy anterior (y un rollback) corre contra esta migracion.');
    console.error('  Dos salidas (CLAUDE.md, "Migraciones: expandir y despues contraer"):');
    console.error('    - expandir: agregar lo nuevo sin borrar lo viejo; el codigo lee los dos');
    console.error('    - si ya es el paso de contraer: sumar al archivo `-- contraer: <por que ya no lo usa nadie>`');
    process.exitCode = 1;
  }
}
