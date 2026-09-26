#!/usr/bin/env node
// scripts/archivar-handoff.mjs
//
// Deja en docs/HANDOFF.md solo las ultimas secciones y mueve el resto, sin
// tocarlas, arriba de docs/historico/HANDOFF-anterior.md.
//
// ── POR QUE EXISTE ──
// El HANDOFF crece por arriba en cada /cerrardico y habia llegado a 5577
// lineas. /dico lee solo la primera seccion, asi que el costo no estaba ahi:
// estaba en cada grep sobre docs/, que traia decisiones de agosto mezcladas
// con las de hoy, y en lo facil que es citar una seccion vieja como vigente.
//
// Es un script y no una edicion a mano porque mover miles de lineas con un
// editor es exactamente como se corrompieron archivos antes (CLAUDE.md, bugs
// 1 y 2: cortes a mitad de un caracter UTF-8, bloques truncados). Aca se
// decodifica en modo estricto y se verifica que no se pierda ni un byte.
//
// ── USO ──
//   npm run handoff:archivar             # deja las ultimas 5
//   npm run handoff:archivar -- --dejar 8

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
export const HANDOFF = join(ROOT, 'docs', 'HANDOFF.md');
export const ARCHIVO = join(ROOT, 'docs', 'historico', 'HANDOFF-anterior.md');
export const DEJAR = 5;

const ES_MAIN = process.argv[1]
  && fileURLToPath(import.meta.url) === process.argv[1];

export const ENCABEZADO_ARCHIVO = `# HANDOFF anterior — Dico

> Las secciones que salieron de \`docs/HANDOFF.md\`, de la mas nueva a la mas
> vieja, igual que alla. **Nada de esto describe el presente**: sirve para
> entender por que se decidio algo, no para saber como esta hoy. Antes de
> citar algo de aca, verificalo contra el codigo o la base.
>
> Las mueve \`npm run handoff:archivar\`. No se editan a mano.

---

`;

// Un decoder que falla en vez de reemplazar: un HANDOFF ya corrupto no se
// propaga al archivo, se frena aca.
const utf8 = new TextDecoder('utf-8', { fatal: true });
const leer = (p) => utf8.decode(readFileSync(p));

/**
 * Parte un markdown en encabezado + secciones `## `. Cada seccion va desde su
 * titulo hasta el proximo, con el `---` de cierre incluido. Un `## ` dentro de
 * un bloque de codigo no corta.
 */
export function partir(texto) {
  const lineas = texto.split('\n');
  const cortes = [];
  let enCodigo = false;
  lineas.forEach((l, i) => {
    if (l.startsWith('```')) enCodigo = !enCodigo;
    else if (!enCodigo && l.startsWith('## ')) cortes.push(i);
  });
  if (!cortes.length) return { encabezado: texto, secciones: [] };
  const unir = (a, b) => lineas.slice(a, b).join('\n') + (b < lineas.length ? '\n' : '');
  return {
    encabezado: unir(0, cortes[0]),
    secciones: cortes.map((c, i) => unir(c, cortes[i + 1] ?? lineas.length)),
  };
}

/** Separa las `dejar` primeras secciones de las que se van. */
export function archivar(handoff, archivo, dejar = DEJAR) {
  const h = partir(handoff);
  if (h.secciones.length <= dejar) return null;

  const quedan = h.secciones.slice(0, dejar);
  const salen = h.secciones.slice(dejar);
  // La ultima que queda cerraba con el separador de la siguiente: se asegura
  // que el HANDOFF termine limpio, con un solo salto de linea.
  const nuevoHandoff = (h.encabezado + quedan.join('')).replace(/\n*$/, '\n');

  const a = partir(archivo ?? ENCABEZADO_ARCHIVO);
  const movidas = salen.join('').replace(/\n*$/, '\n');
  const separador = movidas.trimEnd().endsWith('---') ? '\n' : '\n---\n\n';
  const nuevoArchivo = a.encabezado
    + movidas
    + (a.secciones.length ? separador + a.secciones.join('') : '');

  return { nuevoHandoff, nuevoArchivo, quedan: quedan.length, salen: salen.length, salenDesde: salen[0].split('\n')[0] };
}

/** Todo lo que habia sigue estando: las secciones de los dos lados, en orden. */
export function verificar(antesHandoff, antesArchivo, r) {
  const titulos = (t) => partir(t).secciones.map((s) => s.split('\n')[0]);
  const antes = [...titulos(antesHandoff), ...(antesArchivo ? titulos(antesArchivo) : [])];
  const despues = [...titulos(r.nuevoHandoff), ...titulos(r.nuevoArchivo)];
  if (antes.join('\n') !== despues.join('\n')) {
    throw new Error('las secciones no coinciden antes y despues: no se escribio nada');
  }
  const cuerpo = (t) => partir(t).secciones.map((s) => s.replace(/\s*(---\s*)?$/, '')).join('\n');
  const antesCuerpo = cuerpo(antesHandoff) + (antesArchivo ? `\n${cuerpo(antesArchivo)}` : '');
  const despuesCuerpo = `${cuerpo(r.nuevoHandoff)}\n${cuerpo(r.nuevoArchivo)}`;
  if (antesCuerpo !== despuesCuerpo) {
    throw new Error('el contenido de alguna seccion cambio al moverla: no se escribio nada');
  }
}

if (ES_MAIN) {
  const i = process.argv.indexOf('--dejar');
  const dejar = i > -1 ? Number(process.argv[i + 1]) : DEJAR;
  if (!Number.isInteger(dejar) || dejar < 1) {
    console.error('--dejar tiene que ser un entero mayor a 0');
    process.exit(1);
  }

  const handoff = leer(HANDOFF);
  const archivo = existsSync(ARCHIVO) ? leer(ARCHIVO) : null;
  const r = archivar(handoff, archivo, dejar);

  if (!r) {
    console.log(`HANDOFF con ${partir(handoff).secciones.length} seccion(es): nada que archivar (se dejan ${dejar}).`);
  } else {
    verificar(handoff, archivo, r);
    writeFileSync(HANDOFF, r.nuevoHandoff, 'utf8');
    writeFileSync(ARCHIVO, r.nuevoArchivo, 'utf8');
    const lineas = (t) => t.split('\n').length - 1;
    console.log(`Quedan ${r.quedan} secciones en docs/HANDOFF.md (${lineas(r.nuevoHandoff)} lineas).`);
    console.log(`Se movieron ${r.salen} a docs/historico/HANDOFF-anterior.md, desde:`);
    console.log(`  ${r.salenDesde}`);
  }
}
