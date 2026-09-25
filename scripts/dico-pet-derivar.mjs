#!/usr/bin/env node
/**
 * Dico Pet: atlas master PNG -> runtime WebP lossless.
 *
 *   node scripts/dico-pet-derivar.mjs          # escribe el derivado
 *   node scripts/dico-pet-derivar.mjs --check  # no escribe: falla si difiere
 *
 * EL MASTER ES INMUTABLE Y SE COMPRUEBA POR HASH. El pack trae su propio
 * sha256 en `validacion.json` y el manifiesto lo repite. Si alguien reexporta
 * el atlas "igual pero mejor", el hash cambia y el gate lo dice antes de que
 * las celdas se corran medio pixel y Dico empiece a temblar en pantalla.
 *
 * EL DERIVADO ES LOSSLESS Y SE VERIFICA PIXEL A PIXEL. Un atlas con perdida
 * mancha los bordes de cada celda: al recortar por `background-position` esa
 * mugre aparece como un halo del cuadro de al lado. No es una preferencia de
 * calidad, es la diferencia entre que el recorte funcione o no.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import decodeWebp, { init as initWebpDecoder } from '@jsquash/webp/decode.js';
import encodeWebp, { init as initWebpEncoder } from '@jsquash/webp/encode.js';
import { simd } from 'wasm-feature-detect';
import { PNG } from 'pngjs';
import {
  DICO_PET_ATLAS,
  DICO_PET_MASTER,
  DICO_PET_RUNTIME,
  DICO_PET_FILAS,
} from '../platform/brand/dico-pet-assets.mjs';

export const DICO_PET_WEBP_OPTIONS = Object.freeze({
  lossless: 1,
  exact: 1,
  method: 6,
  quality: 100,
});

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

let inicializacion;

async function iniciarCodecs() {
  if (!inicializacion) {
    inicializacion = (async () => {
      const paquete = dirname(fileURLToPath(import.meta.resolve('@jsquash/webp/encode.js')));
      const encoder = await simd() ? 'webp_enc_simd.wasm' : 'webp_enc.wasm';
      await initWebpEncoder(await WebAssembly.compile(readFileSync(join(paquete, 'codec', 'enc', encoder))));
      await initWebpDecoder(await WebAssembly.compile(readFileSync(join(paquete, 'codec', 'dec', 'webp_dec.wasm'))));
    })();
  }
  await inicializacion;
}

function leerPng(archivo) {
  const imagen = PNG.sync.read(readFileSync(archivo));
  return { data: Buffer.from(imagen.data), width: imagen.width, height: imagen.height };
}

async function leerWebp(archivo) {
  await iniciarCodecs();
  const imagen = await decodeWebp(readFileSync(archivo));
  return { data: Buffer.from(imagen.data), width: imagen.width, height: imagen.height };
}

/**
 * La geometria del atlas no se declara: se comprueba contra la imagen.
 *
 * Una celda de 192x208 sale de dividir 1536 por 8 y 2288 por 11. Si el master
 * cambia de tamanio, esa division deja de ser exacta y cada cuadro queda
 * corrido respecto del anterior. Es el error que mas caro sale porque no
 * rompe nada: solo se ve como un temblor.
 */
export function revisarGeometria({ width, height }, atlas = DICO_PET_ATLAS) {
  const problemas = [];
  if (width !== atlas.ancho || height !== atlas.alto) {
    problemas.push(`el atlas mide ${width}x${height} y el manifiesto dice ${atlas.ancho}x${atlas.alto}`);
  }
  if (width % atlas.columnas !== 0 || height % atlas.filas !== 0) {
    problemas.push(`${width}x${height} no se divide exacto en ${atlas.columnas}x${atlas.filas}`);
  }
  const celdaAncho = width / atlas.columnas;
  const celdaAlto = height / atlas.filas;
  if (celdaAncho !== atlas.celdaAncho || celdaAlto !== atlas.celdaAlto) {
    problemas.push(`la celda da ${celdaAncho}x${celdaAlto} y el manifiesto dice ${atlas.celdaAncho}x${atlas.celdaAlto}`);
  }
  for (const [nombre, fila] of Object.entries(DICO_PET_FILAS)) {
    if (fila.fila >= atlas.filas) problemas.push(`la fila ${nombre} apunta a ${fila.fila} y solo hay ${atlas.filas}`);
    if (fila.cuadros > atlas.columnas) problemas.push(`${nombre} declara ${fila.cuadros} cuadros y la fila tiene ${atlas.columnas}`);
  }
  return { ok: problemas.length === 0, problemas };
}

export async function derivarPet({ check = false } = {}) {
  const master = join(RAIZ, DICO_PET_MASTER);
  const runtime = join(RAIZ, DICO_PET_RUNTIME);
  if (!existsSync(master)) throw new Error(`No existe el master ${DICO_PET_MASTER}`);

  const bytesMaster = readFileSync(master);
  const hash = sha256(bytesMaster);
  if (hash !== DICO_PET_ATLAS.sha256) {
    throw new Error(`El master cambio. sha256 ${hash}, el manifiesto espera ${DICO_PET_ATLAS.sha256}`);
  }

  const imagen = leerPng(master);
  const geometria = revisarGeometria(imagen);
  if (!geometria.ok) throw new Error(`Geometria invalida:\n  ${geometria.problemas.join('\n  ')}`);

  if (check) {
    if (!existsSync(runtime)) throw new Error(`Falta el derivado ${DICO_PET_RUNTIME}`);
    const derivado = await leerWebp(runtime);
    if (derivado.width !== imagen.width || derivado.height !== imagen.height) {
      throw new Error(`El derivado mide ${derivado.width}x${derivado.height} y el master ${imagen.width}x${imagen.height}`);
    }
    if (Buffer.compare(derivado.data, imagen.data) !== 0) {
      throw new Error('El derivado no decodifica igual al master pixel a pixel');
    }
    return { ok: true, master: DICO_PET_MASTER, runtime: DICO_PET_RUNTIME, bytes: null, hash };
  }

  await iniciarCodecs();
  const codificado = Buffer.from(await encodeWebp(
    { data: imagen.data, width: imagen.width, height: imagen.height },
    DICO_PET_WEBP_OPTIONS,
  ));

  // Se comprueba ANTES de escribir: un derivado roto en disco es peor que no
  // tenerlo, porque el gate siguiente lo da por bueno si nadie vuelve a mirar.
  const verificacion = await decodeWebp(codificado);
  if (Buffer.compare(Buffer.from(verificacion.data), imagen.data) !== 0) {
    throw new Error('El WebP codificado no vuelve a dar el master; no se escribio nada');
  }

  mkdirSync(dirname(runtime), { recursive: true });
  writeFileSync(runtime, codificado);
  return { ok: true, master: DICO_PET_MASTER, runtime: DICO_PET_RUNTIME, bytes: codificado.length, hash };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  derivarPet({ check: process.argv.includes('--check') })
    .then((r) => {
      const peso = r.bytes ? ` (${(r.bytes / 1024).toFixed(0)} KB)` : '';
      console.log(`✓ atlas del pet al dia${peso}`);
    })
    .catch((e) => { console.error(e.message); process.exitCode = 1; });
}
