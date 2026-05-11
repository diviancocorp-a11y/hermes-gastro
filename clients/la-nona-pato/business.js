// src/config/business.js
// ═══════════════════════════════════════════════════════════════
// Centralized business identity — the ONLY place where brand-specific
// information lives. When cloning this template for a new client,
// edit this file (or override via DB settings at runtime).
// ═══════════════════════════════════════════════════════════════

const business = {
  // ─── Core identity ──────────────────────────────────────────
  name: 'La Nona Pato',
  shortName: 'Nona Pato',
  tagline: 'Panadería & Rotisería Artesanal',
  description: 'Panadería, rotisería y pastelería artesanal con delivery en Pilar, Buenos Aires.',
  logoLetter: 'N',
  logoColor: '#C45D3E',

  // ─── Location ───────────────────────────────────────────────
  address: {
    street: 'Andrés Chazarreta 1435',
    city: 'Pilar',
    region: 'Buenos Aires',
    country: 'AR',
    postalCode: '',
  },
  geo: {
    lat: -34.4295,
    lng: -58.7267,
  },

  // ─── Contact ────────────────────────────────────────────────
  phone: '+5491112345678',
  whatsapp: '5491165706805',
  email: '',

  // ─── Social & links ─────────────────────────────────────────
  website: 'https://lanonapato.com',
  instagram: '',
  facebook: '',

  // ─── Financial ──────────────────────────────────────────────
  cbu: '',
  aliasMp: '',
  cuit: '',

  // ─── Branding / UX ─────────────────────────────────────────
  branding: {
    mascotEmoji: '🦆',
    sound: '/quack.mp3',
    themeColorLight: '#C45D3E',
    themeColorDark: '#1A1210',
    ogImage: '/og-image.png',
    accentColors: ['#C45D3E', '#3A7D44', '#8D6E00', '#5C6BC0', '#AB47BC', '#00897B', '#D84315', '#6D4C41', '#546E7A', '#7B1FA2'],
    // Catalog page theming (neutral defaults — no colored bg)
    catalogBg: '',                  // empty = use default --bg
    catalogCardBg: '',              // empty = use default --b3
    catalogHeaderBg: '',            // empty = use default --bg
    catalogTextOnBg: '',            // empty = use default --tx
    catalogStickyBg: '',
    catalogStickyText: '',
  },

  // ─── Locale ─────────────────────────────────────────────────
  locale: 'es-AR',
  timezone: 'America/Argentina/Buenos_Aires',
  currency: 'ARS',
  currencySymbol: '$',

  // ─── Business type (used by onboarding/template) ────────────
  type: 'bakery',
  schemaOrgType: 'Bakery',
  cuisines: ['Panadería', 'Rotisería', 'Pastelería'],
  priceRange: '$$',

  // ─── Operating hours ────────────────────────────────────────
  hours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '20:00' },
    { days: ['Saturday'], opens: '09:00', closes: '14:00' },
  ],

  // ─── Admin defaults ─────────────────────────────────────────
  defaultSettings: {
    biz_name: 'La Nona Pato',
    logo_letter: 'N',
    logo_color: '#C45D3E',
    cover_url: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=800&q=80',
    exp_cats: ['Materia Prima', 'Servicios', 'Packaging', 'Transporte', 'Alquiler', 'Equipamiento', 'Otros'],
    ing_cats: ['Secos', 'Frescos', 'Packaging', 'Otros'],
    cat_images: {},
  },

  // ─── Daily deals: day-of-week → category names with discount ──
  dailyDeals: {
    1: ['La Nona Amasó', 'La Mesa Principal'],
    2: ['La Última Mordida'],
    3: ['El Sanguche de la Nona', 'Primeros Mimos'],
    4: ['Cocina Consciente', 'Primeros Mimos'],
  },

  // ─── Fallback products (shown when DB is empty) ──
  fallbackProducts: [
    { id: 'r1', name: 'Alfajores de Maicena', category: 'Alfajores', sale_price: 6500, image_url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=300&q=80', description: 'Caja x12. Clásicos alfajores artesanales.' },
    { id: 'r2', name: 'Torta de Chocolate', category: 'Tortas', sale_price: 18000, image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9ba9?auto=format&fit=crop&w=300&q=80', description: 'Torta húmeda de chocolate con ganache.' },
    { id: 'r3', name: 'Cheesecake Frutos Rojos', category: 'Tortas', sale_price: 15000, image_url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=300&q=80', description: 'Cheesecake cremoso con salsa de frutos rojos.' },
    { id: 'r4', name: 'Budín de Limón', category: 'Budines', sale_price: 5500, image_url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=300&q=80', description: 'Budín esponjoso con glaseado cítrico.' },
  ],

  // ─── Catalog category fallbacks (used when DB table is empty) ──
  fallbackCategoryGroups: [
    { name: 'Primeros Mimos',         icon: '🫕', subcategories: ['Brusquetas', 'Escabeches', 'Aperitivos'], sort_order: 0 },
    { name: 'La Mesa Principal',      icon: '🍕', subcategories: ['Rotisería', 'Pizzas'],                   sort_order: 1 },
    { name: 'El Sanguche de la Nona', icon: '🥪', subcategories: ['Sandwiches'],                           sort_order: 2 },
    { name: 'La Nona Amasó',          icon: '🥖', subcategories: ['Panadería', 'Panificados'],             sort_order: 3 },
    { name: 'La Última Mordida',      icon: '🍰', subcategories: ['Tortas', 'torta', 'Budines', 'Alfajores'], sort_order: 4 },
    { name: 'Cocina Consciente',      icon: '🥗', subcategories: ['Saludable'],                            sort_order: 5 },
  ],

  // ─── Legal texts ────────────────────────────────────────────
  legal: {
    privacyUrl: '/privacidad',
    termsUrl: '/terminos',
    copyrightHolder: 'La Nona Pato',
    copyrightYear: 2026,
  },
};

export default business;

// ─── Convenience helpers ──────────────────────────────────────

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
