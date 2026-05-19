// src/hooks/useTheme.js
// Applies the per-tenant brand palette as CSS custom properties on :root,
// so every admin/catalog component (login button, store logo, cards, etc.)
// picks up the correct color from `clients/<CLIENT>/business.js`.
import { useState, useEffect, useCallback } from 'react';
import business from '@business';

const THEME = 'light';

/** "#RRGGBB" → "r,g,b" so we can build rgba(...) at runtime. */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '196,93,62';
  const h = hex.replace('#', '');
  if (h.length !== 6) return '196,93,62';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

/** Build a light tint of a hex color by mixing with white. */
function lightTint(hex, alpha = 0.12) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb},${alpha})`;
}

export default function useTheme() {
  const [theme] = useState(THEME);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', THEME);

    // ── Inject brand colors from business config ─────────────
    const accent = business.logoColor || '#C45D3E';
    const accentRgb = hexToRgb(accent);

    // Primary accent (buttons, logo bg, active states)
    root.style.setProperty('--ac', accent);
    root.style.setProperty('--ac-rgb', accentRgb);
    // Light tint of the accent (subtle backgrounds, hover)
    root.style.setProperty('--al', lightTint(accent, 0.12));
    // Optional: theme color from PWA branding
    if (business.branding?.themeColorLight) {
      root.style.setProperty('--brand-light', business.branding.themeColorLight);
    }
    if (business.branding?.themeColorDark) {
      root.style.setProperty('--brand-dark', business.branding.themeColorDark);
    }

    // Body background stays the cream default unless the tenant overrides
    document.body.style.background = '#FBF7F2';
  }, []);

  const setTheme = useCallback(() => {}, []);
  const toggleTheme = useCallback(() => {}, []);
  const isDark = false;
  return { theme, setTheme, toggleTheme, isDark };
}
