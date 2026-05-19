// clients/mala-miga/business.js
// ═══════════════════════════════════════════════════════════════
// MALA MIGA — Pastelería artesanal de inspiración Pop Art
// Identidad oficial v1.0 (mayo 2026). Manual completo en
// ./brand-manual.html — consultar antes de cambiar paleta/typo.
// ═══════════════════════════════════════════════════════════════

const business = {
  // ─── Core identity ──────────────────────────────────────────
  name: 'Mala Miga',
  shortName: 'Mala Miga',
  tagline: 'a sweet little obsession',
  description: 'Pastelería artesanal de inspiración Pop Art. Cookies, brownies y dulces de autor horneados en lotes pequeños.',
  logoLetter: 'M',
  logoColor: '#F3A39E', // Rosa Chicle Pop — color de énfasis del logo
  faviconUrl: '/clients/mala-miga/favicon.svg',

  // ─── Location ───────────────────────────────────────────────
  address: {
    street: '',
    city: '',
    region: '',
    country: 'AR',
    postalCode: '',
  },
  geo: {
    lat: -34.6037,
    lng: -58.3816,
  },

  // ─── Contact ────────────────────────────────────────────────
  phone: '',
  whatsapp: '',
  email: '',

  // ─── Social & links ─────────────────────────────────────────
  website: '',
  instagram: '',
  facebook: '',

  // ─── Financial ──────────────────────────────────────────────
  cbu: '',
  aliasMp: '',
  cuit: '',

  // ─── Branding / UX ──────────────────────────────────────────
  // Paleta oficial del manual de marca v1.0 — cinco colores, cero negociables.
  //   #3D2314 Chocolate Profundo  — estructural, fondos, tipografía base
  //   #F3A39E Rosa Chicle Pop     — énfasis, logotipo, detalles
  //   #1EA896 Turquesa            — contraste complementario, acentos
  //   #D4A744 Mostaza Cálido      — acento sutil (nunca protagonista)
  //   #FFF8E7 Crema Suave         — fondo luminoso de soporte
  branding: {
    mascotEmoji: '🍪',
    sound: '/quack.mp3',
    themeColorLight: '#F3A39E', // PWA theme: rosa chicle
    themeColorDark: '#3D2314',  // PWA theme dark: chocolate profundo
    ogImage: '/og-image.png',
    // Tipografías oficiales (cargar en index.html o vía CSS @import)
    displayFont: "'Fraunces', Georgia, serif",
    bodyFont: "'DM Sans', system-ui, sans-serif",
    handwrittenFont: "'Caveat', cursive",
    // Paleta para categorías y acentos visuales — orden por jerarquía del manual
    accentColors: [
      '#F3A39E', // Rosa Chicle Pop (signature)
      '#3D2314', // Chocolate Profundo
      '#1EA896', // Turquesa / Teal
      '#D4A744', // Mostaza Cálido
      '#e88a85', // pink-deep (hover/active)
      '#178a7c', // teal-deep
      '#b88a2a', // mustard-deep
      '#5a3624', // chocolate-soft
      '#fbf3dc', // paper (cards alt)
      '#f5ecd2', // cream-warm
    ],
    // Catalog theming — fondo crema luminoso con header chocolate y acento rosa
    catalogBg: '#FFF8E7',                    // Crema Suave
    catalogCardBg: '#fbf3dc',                // Paper (cards con calidez)
    catalogHeaderBg: '#3D2314',              // Header chocolate (hero band)
    catalogTextOnBg: '#FFF8E7',              // Texto crema sobre el header
    catalogStickyBg: 'rgba(61,35,20,0.95)',  // Sticky filter bar chocolate translúcido
    catalogStickyText: '#F3A39E',            // Texto rosa chicle sobre sticky
  },

  // ─── Locale ─────────────────────────────────────────────────
  locale: 'es-AR',
  timezone: 'America/Argentina/Buenos_Aires',
  currency: 'ARS',
  currencySymbol: '$',

  // ─── Business type ──────────────────────────────────────────
  type: 'bakery',
  schemaOrgType: 'Bakery',
  cuisines: ['Pastelería', 'Cookies', 'Brownies', 'Pastelería americana'],
  priceRange: '$$',

  // ─── Operating hours ────────────────────────────────────────
  hours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '10:00', closes: '20:00' },
    { days: ['Saturday'], opens: '10:00', closes: '18:00' },
  ],

  // ─── Admin defaults ─────────────────────────────────────────
  defaultSettings: {
    biz_name: 'Mala Miga',
    logo_letter: 'M',
    logo_color: '#F3A39E',
    cover_url: '',
    exp_cats: ['Materia Prima', 'Servicios', 'Packaging', 'Transporte', 'Alquiler', 'Equipamiento', 'Otros'],
    ing_cats: ['Secos', 'Frescos', 'Chips & Toppings', 'Packaging', 'Otros'],
    cat_images: {},
  },

  // ─── Daily deals (vacío por ahora; se configura desde admin/SQL en settings.daily_deals)
  dailyDeals: {},

  // ─── Fallback products (se cargan desde admin)
  fallbackProducts: [],

  // ─── Catalog category fallbacks (matchea con seed en DB) ────
  fallbackCategoryGroups: [
    { name: 'Cookies Clásicas',     icon: '🍪', subcategories: ['Chocolate Chip', 'Doble Choc', 'Avena'], sort_order: 0 },
    { name: 'Cookies de Autor',     icon: '✨', subcategories: ['Edición Limitada', 'Estacional'],       sort_order: 1 },
    { name: 'Brownies & Blondies',  icon: '🍫', subcategories: ['Brownies', 'Blondies'],                 sort_order: 2 },
    { name: 'Cajas & Combos',       icon: '🎁', subcategories: ['Cajas', 'Combos'],                      sort_order: 3 },
    { name: 'Bebidas',              icon: '🥛', subcategories: ['Frías', 'Calientes'],                   sort_order: 4 },
  ],

  // ─── Legal texts ────────────────────────────────────────────
  legal: {
    privacyUrl: '/privacidad',
    termsUrl: '/terminos',
    copyrightHolder: 'Mala Miga · Divianco',
    copyrightYear: 2026,
  },
};

export default business;

// ── Convenience helpers ──────────────────────────────────────

/** Build a WhatsApp deep-link with optional pre-filled message */
export function waLink(message = '') {
  const encoded = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${business.whatsapp}${encoded}`;
}

/** Build a tel: link */
export function telLink() {
  return `tel:${business.phone}`;
}

/** Get the full business name, optionally with tagline */
export function fullName(withTagline = false) {
  return withTagline ? `${business.name} — ${business.tagline}` : business.name;
}
