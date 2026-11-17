#!/usr/bin/env node
// npm audit con excepciones que vencen. Falla con cualquier aviso high o
// critical, salvo los listados en scripts/audit-excepciones.json con un
// vencimiento futuro. Un aviso vencido vuelve a fallar: la excepcion no se
// olvida en silencio.
// Uso: node scripts/check-audit.mjs   (lo corre el job Security Audit del CI)
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const excepciones = JSON.parse(readFileSync(join(aqui, 'audit-excepciones.json'), 'utf8')).excepciones || [];
const hoy = new Date().toISOString().slice(0, 10);

let salida;
try {
  salida = execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  salida = e.stdout; // npm audit sale 1 cuando hay avisos: el JSON viene igual
}
let reporte;
try { reporte = JSON.parse(salida); } catch {
  console.error('✗ npm audit no devolvio JSON legible');
  process.exit(1);
}

// Los avisos reales son los objetos de `via`; los strings solo propagan
// el aviso de una dependencia, que ya aparece como objeto en otra entrada.
const avisos = new Map();
for (const [paquete, v] of Object.entries(reporte.vulnerabilities || {})) {
  for (const via of v.via || []) {
    if (typeof via !== 'object') continue;
    if (!['high', 'critical'].includes(via.severity)) continue;
    const id = String(via.url || '').split('/').pop() || via.title;
    avisos.set(id, { id, paquete, severidad: via.severity, titulo: via.title });
  }
}

let fallas = 0;
for (const a of avisos.values()) {
  const ex = excepciones.find((e) => e.id === a.id);
  if (ex && ex.vence >= hoy) {
    console.log(`· ${a.id} (${a.paquete}, ${a.severidad}) exceptuado hasta ${ex.vence}: ${ex.motivo}`);
    continue;
  }
  fallas++;
  console.log(`✗ ${a.id} (${a.paquete}, ${a.severidad}) ${a.titulo}${ex ? ` — la excepcion vencio el ${ex.vence}` : ''}`);
}
for (const e of excepciones) {
  if (!avisos.has(e.id)) console.log(`· la excepcion ${e.id} ya no hace falta: sacala de audit-excepciones.json`);
}
if (fallas) { console.log(`\n✗ ${fallas} aviso(s) high/critical sin excepcion vigente`); process.exit(1); }
console.log(`✓ sin avisos high/critical fuera de las excepciones (${avisos.size} exceptuado(s))`);
