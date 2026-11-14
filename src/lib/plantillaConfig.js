// src/lib/plantillaConfig.js
// Contrato de la plantilla de catalogo por tenant (settings.catalog_template_config).
// Claves planas y pocas, listas cerradas: pensado para que un editor del panel
// pueda cargar el manual de marca de un negocio sin inventar estructura.
//
// Las listas viven tambien en SQL (private.valid_template_config, migracion
// 0128): src/test/plantillaConfigSync.test.js las compara. Si tocas una, tocas
// las dos. Documentacion y ejemplo completo: docs/plataforma/PLANTILLAS-CATALOGO.md

import { z } from 'zod';

export const PLANTILLAS = ['default', 'pop'];

/** Orden por defecto de la plantilla `pop`. El orden de `secciones` ES el de pantalla. */
export const SECCION_IDS = ['hero', 'cinta', 'favoritos', 'flyers', 'menu', 'submarca', 'banda', 'testimonios', 'historia'];

// Lista cerrada de Google Fonts: evita pedir fuentes arbitrarias y fija el peso de carga.
export const FUENTES = [
  'Montserrat', 'Inter', 'DM Sans', 'Poppins', 'Playfair Display',
  'Source Serif 4', 'Instrument Serif', 'DM Serif Display', 'Bebas Neue', 'Lora',
];
export const RADIOS = ['recto', 'suave', 'pildora'];

export const MARCA_COLORES = ['primario', 'fondo', 'texto', 'acento2'];
export const MARCA_URLS = ['logo_header', 'logo_footer', 'isotipo'];
export const TEXTO_KEYS = [
  'hero_eyebrow', 'hero_titulo', 'hero_lead', 'hero_cta', 'hero_nota', 'hero_sello', 'intro_caption',
  'favoritos_eyebrow', 'favoritos_titulo', 'favoritos_aside', 'flyers_eyebrow', 'flyers_titulo',
  'menu_eyebrow', 'menu_titulo', 'menu_lead', 'banda_eyebrow', 'banda_titulo', 'banda_texto', 'banda_imagen',
  'testimonios_eyebrow', 'testimonios_titulo', 'historia_eyebrow', 'historia_titulo', 'historia_texto', 'historia_sello',
];
export const SUBMARCA_KEYS = ['nombre', 'categoria', 'eyebrow', 'titulo', 'texto', 'fondo', 'color', 'logo', 'isotipo'];
export const FLYER_KEYS = ['titulo', 'texto', 'imagen', 'badge', 'link', 'desde', 'hasta', 'activo'];
export const QUOTE_KEYS = ['texto', 'nombre'];
export const TOP_KEYS = ['secciones', 'marca', 'textos', 'anuncios', 'cinta', 'intro', 'flyers', 'testimonios', 'submarca'];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const url = z.string().max(500).regex(/^(https:\/\/|\/)/);
const texto = z.string().max(400);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const frase = z.string().max(80);

export const PlantillaConfigSchema = z.object({
  secciones: z.array(z.object({ id: z.enum(SECCION_IDS), on: z.boolean().optional() }).strict()).max(12),
  marca: z.object({
    primario: hex, fondo: hex, texto: hex, acento2: hex,
    fuente_titulo: z.enum(FUENTES), fuente_texto: z.enum(FUENTES),
    radio: z.enum(RADIOS),
    logo_header: url, logo_footer: url, isotipo: url,
  }).partial().strict(),
  textos: z.object(Object.fromEntries(TEXTO_KEYS.map(k => [k, k === 'banda_imagen' ? url : texto]))).partial().strict(),
  anuncios: z.array(frase).max(12),
  cinta: z.array(frase).max(12),
  intro: z.boolean(),
  flyers: z.array(z.object({
    titulo: texto, texto, imagen: url, badge: texto, link: texto, desde: fecha, hasta: fecha, activo: z.boolean(),
  }).partial().strict()).max(8),
  testimonios: z.array(z.object({ texto, nombre: texto }).partial().strict()).max(8),
  submarca: z.object({
    nombre: texto, categoria: texto, eyebrow: texto, titulo: texto, texto,
    fondo: hex, color: hex, logo: url, isotipo: url,
  }).partial().strict(),
}).partial().strict();

/**
 * Lee la config que llega de get_catalog. Una config rota NUNCA tira:
 * devuelve `{}` (defaults de la plantilla) y el motivo en `error`, para que
 * el llamador lo reporte (Sentry) sin romper el catalogo.
 */
export function leerConfigPlantilla(raw) {
  if (raw == null || (typeof raw === 'object' && !Object.keys(raw).length)) return { config: {}, error: null };
  const r = PlantillaConfigSchema.safeParse(raw);
  if (r.success) return { config: r.data, error: null };
  return { config: {}, error: r.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') };
}

/** `default` para todo valor ausente o desconocido: el catalogo de hoy. */
export function resolverPlantilla(valor) {
  return PLANTILLAS.includes(valor) && valor !== 'default' ? valor : 'default';
}
