// scripts/safe-edit.mjs
//
// Editor seguro para archivos fragiles del repo (CheckoutScreen.jsx, etc.) que
// se corrompen con Edits incrementales sobre el mount Cowork<->Linux
// (CLAUDE.md bugs #1/#2/#3). Hace todos los reemplazos en memoria y escribe
// UNA sola vez, validando UTF-8 strict y limpiando NUL bytes si el mount padea.
//
// Uso:
//   import { safeEdit } from "./scripts/safe-edit.mjs";
//   safeEdit("ruta/al/archivo.jsx", [
//     ["viejo exacto", "nuevo"],
//     ["otro old", "otro new", 2],   // 3er elem = matches esperados (default 1)
//   ], { dryRun: false });

import { readFileSync, writeFileSync } from "node:fs";

function decodeStrict(buf, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch (e) {
    throw new Error(`[safe-edit] ${label}: UTF-8 invalido (${e.message}). Restaura desde HEAD.`);
  }
}

function countOccurrences(hay, needle) {
  if (needle === "") throw new Error("[safe-edit] el string a reemplazar no puede ser vacio");
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

export function safeEdit(filePath, replacements, opts = {}) {
  const { dryRun = false } = opts;
  if (!Array.isArray(replacements) || replacements.length === 0) {
    throw new Error(`[safe-edit] ${filePath}: no se pasaron reemplazos`);
  }

  let txt = decodeStrict(readFileSync(filePath), filePath);

  replacements.forEach((rep, idx) => {
    const [oldStr, newStr, expected = 1] = rep;
    if (typeof oldStr !== "string" || typeof newStr !== "string") {
      throw new Error(`[safe-edit] ${filePath}: reemplazo #${idx} mal formado`);
    }
    const count = countOccurrences(txt, oldStr);
    if (count !== expected) {
      throw new Error(`[safe-edit] ${filePath}: reemplazo #${idx} esperaba ${expected} match(es), hay ${count}.\n  OLD: ${oldStr.slice(0, 100).replace(/\n/g, "\\n")}`);
    }
    txt = txt.split(oldStr).join(newStr);
  });

  const outBuf = Buffer.from(txt, "utf-8");
  decodeStrict(outBuf, filePath);
  if (outBuf.includes(0x00)) throw new Error(`[safe-edit] ${filePath}: el resultado tiene NUL bytes. Aborto.`);

  const stats = { file: filePath, edits: replacements.length, lines: txt.split("\n").length, bytes: outBuf.length, dryRun };
  if (dryRun) return stats;

  writeFileSync(filePath, outBuf);
  // El mount a veces padea con NUL bytes al final: auto-curar.
  let back = readFileSync(filePath);
  if (back.includes(0x00)) {
    writeFileSync(filePath, Buffer.from(back.filter(b => b !== 0x00)));
    back = readFileSync(filePath);
    if (back.includes(0x00)) throw new Error(`[safe-edit] ${filePath}: NUL bytes persisten (mount). Restaura desde HEAD.`);
  }
  return stats;
}
