#!/usr/bin/env node
// scripts/check-diseno.mjs
//
// Gate de diseno: corre el detector de impeccable sobre src/ e index.html y
// compara lo que encuentra contra scripts/diseno-deuda.json.
//
// ── POR QUE EXISTE ──
// El 15/oct/2026 el detector encontro 17 hallazgos en el codigo publicado:
// bordes laterales de color en tarjetas (el tic mas reconocible de la UI hecha
// por IA), Inter cargada en el catalogo pese a que el manual tipografico la
// excluye, contraste por debajo de AA. Ninguno rompe un test ni el build, asi
// que nada los frenaba. La skill /diseno mide antes y despues, pero depende de
// que alguien se acuerde de usarla; este check no.
//
// ── LA DEUDA SOLO SE ACHICA ──
// Mismo contrato que llamadas-legacy-pendientes.json: un hallazgo nuevo (o uno
// mas del mismo tipo en el mismo archivo) falla, y uno resuelto tambien falla
// hasta sacarlo de la lista, para que la lista sea siempre la verdad. La
// salida para una entrada es arreglar el codigo, nunca agrandar la lista.
// Las cuentas van por archivo y regla, no por linea: editar arriba de un
// hallazgo viejo no lo vuelve "nuevo".
//
// ── LO QUE NO DICE ──
// Es analisis estatico: no ve la pagina renderizada (para eso,
// `npx impeccable detect <url> --viewport 390x844`), y los avisos "advisory"
// del detector quedan afuera porque el propio impeccable no los cuenta como
// falla.
//
// Uso: npm run check:diseno
//      npm run check:diseno -- --podar    saca de la lista lo ya resuelto

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DEUDA = 'scripts/diseno-deuda.json';
const OBJETIVOS = ['src', 'index.html'];

const posix = (p) => p.split(sep).join('/');

function cliImpeccable() {
  const require = createRequire(import.meta.url);
  try {
    const pkgPath = require.resolve('impeccable/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.impeccable;
    return join(dirname(pkgPath), bin);
  } catch {
    return null;
  }
}

export function detectar(root = ROOT) {
  const cli = cliImpeccable();
  if (!cli) {
    throw new Error(
      'impeccable no esta instalado. Corre `npm install --include=dev` ' +
      '(con NODE_ENV=production global se saltean las devDependencies).',
    );
  }
  const r = spawnSync(
    process.execPath,
    [cli, 'detect', '--json', '--no-advisory', ...OBJETIVOS],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  // 0 = sin hallazgos, 2 = con hallazgos, cualquier otra cosa = no pudo escanear
  if (r.status !== 0 && r.status !== 2) {
    throw new Error(`impeccable detect fallo (exit ${r.status}):\n${r.stderr || r.error || ''}`);
  }
  const hallazgos = r.stdout.trim() ? JSON.parse(r.stdout) : [];
  return hallazgos.filter((h) => !h.advisory);
}

export function contar(hallazgos, root = ROOT) {
  const cuentas = {};
  for (const h of hallazgos) {
    const archivo = posix(relative(root, h.file));
    const regla = h.antipattern;
    cuentas[archivo] ??= {};
    cuentas[archivo][regla] = (cuentas[archivo][regla] || 0) + 1;
  }
  return cuentas;
}

export function comparar(actual, deuda) {
  const nuevos = [];
  const resueltos = [];
  const archivos = new Set([...Object.keys(actual), ...Object.keys(deuda)]);
  for (const archivo of archivos) {
    const a = actual[archivo] || {};
    const d = deuda[archivo] || {};
    for (const regla of new Set([...Object.keys(a), ...Object.keys(d)])) {
      const hoy = a[regla] || 0;
      const antes = d[regla] || 0;
      if (hoy > antes) nuevos.push({ archivo, regla, antes, hoy });
      if (hoy < antes) resueltos.push({ archivo, regla, antes, hoy });
    }
  }
  return { nuevos, resueltos };
}

// Baja cada cuenta a lo que hay hoy; nunca sube ninguna.
export function podar(actual, deuda) {
  const out = {};
  for (const archivo of Object.keys(deuda).sort()) {
    for (const regla of Object.keys(deuda[archivo]).sort()) {
      const n = Math.min(deuda[archivo][regla], actual[archivo]?.[regla] || 0);
      if (n > 0) (out[archivo] ??= {})[regla] = n;
    }
  }
  return out;
}

const total = (c) => Object.values(c).reduce((s, r) => s + Object.values(r).reduce((x, y) => x + y, 0), 0);

function main() {
  const ruta = join(ROOT, DEUDA);
  if (!existsSync(ruta)) {
    console.error(`✗ Falta ${DEUDA}.`);
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(ruta, 'utf8'));
  const deuda = doc.deuda || {};

  let actual;
  try {
    actual = contar(detectar());
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }

  if (process.argv.includes('--podar')) {
    const nueva = podar(actual, deuda);
    writeFileSync(ruta, JSON.stringify({ ...doc, deuda: nueva }, null, 2) + '\n');
    console.log(`✓ ${DEUDA}: ${total(deuda)} → ${total(nueva)} hallazgo(s).`);
    return;
  }

  const { nuevos, resueltos } = comparar(actual, deuda);
  if (nuevos.length) {
    console.error('✗ Hallazgos de diseno nuevos (impeccable detect):');
    for (const n of nuevos) console.error(`  ${n.archivo} — ${n.regla}: ${n.antes} → ${n.hoy}`);
    console.error(`  Detalle: npx impeccable detect ${nuevos.map((n) => n.archivo).join(' ')}`);
    console.error('  La salida es arreglar el codigo; la lista de deuda solo se achica.');
    process.exit(1);
  }
  if (resueltos.length) {
    console.error('✗ Deuda de diseno resuelta que sigue en la lista:');
    for (const r of resueltos) console.error(`  ${r.archivo} — ${r.regla}: ${r.antes} → ${r.hoy}`);
    console.error('  Bien. Sacala con: npm run check:diseno -- --podar');
    process.exit(1);
  }
  console.log(`✓ Diseno: ${total(actual)} hallazgo(s), todos en la deuda conocida.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
