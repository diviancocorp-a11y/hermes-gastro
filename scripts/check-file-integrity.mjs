#!/usr/bin/env node
// scripts/check-file-integrity.mjs
// ─────────────────────────────────────────────────────────
// Valida que los archivos pasados como argumentos NO estén:
//  1. Truncados (deben terminar con '\n')
//  2. Corruptos con NULL bytes
//  3. Con sintaxis JS rota (para .js / .mjs / .cjs)
//  4. JSON malformado (para .json)
//
// Uso: node scripts/check-file-integrity.mjs <file1> <file2> ...
// Salida: 0 si todos OK, 1 si alguno falla. Imprime errores en stderr.
//
// Pensado para correr desde el pre-commit hook sobre los archivos staged.
// ─────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs';
import { extname, basename } from 'node:path';
import { execSync } from 'node:child_process';

const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

let errors = 0;

for (const file of files) {
  if (!existsSync(file)) continue;

  let buf;
  try {
    buf = readFileSync(file);
  } catch (e) {
    console.error(`✗ ${file}: no se puede leer (${e.message})`);
    errors++;
    continue;
  }

  // 1) NULL bytes
  if (buf.includes(0x00)) {
    console.error(`✗ ${file}: contiene NULL bytes (archivo corrupto)`);
    errors++;
    continue;
  }

  // 2) Termina con newline (evita truncado de Edit/Write)
  if (buf.length > 0 && buf[buf.length - 1] !== 0x0a) {
    console.error(`✗ ${file}: no termina con newline (¿truncado?)`);
    errors++;
    continue;
  }

  const ext = extname(file).toLowerCase();
  const name = basename(file);

  // 3) JSON válido
  if (ext === '.json') {
    try {
      JSON.parse(buf.toString('utf-8'));
    } catch (e) {
      console.error(`✗ ${file}: JSON inválido — ${e.message}`);
      errors++;
    }
    continue;
  }

  // 4) Sintaxis JS válida (solo módulos puros, no JSX/TS)
  if (ext === '.mjs' || ext === '.cjs') {
    try {
      execSync(`node --check "${file}"`, { stdio: 'pipe' });
    } catch (e) {
      const msg = (e.stderr?.toString() || e.message).split('\n').slice(0, 4).join('\n');
      console.error(`✗ ${file}: error de sintaxis JS\n${msg}`);
      errors++;
    }
    continue;
  }

  // .js sin "type":"module" o con extensiones de configs — saltamos ya que
  // node --check espera CommonJS por default. ESLint cubre la sintaxis JS/JSX/TS.
}

if (errors > 0) {
  console.error(`\n✖ Pre-commit: ${errors} archivo(s) con problemas de integridad.`);
  console.error(`  Corregilos antes de commitear (típicamente: cerrar líneas truncadas).`);
  process.exit(1);
}

console.log(`✓ Pre-commit: ${files.length} archivo(s) sin problemas de integridad.`);
process.exit(0);
