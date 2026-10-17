#!/usr/bin/env node
// scripts/carga/correr.mjs — corre un escenario de k6 contra el edificio.
//
//   npm run carga:catalogo
//   npm run carga:catalogo -- --vus=50 --meseta=5m
//
// Lee VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (la key publicable, la misma
// que viaja en el bundle) del .env del edificio, igual que vite.config.js.
// El resumen JSON queda en el temp del sistema y la ruta se imprime al final.
// Sale con el codigo de k6: distinto de 0 si se paso de algun umbral.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const escenario = process.argv[2] || 'catalogo';
const flags = Object.fromEntries(process.argv.slice(3)
  .filter((a) => a.startsWith('--'))
  .map((a) => { const [k, v = '1'] = a.slice(2).split('='); return [k, v]; }));

function leerEnv() {
  // `.env.hermes-cochi` es el nombre viejo del de edificio (ver vite.config.js).
  const archivo = ['.env.edificio', '.env.hermes-cochi']
    .map((f) => path.join(RAIZ, f)).find((f) => existsSync(f));
  const env = {};
  if (!archivo) return env;
  for (const linea of readFileSync(archivo, 'utf-8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function buscarK6() {
  // K6_BIN: un k6 portable (el zip del release), sin instalar como admin.
  if (process.env.K6_BIN && existsSync(process.env.K6_BIN)) return process.env.K6_BIN;
  const enPath = spawnSync('k6', ['version'], { stdio: 'ignore', shell: false });
  if (enPath.status === 0) return 'k6';
  const windows = 'C:\\Program Files\\k6\\k6.exe';
  if (existsSync(windows)) return windows;
  return null;
}

const env = leerEnv();
const url = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Falta la URL o la key publicable del edificio (.env.edificio o .env.hermes-cochi).');
  process.exit(2);
}
if (!url.includes('wwwzdgprsooyjgkuyoav')) {
  console.error(`La URL no es la del edificio (${url}). Corto para no cargar otra base.`);
  process.exit(2);
}

const k6 = buscarK6();
if (!k6) {
  console.error('No encuentro k6. Instalarlo con: winget install k6 --source winget');
  process.exit(2);
}

const script = path.join(RAIZ, 'scripts', 'carga', `${escenario}.js`);
if (!existsSync(script)) {
  console.error(`No existe el escenario ${escenario} (${script}).`);
  process.exit(2);
}

const resumen = path.join(tmpdir(), `k6-${escenario}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const r = spawnSync(k6, ['run', '--summary-export', resumen, script], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SUPABASE_URL: url,
    SUPABASE_KEY: key,
    ...(flags.vus && { CARGA_VUS: flags.vus }),
    ...(flags.meseta && { CARGA_MESETA: flags.meseta }),
    ...(flags.tenants && { CARGA_TENANTS: flags.tenants }),
    ...(flags.imagenes && { CARGA_IMAGENES: '1' }),
    ...(flags['sin-mp'] && { CARGA_MP: '0' }),
  },
});

console.log(`\nResumen JSON: ${resumen}`);
process.exit(r.status ?? 1);
