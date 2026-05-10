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
