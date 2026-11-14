// src/catalog-pro/plantillas/seccionesVisibles.js
// Que secciones de la plantilla se pintan y en que orden. Puro.
//
// - El orden de `config.secciones` ES el de pantalla; `on: false` la saca.
// - Sin `secciones`, valen todas en el orden de SECCION_IDS.
// - El menu no se puede apagar: si falta, se agrega al final.
// - Una seccion sin datos se oculta sola (flyers vencidos, testimonios vacios).
// - Vigencias y dias van en la zona horaria del negocio, no del navegador.

import { SECCION_IDS } from '../../lib/plantillaConfig';

/** 'YYYY-MM-DD' de `ahora` en `zona`. */
export function hoyEnZona(zona = 'America/Caracas', ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** Dia de la semana (0 = domingo) en `zona`. */
export function diaEnZona(zona = 'America/Caracas', ahora = new Date()) {
  const corto = new Intl.DateTimeFormat('en-US', { timeZone: zona, weekday: 'short' }).format(ahora);
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[corto];
}

export function flyerVigente(flyer, hoy) {
  if (!flyer || flyer.activo === false) return false;
  if (flyer.desde && hoy < flyer.desde) return false;
  if (flyer.hasta && hoy > flyer.hasta) return false;
  return true;
}

export function flyersVigentes(config = {}, zona, ahora = new Date()) {
  const hoy = hoyEnZona(zona, ahora);
  return (config.flyers || []).filter(f => flyerVigente(f, hoy));
}

const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

/**
 * Estado de un producto en la portada, segun sus catalog_attributes.
 * El agotado por stock NO entra aca: lo decide Catalog (soldOutIds).
 * @returns {{puede:boolean, tipo:'ok'|'soon'|'day', etiqueta:string}}
 */
export function disponibilidadDePortada(attrs = {}, zona, ahora = new Date()) {
  if (attrs?.coming_soon) return { puede: false, tipo: 'soon', etiqueta: 'PRÓXIMAMENTE' };
  const dias = Array.isArray(attrs?.days) ? attrs.days : [];
  if (dias.length && !dias.includes(diaEnZona(zona, ahora))) {
    return { puede: false, tipo: 'day', etiqueta: `SOLO ${[...dias].sort().map(d => DIAS[d]).join(' / ')}` };
  }
  return { puede: true, tipo: 'ok', etiqueta: '' };
}

/**
 * @param {object} config  config de la plantilla ya leida
 * @param {object} datos   { favoritos:number, submarcaProductos:number } cantidades ya calculadas
 */
export function seccionesVisibles(config = {}, datos = {}, zona, ahora = new Date()) {
  const lista = Array.isArray(config.secciones) && config.secciones.length
    ? config.secciones
    : SECCION_IDS.map(id => ({ id, on: true }));
  const vistos = new Set();
  const ids = [];
  for (const s of lista) {
    if (!s || vistos.has(s.id)) continue;
    vistos.add(s.id);
    if (s.on !== false) ids.push(s.id);
  }
  if (!ids.includes('menu')) ids.push('menu');

  const t = config.textos || {};
  const tieneDatos = {
    hero: true,
    menu: true,
    cinta: (config.cinta || []).length > 0,
    favoritos: (datos.favoritos || 0) > 0,
    flyers: flyersVigentes(config, zona, ahora).length > 0,
    submarca: Boolean(config.submarca?.nombre) && (datos.submarcaProductos || 0) > 0,
    banda: Boolean(t.banda_titulo),
    testimonios: (config.testimonios || []).some(q => q?.texto),
    historia: Boolean(t.historia_titulo || t.historia_texto),
  };
  return ids.filter(id => tieneDatos[id]);
}
