// src/lib/plantillaListas.js
// Listas cerradas del contrato de la plantilla, SIN dependencias. Viven aparte de
// plantillaConfig.js (que trae Zod) para que el chunk de la plantilla no arrastre
// a Zod: asi el catalogo de los demas tenants no baja un archivo mas. Se comparan
// contra private.valid_template_config en src/test/plantillaConfigSync.test.js.

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
