// src/services/theme.js
// Variables CSS de :root (--bg, --ac, --font-*...) para las superficies del
// catalogo que no viven dentro de .cp-root (seguimiento de pedido, cuenta).
// El tema de catalog-pro NO sale de aca: sale de get_catalog (catalog_theme)
// y lo aplica applyCatalogTheme en lib/tenantHead.js.
//
// Hasta el 29/sep este tema se leia de `theme_config`, una tabla del modelo
// single-tenant. En el edificio esa consulta daba un 404 en cada carga y
// terminaba siempre en DEFAULT_THEME, que es lo que hoy se aplica directo.

/** Default theme (matches legacy.css :root values) */
export const DEFAULT_THEME = Object.freeze({
  // Light palette (Nona Pato artesanal terracotta/crema)
  color_bg: '#FBF7F2', color_bg2: '#F3EDE4', color_bg3: '#FFFFFF',
  color_tx: '#2D1B0E', color_t2: '#6B5744', color_t3: '#9C8B7A',
  color_accent: '#C45D3E', color_accent_light: '#FFF0EB',
  // Typography
  font_heading: 'DM Serif Display',
  font_body: 'DM Sans',
  font_url: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap',
  // Radii
  radius_sm: 10, radius_base: 16, radius_lg: 24,
});

/**
 * Apply theme config to CSS custom properties on :root.
 * Handles the palette, fonts, and radii.
 */
export function applyTheme(theme = DEFAULT_THEME) {
  const root = document.documentElement;
  const s = root.style;

  // Light palette → :root vars
  s.setProperty('--bg', theme.color_bg);
  s.setProperty('--b2', theme.color_bg2);
  s.setProperty('--b3', theme.color_bg3);
  s.setProperty('--tx', theme.color_tx);
  s.setProperty('--t2', theme.color_t2);
  s.setProperty('--t3', theme.color_t3);
  s.setProperty('--ac', theme.color_accent);
  s.setProperty('--al', theme.color_accent_light);

  // Radii
  s.setProperty('--r', `${theme.radius_base}px`);
  s.setProperty('--rs', `${theme.radius_sm}px`);

  // Fonts
  s.setProperty('--font-body', `'${theme.font_body}', sans-serif`);
  s.setProperty('--font-heading', `'${theme.font_heading}', serif`);

  // Load Google Fonts if URL changed
  loadFontUrl(theme.font_url);
}

const APPLIED_ROOT_PROPERTIES = [
  '--bg', '--b2', '--b3', '--tx', '--t2', '--t3', '--ac', '--al',
  '--r', '--rs', '--font-body', '--font-heading',
];

/** Remove the root theme before a platform/admin surface takes over. */
export function clearAppliedTheme() {
  if (typeof document === 'undefined') return;
  const style = document.documentElement.style;
  APPLIED_ROOT_PROPERTIES.forEach((property) => style.removeProperty(property));
  document.getElementById('theme-font-link')?.remove();
}

/** Inject a <link> for Google Fonts if not already present */
function loadFontUrl(url) {
  if (!url) return;
  const existing = document.querySelector(`link[href="${url}"]`);
  if (existing) return;
  // Remove old custom font link
  const old = document.getElementById('theme-font-link');
  if (old) old.remove();
  const link = document.createElement('link');
  link.id = 'theme-font-link';
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}
