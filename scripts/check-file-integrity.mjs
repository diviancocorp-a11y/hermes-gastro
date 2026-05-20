#!/usr/bin/env node
// scripts/check-file-integrity.mjs
// ─────────────────────────────────────────────────────────
// Valida que los archivos pasados como argumentos NO estén:
//  1. Truncados (deben terminar con '\n')
//  2. Corruptos con NULL bytes
//  3. Con sintaxis JS rota (.mjs / .cjs)
//  4. JSON malformado (.json)
//
// Uso:
//   node scripts/check-file-integrity.mjs <file1> <file2> ...
//   node scripts/check-file-integrity.mjs --fix <file1> ...
//
// Con --fix: appendea '\n' al final si falta (auto-arregla trailing newline).
// El fix sólo cubre el newline — null bytes / JSON / JS rotos siguen requiriendo
// intervención manual porque auto-arreglarlos puede borrar contenido válido.
//
// Salida: 0 si OK, 1 si quedan problemas. Imprime errores en stderr.
// ─────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { extname } from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const fixMode = args[0] === '--fix';
const files = fixMode ? args.slice(1) : args;

if (files.length === 0) process.exit(0);

let errors = 0;
let fixed = 0;

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

  // 1) NULL bytes — error fatal, NO se auto-arregla
  if (buf.includes(0x00)) {
    console.error(`✗ ${file}: contiene NULL bytes (archivo corrupto, requiere fix manual)`);
    errors++;
    continue;
  }

  // 2) Termina con newline — se auto-arregla si --fix
  if (buf.length > 0 && buf[buf.length - 1] !== 0x0a) {
    if (fixMode) {
      writeFileSync(file, Buffer.concat([buf, Buffer.from('\n')]));
      console.log(`↻ ${file}: fixed (newline final agregado)`);
      fixed++;
      buf = readFileSync(file);
    } else {
      console.error(`✗ ${file}: no termina con newline (¿truncado?)`);
      errors++;
      continue;
    }
  }

  const ext = extname(file).toLowerCase();

  // 3) JSX dentro de .js → Vite no lo procesa, build de Vercel rompe
  // Detectamos tags JSX típicos. Heurística conservadora para evitar falsos positivos
  // (comparaciones `a < b`, template strings con HTML).
  if (ext === '.js') {
    const src = buf.toString('utf-8');
    // Excluir comments (// ... y /* ... */)
    const stripped = src
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const jsxPatterns = [
      /<[A-Z][A-Za-z0-9]*[\s/>]/,                                          // <Component
      /<(div|span|button|input|img|a|p|h[1-6]|ul|li|form|section|article|nav|header|footer|main|aside|label|select|textarea|table|tr|td|th|tbody|thead|svg|path|g|rect|circle|line|polyline|polygon)[\s/>]/, // <tagHTML
      /<\/[A-Za-z]/,                                                       // </Anything (cierre JSX)
    ];
    if (jsxPatterns.some((re) => re.test(stripped))) {
      console.error(`✗ ${file}: contiene JSX en .js — renombrar a .jsx (Vite no compila JSX en .js, Vercel rompe)`);
      errors++;
      continue;
    }
  }

  // 4) JSON válido
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
      console.error(`\u2717 ${file}: error de sintaxis JS\n${msg}`);
      errors++;
    }
    continue;
  }
}

if (errors > 0) {
  console.error(`\n\u2716 Pre-commit: ${errors} archivo(s) con problemas de integridad.`);
  console.error(`  ${fixMode ? 'No se pudieron auto-arreglar' : 'Corregilos antes de commitear'} (t\u00edpicamente: cerrar l\u00edneas truncadas o quitar NULL bytes).`);
  process.exit(1);
}

if (fixed > 0) {
  console.log(`\n\u21bb Pre-commit: ${fixed} archivo(s) auto-arreglado(s), ${files.length - fixed} ya estaban OK.`);
  if (fixMode) {
    const list = files.slice(0, fixed).join(' ');
    try {
      execSync(`git add ${list}`, { stdio: 'pipe' });
    } catch { /* ignorar si no estamos en repo o el add falla */ }
  }
} else {
  console.log(`\u2713 Pre-commit: ${files.length} archivo(s) sin problemas de integridad.`);
}
process.exit(0);
