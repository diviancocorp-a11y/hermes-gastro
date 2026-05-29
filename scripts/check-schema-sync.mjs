#!/usr/bin/env node
// scripts/check-schema-sync.mjs
//
// Verifica que cada schema Zod declarado en src/lib/schemas/index.js
// incluya todas las columnas DB listadas en scripts/db-columns-manifest.json
// (excepto las marcadas como serverOnly).
//
// Pensado para detectar el bug silencioso típico:
//   - Agregás columna a la DB (migration).
//   - Tocás el form para usarla.
//   - Olvidás agregarla al schema Zod.
//   - validateInput() la descarta sin avisar → UPDATE no la persiste.
//
// Uso:
//   node scripts/check-schema-sync.mjs                  → check
//   git pre-commit hook lo corre automáticamente.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCHEMAS_FILE = path.join(ROOT, "src/lib/schemas/index.js");
const MANIFEST_FILE = path.join(__dirname, "db-columns-manifest.json");

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

function fail(msg) {
  process.stderr.write(`${RED}✗ ${msg}${RESET}\n`);
}

function ok(msg) {
  process.stdout.write(`${GREEN}✓ ${msg}${RESET}\n`);
}

function dim(msg) {
  process.stdout.write(`${DIM}${msg}${RESET}\n`);
}

// Extrae los campos declarados en un `export const FooSchema = z.object({ ... })`
// Patrón simple regex-based — basta para detectar pérdida de campos.
function extractSchemaFields(source, schemaName) {
  const start = source.indexOf(`export const ${schemaName} = z.object({`);
  if (start === -1) return null;
  const objStart = source.indexOf("{", start);
  // contamos brackets para encontrar el cierre
  let depth = 0;
  let i = objStart;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (i >= source.length) return null;
  const body = source.slice(objStart + 1, i);
  // Capturamos `nombreCampo:` al inicio de cada propiedad de nivel superior.
  // Estrategia: línea-a-línea, rebajamos comentarios y buscamos `^\s*([a-z_][a-z0-9_]*)\s*:`
  const fields = new Set();
  let nestDepth = 0;
  body.split("\n").forEach(rawLine => {
    let line = rawLine;
    // strip line comment
    const cIdx = line.indexOf("//");
    if (cIdx >= 0) line = line.slice(0, cIdx);
    // strip block-comment-ish
    line = line.replace(/\/\*.*?\*\//g, "");
    // Track nested {} (puede haber z.object anidado dentro de un campo, ej. items: z.array(z.object({...})))
    for (const ch of line) {
      if (ch === "{") nestDepth++;
      else if (ch === "}") nestDepth--;
    }
    if (nestDepth > 0) {
      // estamos dentro de un objeto anidado, no contamos sus keys como campos del schema
      // Pero el match abajo podría dispararse igual — chequeamos antes de matchear.
    }
    const m = line.match(/^\s*([a-z_][a-z0-9_]*)\s*:/);
    if (m && nestDepth <= (line.endsWith("{") ? 1 : 0)) {
      fields.add(m[1]);
    }
  });
  return fields;
}

function main() {
  if (!fs.existsSync(SCHEMAS_FILE)) {
    fail(`No existe ${SCHEMAS_FILE}`);
    process.exit(2);
  }
  if (!fs.existsSync(MANIFEST_FILE)) {
    fail(`No existe ${MANIFEST_FILE}`);
    process.exit(2);
  }

  const source = fs.readFileSync(SCHEMAS_FILE, "utf-8");
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));

  let errors = 0;
  let warnings = 0;
  const tables = Object.entries(manifest.tables || {});

  process.stdout.write("\n→ Schema ↔ DB sync check\n");

  for (const [tableName, def] of tables) {
    const { schema: schemaName, columns = [], serverOnly = [] } = def;
    if (!schemaName) {
      dim(`  ${tableName}: sin schema declarado, salteado`);
      continue;
    }
    const fields = extractSchemaFields(source, schemaName);
    if (!fields) {
      fail(`${tableName}: no encontré ${schemaName} en schemas/index.js`);
      errors++;
      continue;
    }
    const expected = new Set(columns);
    const missing = [...expected].filter(c => !fields.has(c));
    const extra = [...fields].filter(c => !expected.has(c) && !serverOnly.includes(c) && c !== "id");

    if (missing.length === 0 && extra.length === 0) {
      ok(`${tableName}  (${fields.size} campos en ${schemaName})`);
      continue;
    }
    if (missing.length > 0) {
      fail(`${tableName}: el schema ${schemaName} NO declara: ${missing.join(", ")}`);
      fail(`  → agregalas al schema en src/lib/schemas/index.js o sacalas del manifest.`);
      errors++;
    }
    if (extra.length > 0) {
      process.stdout.write(`${YELLOW}⚠ ${tableName}: schema declara campos que no están en columns ni serverOnly: ${extra.join(", ")}${RESET}\n`);
      process.stdout.write(`${YELLOW}  → si son válidos, agregalos al manifest. Si no, sacalos del schema.${RESET}\n`);
      warnings++;
    }
  }

  process.stdout.write("\n");
  if (errors > 0) {
    fail(`Schema desincronizado: ${errors} error(es), ${warnings} warning(s).`);
    process.exit(1);
  }
  if (warnings > 0) {
    process.stdout.write(`${YELLOW}Schemas con campos extra: ${warnings} warning(s) (no bloquea).${RESET}\n`);
  }
  ok(`Schema ↔ DB en sync.`);
}

main();
