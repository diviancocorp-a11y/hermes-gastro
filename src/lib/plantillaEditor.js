// src/lib/plantillaEditor.js
// Logica pura del editor de marca de la plantilla (sin React, sin red).
// El borrador del editor es la misma forma que `catalog_template_config`;
// aca se limpia (se sacan los vacios), se valida por campo con el mismo Zod
// que lee el catalogo y se calculan los avisos de contraste.
//
// Contrato: ver plantillaConfig.js y private.valid_template_config (0128).

import { PlantillaConfigSchema, MARCA_COLORES } from './plantillaConfig';
import { contraste, mezclar, TEMAS_BASE } from '../catalog-pro/plantillas/marcaATokens';

const vacio = (v) => v == null || (typeof v === 'string' && v.trim() === '');

/** Saca recursivamente cadenas vacias y objetos/listas que quedan vacios. */
function podar(v) {
  if (Array.isArray(v)) return v.map(podar).filter(x => !(x && typeof x === 'object' && !Object.keys(x).length));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (vacio(x)) continue;
      const p = podar(x);
      if (p && typeof p === 'object' && !Array.isArray(p) && !Object.keys(p).length) continue;
      out[k] = p;
    }
    return out;
  }
  return typeof v === 'string' ? v.trim() : v;
}

/**
 * Borrador -> config lista para guardar. Lo ya cargado y valido no cambia:
 * podar es idempotente sobre una config sin vacios (regresion de Cochi).
 */
export function borradorAConfig(borrador) {
  const limpio = podar(borrador || {});
  // Una lista vacia que ya estaba guardada se respeta ([] y ausente se pintan
  // igual, pero asi guardar sin tocar nada no cambia la config).
  return limpio;
}

/** Ruta de zod -> clave del campo del editor ("marca.primario", "flyers.0.imagen"). */
const rutaDe = (path) => path.join('.');

const MENSAJES = {
  'marca.primario': 'Usá un color con formato #RRGGBB, por ejemplo #EB140C.',
  'marca.fondo': 'Usá un color con formato #RRGGBB.',
  'marca.texto': 'Usá un color con formato #RRGGBB.',
  'marca.acento2': 'Usá un color con formato #RRGGBB.',
};

function mensajeDe(issue) {
  const ruta = rutaDe(issue.path);
  if (MENSAJES[ruta]) return MENSAJES[ruta];
  if (/(logo|isotipo|imagen)/.test(ruta)) return 'La imagen tiene que ser un archivo subido o un enlace que empiece con https://.';
  if (issue.code === 'too_big') return `Es demasiado largo (máximo ${issue.maximum}).`;
  if (issue.code === 'invalid_enum_value') return 'Elegí una opción de la lista.';
  if (/(desde|hasta)$/.test(ruta)) return 'Usá una fecha válida.';
  return 'Este valor no es válido.';
}

/**
 * Valida el borrador con el mismo esquema que lee el catalogo.
 * @returns {{ ok: boolean, config: object, errores: Record<string,string> }}
 *  errores: ruta de campo -> mensaje en español claro.
 */
export function validarBorrador(borrador) {
  const config = borradorAConfig(borrador);
  const r = PlantillaConfigSchema.safeParse(config);
  if (r.success) return { ok: true, config: r.data, errores: {} };
  const errores = {};
  for (const i of r.error.issues) {
    const clave = rutaDe(i.path);
    if (!errores[clave]) errores[clave] = mensajeDe(i);
  }
  return { ok: false, config, errores };
}

/**
 * Traduce el rechazo del servidor (check settings_catalog_template_config_check)
 * a un mensaje que el dueño entienda. El servidor no dice QUE campo falla:
 * el mensaje va al formulario entero y el cliente ya valido campo por campo.
 */
export function mensajeDeServidor(message = '') {
  if (/settings_catalog_template_config_check|valid_template_config/.test(message)) {
    return 'El servidor no aceptó la configuración. Revisá los campos marcados o que ningún texto supere el largo permitido.';
  }
  if (/row-level security|permission denied|only_owner|solo_duenio/i.test(message)) {
    return 'Solo el dueño del negocio puede cambiar la plantilla del catálogo.';
  }
  return 'No se pudo guardar. Probá de nuevo.';
}

const AA = 4.5;

/**
 * Avisos de contraste de la marca (WCAG AA 4.5:1), sobre lo efectivo: lo que
 * la marca no define lo hereda del tema. No bloquean el guardado: marcaATokens
 * ya corrige el texto sobre el primario; avisan cuando la marca elegida da
 * un resultado poco legible.
 * @returns {Array<{campo:string, ratio:number, mensaje:string}>}
 */
export function avisosDeContraste(marca = {}, tema = 'ambar') {
  const base = TEMAS_BASE[tema] || TEMAS_BASE.ambar;
  const m = marca || {};
  const fondo = m.fondo || base.bg;
  const texto = m.texto || base.tx;
  const primario = m.primario || base.ac;
  const avisos = [];
  const r1 = contraste(texto, fondo);
  if (r1 < AA) avisos.push({ campo: 'marca.texto', ratio: r1, mensaje: `El texto sobre el fondo no llega a AA (${r1.toFixed(1)}:1, hace falta 4,5:1). Oscurecé el texto o aclarás el fondo.` });
  const r2 = contraste(primario, fondo);
  if (r2 < 3) avisos.push({ campo: 'marca.primario', ratio: r2, mensaje: `El color principal casi no se distingue del fondo (${r2.toFixed(1)}:1). Los botones y los precios se van a leer mal.` });
  else if (r2 < AA && contraste(primario, mezclar(texto, fondo, 5)) < AA) {
    avisos.push({ campo: 'marca.primario', ratio: r2, mensaje: `Como texto, el color principal no llega a AA (${r2.toFixed(1)}:1). El catálogo lo reemplaza por el color del texto cuando va sobre el fondo.` });
  }
  return avisos;
}

/** Igualdad estructural de configs (para saber si hay cambios sin guardar). */
export function configsIguales(a, b) {
  return JSON.stringify(borradorAConfig(a)) === JSON.stringify(borradorAConfig(b));
}

export { MARCA_COLORES };
