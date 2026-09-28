#!/usr/bin/env node
// scripts/check-definer-aprobadas.mjs  ·  npm run check:definer
//
// Toda funcion SECURITY DEFINER de `public` que el front puede ejecutar tiene
// que estar en DEFINER_APROBADAS (scripts/check-rls.mjs), con su motivo.
//
// ── POR QUE EXISTE ──
// check-rls mira la base DESPLEGADA y corre en morning-health: se entera al
// dia siguiente. El 27/sep se aplicaron 0065-0070, que estaban en el repo,
// con 11 definer que nadie habia aprobado; el reporte del 28 dio "RLS
// ABIERTO". Este chequeo lee los ARCHIVOS de platform/migrations/, asi que
// frena lo mismo en el commit o en el PR, sin credenciales.
//
// ── COMO DECIDE QUE UNA FUNCION ES LLAMABLE ──
// Recorre las migraciones en orden y se queda con el estado final de cada
// firma (nombre + cantidad de argumentos):
//   - `create [or replace] function public.X(...) ... security definer`
//   - `drop function public.X(...)` la saca
//   - `alter function public.X(...) set schema otro` la saca de public
//   - `revoke ... on function public.X(...) from public, anon, authenticated`
//     (las tres, en una o varias sentencias) la deja fuera del front: sin
//     `public`, anon y authenticated la heredan igual (0076).
// Las `returns trigger` no se cuentan: PostgREST no las expone.
//
// ── LIMITES ──
// Un revoke armado con `execute format(...)` dentro de un DO no se ve: esa
// funcion cuenta como llamable. Hoy da exacto contra produccion (41 nombres,
// 28/sep); si un dia no da, la verdad es check-rls contra la base.
//
// Uso:
//   node scripts/check-definer-aprobadas.mjs            # todas las migraciones
//   node scripts/check-definer-aprobadas.mjs --lista    # imprime las llamables

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFINER_APROBADAS } from './check-rls.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRACIONES = join(REPO, 'platform', 'migrations');

