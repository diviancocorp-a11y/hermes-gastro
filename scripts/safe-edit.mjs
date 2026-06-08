// scripts/safe-edit.mjs
//
// Editor seguro para los archivos fragiles del repo (CheckoutScreen.jsx,
// BrandModal.jsx, etc.) que se corrompen con Edits incrementales sobre el
// mount Cowork<->Linux (ver CLAUDE.md, bugs #1 y #2).
//
// Hace TODOS los reemplazos en memoria y escribe el archivo UNA sola vez:
//   - lee el archivo y valida UTF-8 strict (aborta si ya estaba corrupto)
//   - exige que cada `old` matchee la cantidad esperada (default: exactamente 1)
//   - reescribe en un unico writeFileSync (sin Edits parciales = sin truncado)
//   - revalida UTF-8 strict + NULL bytes ANTES de pisar el archivo
//
// Uso programatico (preferido, p.ej. desde otro script o un heredoc node):
//   import { safeEdit } from "./scripts/safe-edit.mjs";
//   safeEdit("src/catalog-pro/CheckoutScreen.jsx", [
//     [ "viejo string exacto", "nuevo string" ],
//     [ "otro old", "otro new", 2 ],   // 3er elemento = matches esperados
//   ]);
//
// Uso CLI (con un spec JSON):
//   node scripts/safe-edit.mjs cambios.json
//   donde cambios.json = { "file": "...", "replacements": [["old","new"], ...] }
//   o un array de varios specs: [ { file, replacements }, ... ]

import { readFileSync, writeFileSync } from "node:fs";

// Decodifica UTF-8 en modo estricto: tira error si hay bytes invalidos
// (a diferencia de Buffer.toString, que reemplaza con U+FFFD en silencio).
function decodeStrict(buf, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch (e) {
    throw new Error(`[safe-edit] ${label}: UTF-8 invalido al leer (${e.message}). Restaura desde HEAD antes de editar.`);
  }
}

function countOccurrences(haystack, needle) {
  if (needle === "") throw new Error("[safe-edit] el string a reemplazar no puede ser vacio");
  let n = 0, i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

function preview(s, max = 100) {
  const one = s.replace(/\n/g, "\\n");
  return one.length > max ? one.slice(0, max) + "..." : one;
}

/**
 * Aplica reemplazos a un archivo de forma atomica y segura.
 * @param {string} filePath  ruta al archivo
 * @param {Array<[string,string]|[string,string,number]>} replacements
 *        lista de [old, new] o [old, new, expectedMatches]
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {{ file:string, edits:number, lines:number, bytes:number }}
 */
export function safeEdit(filePath, replacements, opts = {}) {
  const { dryRun = false } = opts;
  if (!Array.isArray(replacements) || replacements.length === 0) {
    throw new Error(`[safe-edit] ${filePath}: no se pasaron reemplazos`);
  }

  const original = decodeStrict(readFileSync(filePath), filePath);
  let txt = original;

  replacements.forEach((rep, idx) => {
    const [oldStr, newStr, expected = 1] = rep;
    if (typeof oldStr !== "string" || typeof newStr !== "string") {
      throw new Error(`[safe-edit] ${filePath}: reemplazo #${idx} mal formado (old/new deben ser strings)`);
    }
    const count = countOccurrences(txt, oldStr);
    if (count !== expected) {
      throw new Error(
        `[safe-edit] ${filePath}: reemplazo #${idx} esperaba ${expected} match(es) pero hay ${count}.\n` +
        `  OLD: ${preview(oldStr)}`
      );
    }
    txt = txt.split(oldStr).join(newStr);
  });

  // Revalidacion antes de escribir: re-encode + decode strict + NULL bytes.
  const outBuf = Buffer.from(txt, "utf-8");
  decodeStrict(outBuf, filePath); // tira si por algun motivo quedo invalido
  if (outBuf.includes(0x00)) {
    throw new Error(`[safe-edit] ${filePath}: el resultado contiene NULL bytes. Aborto.`);
  }

  const stats = { file: filePath, edits: replacements.length, lines: txt.split("\n").length, bytes: outBuf.length };

  if (!dryRun) writeFileSync(filePath, outBuf);
  return { ...stats, dryRun };
}

// ---- CLI ----
// node scripts/safe-edit.mjs <spec.json> [--dry]
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry");
  const specPath = args.find(a => !a.startsWith("--"));
  if (!specPath) {
    console.error("uso: node scripts/safe-edit.mjs <spec.json> [--dry]");
    console.error('spec: { "file": "ruta", "replacements": [["old","new"], ...] }  (o un array de specs)');
    process.exit(2);
  }
  let spec;
  try {
    spec = JSON.parse(decodeStrict(readFileSync(specPath), specPath));
  } catch (e) {
    console.error(`[safe-edit] no pude leer/parsear ${specPath}: ${e.message}`);
    process.exit(2);
  }
  const specs = Array.isArray(spec) ? spec : [spec];
  try {
    for (const s of specs) {
      const r = safeEdit(s.file, s.replacements, { dryRun });
      console.log(`${dryRun ? "[dry] " : ""}OK ${r.file}: ${r.edits} edits, ${r.lines} lineas, ${r.bytes} bytes`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
