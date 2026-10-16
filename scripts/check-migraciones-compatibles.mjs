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
// Para un drop function que solo cambia la firma con un argumento nuevo con
// default, el motivo lo dice. Las anteriores a PRIMERA_REVISADA son historia.
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

/**
 * Sentencias que rompen al deploy anterior, en migraciones que no se declaran
 * como paso de contraer.
 * @param {{ archivo: string, sql: string }[]} migraciones
 * @returns {{ archivo: string, linea: number, que: string, texto: string }[]}
 */
export function hallazgos(migraciones, desde = PRIMERA_REVISADA) {
  const salida = [];
  for (const { archivo, sql } of migraciones) {
    if (numeroDe(archivo) < desde) continue;
    if (MARCA.test(sql)) continue;
    const limpio = soloEsquema(sql);
    const lineas = String(sql).split('\n');
    for (const [re, que] of ROMPEN) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(limpio))) {
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
