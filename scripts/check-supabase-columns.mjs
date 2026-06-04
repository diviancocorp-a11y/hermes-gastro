#!/usr/bin/env node
// scripts/check-supabase-columns.mjs
// Valida que las columnas referenciadas en .from('tabla').select(...) existan
// en el schema cacheado en supabase-schema.json. Soporta joins (table(*)) y
// select('*').
//
// Skip: // @skip-columns-check
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SCHEMA_PATH = new URL('./supabase-schema.json', import.meta.url);
let schema;
try {
  schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8')).tables;
} catch {
  console.warn('⚠ scripts/supabase-schema.json no disponible — skip');
  process.exit(0);
}
const tableNames = new Set(Object.keys(schema));

const args = process.argv.slice(2);
let files = [];
if (args[0] === '--all') {
  const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
  function walk(dir) {
    for (const e of readdirSync(dir)) {
      if (SKIP.has(e)) continue;
      const p = join(dir, e);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (['.js', '.jsx', '.ts', '.tsx'].includes(extname(p))) files.push(p);
    }
  }
  walk('src');
} else {
  files = args.filter(f => existsSync(f) && ['.js', '.jsx', '.ts', '.tsx'].includes(extname(f)));
}
if (files.length === 0) process.exit(0);

// Regex: .from('tabla').select('cols')
const FROM_SELECT_RE = /\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)[^;{}]*?\.select\(\s*['"]([^'"]+)['"]\s*\)/gi;

function splitCols(str) {
  // Split por comas a nivel 0 (ignorando paréntesis de joins).
  const cols = [];
  let depth = 0, buf = '';
  for (const ch of str) {
    if (ch === '(') { depth++; buf += ch; }
    else if (ch === ')') { depth--; buf += ch; }
    else if (ch === ',' && depth === 0) { cols.push(buf.trim()); buf = ''; }
    else buf += ch;
  }
  if (buf.trim()) cols.push(buf.trim());
  return cols;
}

let errors = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf-8');
  if (/\/\/\s*@skip-columns-check/.test(src.slice(0, 300))) continue;
  let match;
  FROM_SELECT_RE.lastIndex = 0;
  while ((match = FROM_SELECT_RE.exec(src)) !== null) {
    const [_full, table, selectStr] = match;
    if (!schema[table]) continue;
    const cleanSelect = selectStr.replace(/\s+/g, ' ').trim();
    if (cleanSelect === '*') continue;
    const cols = splitCols(cleanSelect);
    const tableCols = new Set(schema[table]);
    for (const col of cols) {
      // Token raiz: lo que esta antes de "(" (joins) o ":" (aliases)
      const root = col.split(/[(:]/)[0].trim();
      if (!root || root === '*') continue;
      // Si es un nombre de tabla conocido → es un join, valido
      if (tableNames.has(root)) continue;
      // Si tiene paréntesis es join (incluso si la tabla no está en snapshot)
      if (col.includes('(')) continue;
      if (!tableCols.has(root)) {
        const lineNum = src.slice(0, match.index).split('\n').length;
        console.error(`✗ ${file}:${lineNum} — columna "${root}" no existe en tabla "${table}"`);
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n✖ ${errors} columna(s) no validan contra el schema`);
  console.error(`  Si agregaste una columna nueva: aplicá la migration + actualizá scripts/supabase-schema.json`);
  process.exit(1);
}
console.log(`✓ ${files.length} archivo(s) — columnas validan`);
process.exit(0);
