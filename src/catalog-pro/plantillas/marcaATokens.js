// src/catalog-pro/plantillas/marcaATokens.js
// Contrato de marca -> tokens del catalogo (--ac, --bg, --tx...). Puro.
//
// Solo emite las variables que la marca define: lo que falte lo hereda del
// tema del tenant (ambar | noche | carbon), asi la plantilla funciona sobre los
// tres sin pisarlos. Los colores derivados se calculan aca, en JS, para poder
// VERIFICAR el contraste (4.5:1) en vez de confiar en un color-mix a ciegas.

import { FUENTES } from '../../lib/plantillaListas';

const aRgb = (hex) => {
  const h = String(hex).replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const aHex = (rgb) => '#' + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

/** Mezcla `a` con `b`: `pct` (0-100) es el peso de `a`. */
export function mezclar(a, b, pct) {
  const A = aRgb(a), B = aRgb(b), p = pct / 100;
  return aHex(A.map((v, i) => v * p + B[i] * (1 - p)));
}

const luz = (hex) => {
  const [r, g, b] = aRgb(hex).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Razon de contraste WCAG entre dos colores #rrggbb. */
export function contraste(a, b) {
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Color de texto (casi negro o blanco) con mas contraste sobre `fondo`. */
export function textoSobre(fondo) {
  return contraste('#ffffff', fondo) >= contraste('#111111', fondo) ? '#ffffff' : '#111111';
}

const RADIOS = {
  recto: { '--rs': '0px', '--r': '0px', '--rl': '0px' },
  suave: { '--rs': '8px', '--r': '14px', '--rl': '24px' },
  pildora: { '--rs': '14px', '--r': '24px', '--rl': '36px' },
};

const CON_SERIF = ['Playfair Display', 'Source Serif 4', 'Instrument Serif', 'DM Serif Display', 'Lora'];
const familia = (nombre) => `'${nombre}', ${CON_SERIF.includes(nombre) ? 'Georgia, serif' : 'system-ui, sans-serif'}`;

// Base de cada tema del catalogo (copia de tokens.css; src/test/plantillaNucleo.test.js
// verifica que coincida). Sirve para calcular contrastes sobre lo que HEREDA la marca.
export const TEMAS_BASE = {
  ambar: { ac: '#F59E0B', bg: '#FFFFFF', tx: '#262626' },
  noche: { ac: '#E8B947', bg: '#161412', tx: '#F4EAD0' },
  carbon: { ac: '#2D1B0E', bg: '#FAF5EE', tx: '#1A1612' },
};

/**
 * @param {object} marca  config.marca ({primario, fondo, texto, acento2, fuente_*, radio})
 * @param {string} tema   tema del tenant (ambar | noche | carbon): lo que la marca no define
 * @returns {Record<string,string>} variables CSS para el `style` del wrapper
 */
export function marcaATokens(marca = {}, tema = 'ambar') {
  const base = TEMAS_BASE[tema] || TEMAS_BASE.ambar;
  const m = marca || {};
  const primario = m.primario || base.ac;
  const fondo = m.fondo || base.bg;
  const texto = m.texto || base.tx;
  const t = {};

  // Siempre: color del texto sobre el primario y primario usable como texto,
  // calculados con lo efectivo (marca o tema) para cumplir 4.5:1.
  t['--on-ac'] = textoSobre(primario);
  // Tambien sobre el gris de las tarjetas (--b2, 5% de texto sobre el fondo).
  t['--ac-text'] = contraste(primario, fondo) >= 4.5 && contraste(primario, mezclar(texto, fondo, 5)) >= 4.5 ? primario : texto;

  if (m.primario) {
    t['--ac'] = primario;
    t['--ac2'] = mezclar(primario, '#000000', 82);
    t['--al'] = mezclar(primario, '#ffffff', 12);
  }
  if (m.fondo || m.texto) {
    t['--bg'] = fondo;
    t['--tx'] = texto;
    t['--b2'] = mezclar(texto, fondo, 5);
    t['--b3'] = mezclar(texto, fondo, 9);
    t['--line'] = mezclar(texto, fondo, 18);
    const tenue = (piso) => {
      for (const pct of [72, 80, 88, 100]) { const c = mezclar(texto, fondo, pct); if (contraste(c, fondo) >= piso) return c; }
      return texto;
    };
    t['--t2'] = tenue(4.5);
    t['--t3'] = tenue(3);
  }
  if (m.primario || m.fondo) {
    t['--ac-soft'] = mezclar(primario, fondo, 14);
    t['--ac-soft-fg'] = t['--ac-text'];
  }
  if (m.acento2) {
    t['--pop-acento'] = m.acento2;
    t['--pop-on-acento'] = textoSobre(m.acento2);
  }
  if (m.fuente_titulo && FUENTES.includes(m.fuente_titulo)) t['--font-heading'] = familia(m.fuente_titulo);
  if (m.fuente_texto && FUENTES.includes(m.fuente_texto)) t['--font-body'] = familia(m.fuente_texto);
  if (m.radio && RADIOS[m.radio]) Object.assign(t, RADIOS[m.radio]);
  return t;
}

/** URL de Google Fonts solo con las familias que la marca usa (o null). */
export function urlFuentes(marca = {}) {
  const usadas = [...new Set([marca?.fuente_titulo, marca?.fuente_texto].filter(f => FUENTES.includes(f)))];
  if (!usadas.length) return null;
  const q = usadas.map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`).join('&');
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}
