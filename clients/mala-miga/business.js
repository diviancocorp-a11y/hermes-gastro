// clients/mala-miga/business.js
// ═══════════════════════════════════════════════════════════════
// Centralized business identity for MALA MIGA
// Galletitas artesanales estilo americano — Argentina
// ═══════════════════════════════════════════════════════════════

const business = {
  // ─── Core identity ──────────────────────────────────────────
  name: 'Mala Miga',
  shortName: 'Mala Miga',
  tagline: 'Galletitas estilo americano',
  description: 'Galletitas artesanales estilo americano. Cookies, brownies y dulces de autor.',
  logoLetter: 'M',
  logoColor: '#5C3A21',

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
  branding: {
    mascotEmoji: '🍪',
    sound: '/quack.mp3',
    themeColorLight: '#5C3A21',
    themeColorDark: '#1A0F08',
    ogImage: '/og-image.png',
    accentColors: ['#5C3A21', '#C49A6C', '#8B5E34', '#3E2723', '#6D4C41', '#A1887F', '#D7A86E', '#F5DEB3', '#B7651E', '#4E342E'],
    catalogBg: '',
    catalogCardBg: '',
    catalogHeaderBg: '',
    catalogTextOnBg: '',
    catalogStickyBg: '',
    catalogStickyText: '',
  },

  // ─── Locale ─────────────────────────────────────────────────
  locale: 'es-AR',
  timezone: 'America/Argentina/Buenos_Aires',
  currency: 'ARS',
  currencySymbol: '$',

  // ─── Business type ──────────────────────────────────────────
  type: 'bakery',
  schemaOrgType: 'Bakery',
  cuisines: ['Galletitas', 'Cookies', 'Brownies', 'Pastelería americana'],
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
    logo_color: '#5C3A21',
    cover_url: '',
    exp_cats: ['Materia Prima', 'Servicios', 'Packaging', 'Transporte', 'Alquiler', 'Equipamiento', 'Otros'],
    ing_cats: ['Secos', 'Frescos', 'Chips & Toppings', 'Packaging', 'Otros'],
    cat_images: {},
  },

  // ─── Daily deals (empty = no deals)
  dailyDeals: {},

  // ─── Fallback products (empty = se cargan desde admin)
  fallbackProducts: [],

  // ─── Catalog category fallbacks ─────────────────────────────
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
    copyrightHolder: 'Mala Miga',
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
