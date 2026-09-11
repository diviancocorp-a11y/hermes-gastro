#!/usr/bin/env node
// scripts/pantalla/acciones.mjs
//
// Lista lo que una pantalla HACE, y compara dos pantallas para ver que se
// perdio al portar una.
//
//   npm run pantalla:acciones -- src/components/admin/Stock.jsx
//   npm run pantalla:acciones -- src/components/admin/Stock.jsx src/components/admin/platform/StockPanel.jsx
//
// POR QUE EXISTE
// Al rehacer Stock se porto la LISTA y se olvido el alta y la edicion de
// insumo, que el componente viejo si tenia. Quedo publicado asi. El build
// pasaba, los 1338 tests pasaban y la pantalla se veia igual a la referencia:
// no habia NADA que lo delatara salvo intentar usarla.
//
// La leccion: portar una pantalla es portar lo que HACE, no lo que muestra, y
// ni un test de render ni una captura notan la diferencia. Un inventario de
// acciones si.
//
// COMO SE USA EN UN PORT
//   1. correrlo sobre el componente viejo ANTES de escribir el nuevo
//   2. cada accion de esa lista se convierte en un test del nuevo
//   3. correrlo en modo comparacion antes de dar el port por terminado
//
// NO ES UN GATE Y NO VA AL PRE-COMMIT. Es un lector de texto: no entiende
// indirecciones ni handlers armados en runtime, y lo que devuelve son pistas
// para mirar, no un veredicto. Un gate que se equivoca a veces se termina
// salteando siempre.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Texto visible de cada boton.
 *
 * Se busca HACIA ATRAS desde `</button>` hasta el `>` mas cercano, en vez de
 * parsear la etiqueta de apertura. Las dos formas obvias fallan en JSX real:
 *
 *   `<button[^>]*>`   corta en el `>` de `onClick={() => abrir()}`
 *   barrido de comillas  se rompe con los apostrofes del castellano, que
 *                        abren una comilla que nunca cierra
 *
 * Buscar hacia atras no necesita entender la etiqueta. Si el boton tiene un
 * icono adentro, el `>` mas cercano es el del icono y queda el texto que
 * sigue, que es justamente el rotulo que lee el usuario.
 */
export function textoDeBotones(codigo) {
  const encontrados = new Set();
  for (const m of codigo.matchAll(/<\/button>/g)) {
    const cierre = codigo.lastIndexOf('>', m.index - 1);
    if (cierre === -1) continue;

    const texto = codigo.slice(cierre + 1, m.index)
      .replace(/\{[^{}]*\}/g, ' ')  // expresiones JSX de un nivel
      .replace(/\s+/g, ' ')
      .trim();

    // Un boton cuyo rotulo entero sale de una expresion no tiene texto fijo:
    // queda listado por su callback, no por su texto.
    if (texto.length > 1 && /[a-záéíóúñ]{2}/i.test(texto)) encontrados.add(texto);
  }
  return [...encontrados];
}

/** Props de callback que recibe: son su contrato con el padre. */
export function callbacksQueRecibe(codigo) {
  const encontrados = new Set();
  const firmas = codigo.match(/function \w+\(\s*\{([^}]*)\}/gs) || [];
  for (const f of firmas) {
    for (const p of f.replace(/^[^{]*\{/, '').split(',')) {
      const nombre = p.split('=')[0].replace(/[{}]/g, '').trim();
      if (/^on[A-Z]/.test(nombre)) encontrados.add(nombre);
    }
  }
  return [...encontrados];
}

/** Lo que la pantalla abre: overlays, editores, modos de formulario. */
function aperturas(codigo) {
  const encontrados = new Set();
  for (const m of codigo.matchAll(/setOverlay\(\s*\{\s*type:\s*["'](\w+)["']/g)) {
    encontrados.add(`overlay:${m[1]}`);
  }
  for (const m of codigo.matchAll(/set(?:Modo|Overlay|Editando|EnEdicion)\(\s*['"](\w[\w-]*)['"]/g)) {
    encontrados.add(`modo:${m[1]}`);
  }
  return [...encontrados];
}

/** Lo que la pantalla escribe. */
function escrituras(codigo) {
  const encontrados = new Set();
  for (const m of codigo.matchAll(/\.rpc\(\s*['"]([\w_]+)['"]/g)) encontrados.add(`rpc:${m[1]}`);
  for (const m of codigo.matchAll(/\.(upsert|insert|update|delete)\(/g)) encontrados.add(`escribe:${m[1]}`);
  return [...encontrados];
}

export function inventario(archivo) {
  const codigo = readFileSync(archivo, 'utf8');
  return {
    archivo,
    botones: textoDeBotones(codigo),
    callbacks: callbacksQueRecibe(codigo),
    aperturas: aperturas(codigo),
    escrituras: escrituras(codigo),
  };
}

function imprimir(inv) {
  console.log(`\n${path.relative(process.cwd(), inv.archivo)}`);
  for (const [rotulo, lista] of [
    ['botones   ', inv.botones],
    ['callbacks ', inv.callbacks],
    ['aperturas ', inv.aperturas],
    ['escrituras', inv.escrituras],
  ]) {
    if (lista.length) console.log(`  ${rotulo}  ${lista.join(' · ')}`);
  }
  if (!inv.botones.length && !inv.callbacks.length) {
    console.log('  (nada: las acciones pueden estar en subcomponentes de otros archivos)');
  }
}

/**
 * Normaliza para comparar: "Agregar insumo" y "✓ Agregar insumo" son la misma
 * accion, y una mayuscula de diferencia no es una accion perdida.
 */
const clave = (s) => s.toLocaleLowerCase('es-AR').replace(/[^a-záéíóúñ ]/g, '').trim();

export function comparar(viejo, nuevo, escribir = console.log) {
  escribir('\n─── lo que estaba y no esta ───────────────────────────────');
  let faltan = 0;
  for (const [rotulo, a, b] of [
    ['boton    ', viejo.botones, nuevo.botones],
    ['callback ', viejo.callbacks, nuevo.callbacks],
    ['apertura ', viejo.aperturas, nuevo.aperturas],
    ['escritura', viejo.escrituras, nuevo.escrituras],
  ]) {
    const presentes = new Set(b.map(clave));
    for (const x of a) {
      if (!presentes.has(clave(x))) { escribir(`  ✗ ${rotulo}  ${x}`); faltan += 1; }
    }
  }
  if (!faltan) {
    escribir('  nada. Igual miralo: esto lee texto, no entiende indirecciones.');
  } else {
    escribir(`\n  ${faltan} sin equivalente. Cada una es una pregunta, no un error:`);
    escribir('  ¿se movio a otro lado, se decidio sacarla, o se olvido?');
    escribir('  Las que se portan merecen un test; las que se sacan, una linea en el commit.');
  }
  return faltan;
}

// El CLI corre solo cuando se invoca el archivo directo. Importarlo desde un
// test no tiene que ejecutar nada ni llamar a process.exit.
const invocadoDirecto = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invocadoDirecto) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (!args.length) {
    console.error('uso: npm run pantalla:acciones -- <viejo.jsx> [nuevo.jsx]');
    process.exit(1);
  }
  const invs = args.map((a) => inventario(path.resolve(a)));
  invs.forEach(imprimir);
  if (invs.length === 2) comparar(invs[0], invs[1]);
  console.log('');
}
