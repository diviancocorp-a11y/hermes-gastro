// clients/cochi/business.js
// ═══════════════════════════════════════════════════════════════
// Centralized business identity for COCHI
// Pork & grill restaurant — Venezuela
// ═══════════════════════════════════════════════════════════════

const business = {
  // ── Core identity ──────────────────────────────────────────
  name: 'Cochi',
  shortName: 'Cochi',
  tagline: '¡Qué bien se cochina aquí!',
  description: 'Restaurante de cerdo y parrilla artesanal. ¡Qué bien se cochina aquí!',
  logoLetter: 'C',
  logoColor: '#c91b14',

  // ── Location ───────────────────────────────────────────────
  address: {
    street: '',
    city: '',
    region: '',
    country: 'VE',
    postalCode: '',
  },
  geo: {
    lat: 10.4806,
    lng: -66.9036,
  },
  // ── Contact ────────────────────────────────────────────────
  phone: '',
  whatsapp: '',
  email: '',

  // ── Social & links ─────────────────────────────────────────
  website: '',
  instagram: '',
  facebook: '',

  // ── Financial ──────────────────────────────────────────────
  cbu: '',
  aliasMp: '',
  cuit: '',

  // ── Branding / UX ──────────────────────────────────────────
  branding: {
    mascotEmoji: '🐷',
    sound: '/oink.mp3',
    themeColorLight: '#c91b14',
    themeColorDark: '#221c1a',
    ogImage: '/og-image.png',
    accentColors: ['#c91b14', '#e3debe', '#221c1a', '#D84315', '#BF360C', '#4E342E', '#3E2723', '#FF5722', '#FF8A65', '#A1887F'],
  },
  // ── Locale ─────────────────────────────────────────────────
  locale: 'es-VE',
  timezone: 'America/Caracas',
  currency: 'VES',
  currencySymbol: 'Bs.',

  // ── Business type ──────────────────────────────────────────
  type: 'grill',
  schemaOrgType: 'Restaurant',
  cuisines: ['Cerdo', 'Parrilla', 'Comida Venezolana'],
  priceRange: '$$',

  // ── Operating hours ────────────────────────────────────────
  hours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '11:00', closes: '22:00' },
    { days: ['Saturday', 'Sunday'], opens: '11:00', closes: '23:00' },
  ],

  // ── Admin defaults ─────────────────────────────────────────
  defaultSettings: {
    biz_name: 'Cochi',
    logo_letter: 'C',
    logo_color: '#c91b14',
    cover_url: '',
    exp_cats: ['Materia Prima', 'Servicios', 'Packaging', 'Transporte', 'Alquiler', 'Equipamiento', 'Otros'],
    ing_cats: ['Carnes', 'Verduras', 'Condimentos', 'Bebidas', 'Packaging', 'Otros'],
    cat_images: {},
  },
  // ── Legal texts ────────────────────────────────────────────
  legal: {
    privacyUrl: '/privacidad',
    termsUrl: '/terminos',
    copyrightHolder: 'Cochi',
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