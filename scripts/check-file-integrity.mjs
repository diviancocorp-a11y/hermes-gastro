#!/usr/bin/env node
// scripts/check-file-integrity.mjs
// Valida que los archivos pasados como argumentos NO estén:
//  1. Truncados (deben terminar con '\n')
//  2. Corruptos con NULL bytes
//  3. Truncados al medio (ultima linea cortada en expresion)
//  4. JSX en .js (Vite no lo procesa)
//  5. Patron roto type="number" + Number(e.target.value) en .jsx/.tsx
//  6. JSON malformado
//  7. Sintaxis JS en .mjs/.cjs

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

  // 1) NULL bytes
  if (buf.includes(0x00)) {
    console.error(`✗ ${file}: contiene NULL bytes (archivo corrupto)`);
    errors++;
    continue;
  }

  // 2) EOF: termina con un solo \n
  if (buf.length > 0) {
    const endsWithSingleNewline =
      buf[buf.length - 1] === 0x0a &&
      (buf.length === 1 || buf[buf.length - 2] !== 0x0a);
    if (!endsWithSingleNewline) {
      if (fixMode) {
        let end = buf.length;
        while (end > 0 && (buf[end - 1] === 0x0a || buf[end - 1] === 0x0d || buf[end - 1] === 0x20 || buf[end - 1] === 0x09)) end--;
        const cleaned = Buffer.concat([buf.subarray(0, end), Buffer.from('\n')]);
        writeFileSync(file, cleaned);
        console.log(`↻ ${file}: fixed EOF`);
        fixed++;
        buf = readFileSync(file);
      } else {
        console.error(`✗ ${file}: EOF mal (sin newline o con blank line extra)`);
        errors++;
        continue;
      }
    }
  }

  const ext = extname(file).toLowerCase();

  // 2.5) Truncamiento al medio (heuristica)
  if (['.jsx', '.js', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    const lines = buf.toString('utf-8').split(/\r?\n/);
    let i = lines.length - 1;
    while (i >= 0 && lines[i].trim() === '') i--;
    const lastLine = (lines[i] || '').trim();
    const noComment = lastLine.replace(/\/\/.*$/, '');
    const truncated =
      /[+\-*/&|=<>?,]$/.test(noComment) ||
      /=\s*\{?\s*$/.test(noComment) ||
      /\b(const|let|var|return|import|export)\s*$/.test(noComment) ||
      (/[(\[{]\s*$/.test(noComment) && !lastLine.startsWith('//'));
    const singleQ = (noComment.match(/'/g) || []).length;
    const doubleQ = (noComment.match(/"/g) || []).length;
    const backtickQ = (noComment.match(/`/g) || []).length;
    const unbalanced = (singleQ % 2) + (doubleQ % 2) + (backtickQ % 2) > 0;
    if (truncated || unbalanced) {
      console.error(`✗ ${file}: posible truncamiento — ultima linea: "${lastLine.slice(0, 80)}${lastLine.length > 80 ? '...' : ''}"`);
      errors++;
      continue;
    }
  }

  // 3) JSX dentro de .js
  if (ext === '.js') {
    const src = buf.toString('utf-8');
    if (/^\s*\/\/\s*@no-jsx-check/m.test(src.slice(0, 200))) continue;
    const stripped = src
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/`[\s\S]*?`/g, '');
    const jsxPatterns = [
      /<[A-Z][A-Za-z0-9]*[\s/>]/,
      /<(div|span|button|input|img|a|p|h[1-6]|ul|li|form|section|article|nav|header|footer|main|aside|label|select|textarea|table|tr|td|th|tbody|thead|svg|path|g|rect|circle|line|polyline|polygon)[\s/>]/,
      /<\/[A-Za-z]/,
    ];
    if (jsxPatterns.some((re) => re.test(stripped))) {
      console.error(`✗ ${file}: JSX en .js — renombrar a .jsx`);
      errors++;
      continue;
    }
  }

  // 4) type="number" + Number(e.target.value)
  if (ext === '.jsx' || ext === '.tsx') {
    const src = buf.toString('utf-8');
    if (!/^\s*\/\/\s*@allow-bad-number-input/m.test(src.slice(0, 200))) {
      if (/type=["']number["']/.test(src) && /Number\(e\.target\.value\)/.test(src)) {
        console.error(`✗ ${file}: type="number" con Number(e.target.value) — usa DecimalInput`);
        errors++;
        continue;
      }
    }
  }

  // 5) JSON
  if (ext === '.json') {
    try { JSON.parse(buf.toString('utf-8')); }
    catch (e) { console.error(`✗ ${file}: JSON invalido — ${e.message}`); errors++; }
    continue;
  }

  // 6) Sintaxis JS pura
  if (ext === '.mjs' || ext === '.cjs') {
    try { execSync(`node --check "${file}"`, { stdio: 'pipe' }); }
    catch (e) {
      const msg = (e.stderr?.toString() || e.message).split('\n').slice(0, 4).join('\n');
      console.error(`✗ ${file}: sintaxis JS\n${msg}`); errors++;
    }
    continue;
  }
}

if (errors > 0) {
  console.error(`\n✖ ${errors} archivo(s) con problemas`);
  process.exit(1);
}

if (fixed > 0) {
  console.log(`\n↻ ${fixed} archivo(s) auto-arreglado(s)`);
  if (fixMode) {
    const list = files.slice(0, fixed).join(' ');
    try { execSync(`git add ${list}`, { stdio: 'pipe' }); } catch { /* ignore */ }
  }
} else {
  console.log(`✓ ${files.length} archivo(s) sin problemas`);
}
process.exit(0);
