/**
 * Dico Pet — el manifiesto del atlas.
 *
 * UNA SOLA IMAGEN Y ONCE FILAS. El pack anterior eran ocho renders sueltos, uno
 * por pose: ocho descargas, ocho encuadres que podian no coincidir y cero
 * movimiento. El atlas es un archivo, un encuadre garantizado por construccion
 * —todas las celdas miden lo mismo— y setenta y tres cuadros de animacion.
 *
 * LOS NUMEROS SALEN DE MEDIR, NO DE TANTEAR
 * `dico-pet-masters/validacion.json` los certifica: 1536x2288, 8 columnas por
 * 11 filas, cero residuo de croma y cero pixeles con alfa sucio. La celda cae
 * en 192x208 por division exacta. Si alguno de esos numeros cambia, el atlas
 * es otro y hay que volver a medir.
 *
 * POR QUE `cuadros` NO ES SIEMPRE 8
 * Las filas se llenan de izquierda a derecha y el resto queda transparente.
 * Animar las ocho columnas de `idle` dejaria dos cuadros vacios: Dico
 * desapareceria dos veces por vuelta.
 */

export const DICO_PET_MASTER = 'platform/brand/dico-pet-masters/dico-pet-atlas.png';
export const DICO_PET_RUNTIME = 'public/brand/dico/pet/dico-pet-atlas.webp';
export const DICO_PET_PUBLIC_PATH = '/brand/dico/pet/dico-pet-atlas.webp';

/** Certificado por `validacion.json`. Cambiarlos a mano no mueve la imagen. */
export const DICO_PET_ATLAS = Object.freeze({
  ancho: 1536,
  alto: 2288,
  columnas: 8,
  filas: 11,
  celdaAncho: 192,
  celdaAlto: 208,
  sha256: '06eb6420c3b776ab48b069c85e4ae86b60061100500d17876b72158946b8390e',
});

/**
 * Las filas del atlas, en su orden real.
 *
 * `cuadros` es cuantas columnas de esa fila tienen dibujo. `fps` sale del
 * ritmo que pide cada accion: un saludo lento se lee como duda y una carrera
 * lenta se lee como caminata.
 */
export const DICO_PET_FILAS = Object.freeze({
  idle:           Object.freeze({ fila: 0,  cuadros: 6, fps: 8,  bucle: true }),
  correDerecha:   Object.freeze({ fila: 1,  cuadros: 8, fps: 14, bucle: true }),
  correIzquierda: Object.freeze({ fila: 2,  cuadros: 8, fps: 14, bucle: true }),
  saluda:         Object.freeze({ fila: 3,  cuadros: 4, fps: 10, bucle: true }),
  salta:          Object.freeze({ fila: 4,  cuadros: 5, fps: 12, bucle: true }),
  falla:          Object.freeze({ fila: 5,  cuadros: 8, fps: 10, bucle: true }),
  espera:         Object.freeze({ fila: 6,  cuadros: 6, fps: 4,  bucle: false }),
  corre:          Object.freeze({ fila: 7,  cuadros: 6, fps: 14, bucle: true }),
  revisa:         Object.freeze({ fila: 8,  cuadros: 6, fps: 8,  bucle: true }),
  // Las dos filas de mirada NO se animan: cada celda es una direccion fija.
  miradaA:        Object.freeze({ fila: 9,  cuadros: 8, fps: 0,  bucle: false }),
  miradaB:        Object.freeze({ fila: 10, cuadros: 8, fps: 0,  bucle: false }),
});

/**
 * Las dieciseis direcciones de mirada, en grados desde arriba y en sentido
 * horario. Certificadas una por una en `dico-pet-masters/direcciones.json`.
 *
 * 0 es ARRIBA, no derecha: es el norte de una brujula, que es como lo
 * verifico el QA del pack.
 */
export const DICO_PET_MIRADA_PASO = 22.5;

export function celdaDeMirada(grados) {
  const g = ((Number(grados) || 0) % 360 + 360) % 360;
  const indice = Math.round(g / DICO_PET_MIRADA_PASO) % 16;
  return indice < 8
    ? { fila: DICO_PET_FILAS.miradaA.fila, columna: indice }
    : { fila: DICO_PET_FILAS.miradaB.fila, columna: indice - 8 };
}

/**
 * De la pose que pide el panel al cuadro del pet.
 *
 * EL VOCABULARIO DE ARRIBA NO CAMBIA. `physicalPose` tiene ocho valores y los
 * sigue teniendo: lo que cambia es que ahora resuelven a una fila del atlas en
 * vez de a un archivo. Cambiar el vocabulario habria obligado a tocar
 * `DicoPresence`, `DicoAvisos` y cada llamada del panel para ganar nada.
 *
 * `pointUp` y `pointDown` NO son senalar con el guante: el pet no tiene esa
 * pose. Son MIRAR arriba y abajo, que es la misma instruccion dada con los
 * ojos. En una moneda sin brazos levantados, la mirada dirige igual de bien y
 * no inventa una anatomia que el pack no tiene.
 */
export const DICO_PET_POR_POSE = Object.freeze({
  idle:      Object.freeze({ animacion: 'idle' }),
  explain:   Object.freeze({ animacion: 'saluda' }),
  thinking:  Object.freeze({ animacion: 'espera' }),
  worried:   Object.freeze({ animacion: 'revisa' }),
  success:   Object.freeze({ animacion: 'salta' }),
  error:     Object.freeze({ animacion: 'falla' }),
  pointUp:   Object.freeze({ mirada: 0 }),
  pointDown: Object.freeze({ mirada: 180 }),
});

/**
 * Acciones cortas que el pet puede encadenar cuando no esta atendiendo una
 * intervencion. No crean assets nuevos: componen las poses certificadas en
 * una rutina con pausas humanas, en vez de dejarlo clavado en idle.
 */
export const DICO_PET_ACCIONES = Object.freeze({
  respirar:    Object.freeze({ pose: 'idle', duracion: 3600 }),
  mirarArriba: Object.freeze({ pose: 'pointUp', duracion: 900 }),
  pausa:        Object.freeze({ pose: 'idle', duracion: 2400 }),
  mirarAbajo:   Object.freeze({ pose: 'pointDown', duracion: 900 }),
  pensar:      Object.freeze({ pose: 'thinking', duracion: 1800 }),
});

/** Orden de la rutina ambiental. Se detiene por completo con reduced motion. */
export const DICO_PET_RUTINA_VIVA = Object.freeze([
  'respirar',
  'mirarArriba',
  'pausa',
  'mirarAbajo',
  'pensar',
]);
