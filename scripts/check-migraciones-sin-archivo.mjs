#!/usr/bin/env node
// scripts/check-migraciones-sin-archivo.mjs
//
// Toda migracion aplicada al edificio tiene su archivo en platform/migrations.
//
// ── POR QUE EXISTE ──
// El 16/oct aparecio `alta_de_duenio_con_roles` (aplicada por MCP el 14/oct)
// sin archivo: el repo decia que provision_owner y attach_owner eran la
// version rota, la que escribe `role` cuando la base exige `roles`. Ningun
// check lo veia: la firma no cambio y no estaban entre las criticas del drift
// de cuerpos. Se encontro de casualidad, listando el historial por MCP.
//
// ── QUE COMPARA ──
// Los nombres de supabase_migrations.schema_migrations (via el RPC
// migrations_snapshot, 0097) contra los archivos, sin el numero adelante:
// `idempotencia` y `0040_idempotencia.sql` son la misma. Solo en esa
// direccion: un archivo sin fila en el historial es normal (lo aplicado desde
// el editor SQL del panel no deja fila; la 0062, por ejemplo).
//
// Lo historico que no coincide esta en scripts/migraciones-sin-archivo.json,
// que solo se achica.
//
// ── USO ──
//   node scripts/check-migraciones-sin-archivo.mjs           # falla si hay nuevas
//   node scripts/check-migraciones-sin-archivo.mjs --podar   # saca de la lista las que ya tienen archivo
//
// Sin credenciales o sin el RPC: saltea y devuelve 0, mismo criterio que
// check-functions-drift. El que corre siempre es morning-health.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRACIONES = join(HERE, '..', 'platform', 'migrations');
const LISTA = join(HERE, 'migraciones-sin-archivo.json');

/** `0040_idempotencia.sql` e `idempotencia` → `idempotencia`. */
export const normalizar = (nombre) =>
  String(nombre).toLowerCase().replace(/\.sql$/, '').replace(/^\d+[a-z]?_/, '');

/**
 * @param {{ name: string }[]} historial lo que devuelve migrations_snapshot()
 * @param {string[]} archivos nombres de platform/migrations
 * @param {string[]} conocidas la lista de lo historico
 * @returns {{ nuevas: string[], resueltas: string[] }} nuevas: sin archivo y
 *   fuera de la lista. resueltas: en la lista pero ya con archivo (o ya no
 *   estan en el historial), para podar.
 */
export function sinArchivo(historial, archivos, conocidas) {
  const repo = new Set(archivos.map(normalizar));
  const lista = new Set(conocidas);
  const nombres = historial.map((m) => m.name);
  const huerfanas = new Set(nombres.filter((n) => !repo.has(normalizar(n))));
  return {
    nuevas: [...huerfanas].filter((n) => !lista.has(n)),
    resueltas: conocidas.filter((n) => !huerfanas.has(n)),
  };
}

async function traerHistorial() {
  const url = (process.env.PLATFORM_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { skip: 'sin credenciales' };
  let res;
  try {
    res = await fetch(`${url}/rest/v1/rpc/migrations_snapshot`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch (e) {
    return { skip: `no se pudo conectar (${e.message})` };
  }
  if (res.status === 404) return { skip: 'la base no tiene public.migrations_snapshot() — aplicale la 0097' };
  if (!res.ok) return { skip: `HTTP ${res.status}` };
  return { historial: await res.json() };
}

async function main() {
  const { skip, historial } = await traerHistorial();
  if (skip) {
    console.log(`· migraciones sin archivo: salteado (${skip})`);
    return 0;
  }
  const datos = JSON.parse(readFileSync(LISTA, 'utf8'));
  const archivos = readdirSync(MIGRACIONES).filter((f) => f.endsWith('.sql'));
  const { nuevas, resueltas } = sinArchivo(historial, archivos, datos.conocidas);

  if (resueltas.length && process.argv.includes('--podar')) {
    datos.conocidas = datos.conocidas.filter((n) => !resueltas.includes(n));
    writeFileSync(LISTA, `${JSON.stringify(datos, null, 2)}\n`);
    console.log(`  podadas ${resueltas.length}: ${resueltas.join(', ')}`);
  } else if (resueltas.length) {
    console.log(`  ${resueltas.length} de la lista ya tienen archivo: correr con --podar`);
  }

  if (nuevas.length) {
    console.log(`✗ ${nuevas.length} migracion(es) aplicada(s) al edificio sin archivo en platform/migrations:`);
    for (const n of nuevas) console.log(`    ${n}`);
    console.log('');
    console.log('  El repo dice que corre otra cosa. Traer el SQL y escribir el archivo:');
    console.log("    select statements from supabase_migrations.schema_migrations where name = '<nombre>';");
    return 1;
  }
  console.log(`✓ ${historial.length} migraciones aplicadas, ninguna nueva sin archivo (${datos.conocidas.length} historicas en la lista)`);
  return 0;
}

const ES_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (ES_MAIN) {
  // process.exitCode y no process.exit(): mismo motivo que check-functions-drift
  // (assertion de libuv en Windows al cortar justo despues de un fetch).
  const { cargarEnvDeArchivo } = await import('../platform/scripts/_env.mjs');
  cargarEnvDeArchivo();
  process.exitCode = await main();
}
