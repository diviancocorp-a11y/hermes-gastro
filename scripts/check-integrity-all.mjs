#!/usr/bin/env node
// scripts/check-integrity-all.mjs
// ─────────────────────────────────────────────────────────
// Recorre src/ y pasa todos los archivos relevantes a
// check-file-integrity.mjs. Útil para escanear el repo
// ad-hoc sin depender de que estén staged.
//
// Uso:
//   npm run check:integrity
// ─────────────────────────────────────────────────────────
import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execSync } from 'node:child_process';

const OK_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json']);
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);

const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (OK_EXT.has(extname(p))) files.push(p);
  }
}

walk('src');

if (files.length === 0) {
  console.log('(no hay archivos para chequear)');
  process.exit(0);
}

console.log(`→ Chequeando integridad de ${files.length} archivo(s) en src/...`);

try {
  execSync(
    `node scripts/check-file-integrity.mjs ${files.map((p) => JSON.stringify(p)).join(' ')}`,
    { stdio: 'inherit' }
  );
} catch {
  process.exit(1);
}