function sinComentarios(sql) {
  return String(sql || '')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Cantidad de argumentos de la lista que arranca en `sql[desde]` (el `(`). */
function contarArgumentos(sql, desde) {
  let nivel = 0;
  let actual = '';
  let cantidad = 0;
  for (let i = desde; i < sql.length; i++) {
    const c = sql[i];
    if (c === '(') {
      nivel++;
      if (nivel === 1) continue;
    } else if (c === ')') {
      nivel--;
      if (nivel === 0) {
        if (actual.trim()) cantidad++;
        return cantidad;
      }
    } else if (c === ',' && nivel === 1) {
      if (actual.trim()) cantidad++;
      actual = '';
      continue;
    }
    actual += c;
  }
  return cantidad;
}

const NOMBRE = String.raw`(?:"?(\w+)"?\.)?"?(\w+)"?\s*(?=\()`;

/**
 * Estado final de las funciones de `public`, leyendo las migraciones en orden.
 * @param {{ archivo: string, sql: string }[]} migraciones ya ordenadas
 * @returns {Map<string, { nombre: string, definer: boolean, trigger: boolean, archivo: string, revocado: Set<string> }>}
 */
export function estadoDeFunciones(migraciones) {
  const firmas = new Map();
  const clave = (nombre, n) => `${nombre}/${n}`;
  const dePublic = (schema) => !schema || schema.toLowerCase() === 'public';

  for (const { archivo, sql: crudo } of migraciones) {
    const sql = sinComentarios(crudo);
    // Las sentencias se aplican en el orden del archivo: se juntan todas y se
    // recorren por posicion.
    const eventos = [];
    const buscar = (re, tipo) => {
      let m;
      while ((m = re.exec(sql))) eventos.push({ tipo, m, pos: m.index });
    };
    buscar(new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+` + NOMBRE, 'gi'), 'create');
    buscar(new RegExp(String.raw`drop\s+function\s+(?:if\s+exists\s+)?` + NOMBRE, 'gi'), 'drop');
    buscar(new RegExp(String.raw`alter\s+function\s+` + NOMBRE, 'gi'), 'alter');
    buscar(new RegExp(String.raw`revoke\s+(?:all|execute)(?:\s+privileges)?\s+on\s+function\s+` + NOMBRE, 'gi'), 'revoke');
    eventos.sort((a, b) => a.pos - b.pos);

    for (const { tipo, m, pos } of eventos) {
      const [, schema, nombreCrudo] = m;
      if (!dePublic(schema)) continue;
      const nombre = nombreCrudo.toLowerCase();
      const parentesis = sql.indexOf('(', pos + m[0].length - 1);
      const k = clave(nombre, contarArgumentos(sql, parentesis));
      const resto = sql.slice(pos);
      const fin = resto.indexOf(';');
      const sentencia = fin < 0 ? resto : resto.slice(0, fin);

      if (tipo === 'create') {
        const cuerpo = resto.search(/\bas\s+\$\w*\$|\$\$/i);
        const cabecera = resto.slice(0, cuerpo < 0 ? 2000 : cuerpo);
        firmas.set(k, {
          nombre,
          definer: /security\s+definer/i.test(cabecera),
          trigger: /returns\s+trigger\b/i.test(cabecera),
          archivo,
          revocado: new Set(),
        });
      } else if (tipo === 'drop') {
        firmas.delete(k);
      } else if (tipo === 'alter') {
        const otro = sentencia.match(/set\s+schema\s+"?(\w+)"?/i);
        if (otro && !dePublic(otro[1])) firmas.delete(k);
      } else if (tipo === 'revoke') {
        const f = firmas.get(k);
        const de = sentencia.match(/\bfrom\s+([\s\S]+)$/i);
        if (f && de) {
          for (const rol of de[1].split(',')) f.revocado.add(rol.trim().replace(/"/g, '').toLowerCase());
        }
      }
    }
  }
  return firmas;
}

/** Nombres de las definer de `public` que el front puede ejecutar. */
export function definerLlamables(firmas) {
  const nombres = new Set();
  for (const f of firmas.values()) {
    if (!f.definer || f.trigger) continue;
    const cerrada = ['public', 'anon', 'authenticated'].every((r) => f.revocado.has(r));
    if (!cerrada) nombres.add(f.nombre);
  }
  return [...nombres].sort();
}

/** Las llamables que no estan aprobadas, con el archivo que las define. */
export function sinAprobar(firmas, aprobadas = DEFINER_APROBADAS) {
  const donde = new Map();
  for (const f of firmas.values()) donde.set(f.nombre, f.archivo);
  return definerLlamables(firmas)
    .filter((n) => !Object.hasOwn(aprobadas, n))
    .map((n) => ({ nombre: n, archivo: donde.get(n) }));
}

function leerMigraciones(dir = MIGRACIONES) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((archivo) => ({ archivo, sql: readFileSync(join(dir, archivo), 'utf8') }));
}

const ES_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (ES_MAIN) {
  const firmas = estadoDeFunciones(leerMigraciones());
  if (process.argv.includes('--lista')) {
    for (const n of definerLlamables(firmas)) console.log(n);
  } else {
    const faltan = sinAprobar(firmas);
    if (faltan.length === 0) {
      console.log(`✓ ${definerLlamables(firmas).length} definer llamables desde el front, todas aprobadas`);
    } else {
      console.error(`✗ ${faltan.length} funcion(es) SECURITY DEFINER que el front puede ejecutar sin aprobar:`);
      for (const f of faltan) console.error(`    ${f.nombre}  (${f.archivo})`);
      console.error('');
      console.error('  Cada una tiene que validar adentro a quien atiende. Dos salidas:');
      console.error('    - si se cuida sola: sumarla a DEFINER_APROBADAS en scripts/check-rls.mjs con el motivo');
      console.error('    - si no la llama el front: `revoke execute on function public.X(...) from public, anon, authenticated;`');
      process.exitCode = 1;
    }
  }
}
