// clients/edificio/business.js
// ═══════════════════════════════════════════════════════════════
// El build del EDIFICIO (hermes-platform, multi-tenant). Un solo build sirve
// a todos los negocios: el tenant sale del hostname en runtime y cada uno
// pinta su nombre, colores y favicon desde la DB (src/lib/tenantHead.js).
// Lo de aca es solo lo que se ve ANTES de eso, y por eso es Dico y no un
// negocio: hasta el 27/sep/2026 era la identidad de Cochi y el manifest de
// todos los tenants decia "Cochi".
//   platform: true  -> catalog.js usa el RPC get_catalog(slug).
//   slug            -> fallback de local y de *.vercel.app, donde el host no
//                      dice el tenant. Tiene que ser un tenant que exista.
// ═══════════════════════════════════════════════════════════════

const business = {
  // ── Plataforma (edificio multi-tenant) ─────────────────────
  platform: true,
  slug: 'cochi',

  // ── Core identity ──────────────────────────────────────────
  name: 'Dico',
  shortName: 'Dico',
  tagline: '',
  description: 'Pedidos online y gestion para tu negocio.',
  logoLetter: 'D',
  logoColor: '#C45D3E',
  // Sin logo propio: el favicon queda en /favicon.svg y el manifest usa el
  // icono generico de la raiz.
  logoUrl: '',
  logoHorizontalUrl: '',
  logoWordmarkUrl: '',
  faviconUrl: '/icon-192.png',

  address: { street: '', city: '', region: '', country: 'AR', postalCode: '' },
  // Origen del calculo de envio (catalogConstants). Es UNO para todos los
  // tenants: el centro de Buenos Aires, igual que la busqueda de direcciones
  // del checkout. Antes eran las coordenadas de Cochi, en Caracas.
  geo: { lat: -34.6037, lng: -58.3816 },
  phone: '', whatsapp: '', email: '',
  website: '', instagram: '', facebook: '',
  cbu: '', aliasMp: '', cuit: '',

  branding: {
    mascotEmoji: '',
    sound: '',
    themeColorLight: '#C45D3E',
    themeColorDark: '#171513',
    ogImage: '',
    accentColors: ['#C45D3E'],
    catalogBg: '#FFF8F0',
    catalogCardBg: '#FFFFFF',
    catalogHeaderBg: '#FFFFFF',
    catalogTextOnBg: '#171513',
    catalogStickyBg: 'rgba(255,248,240,0.95)',
    catalogStickyText: '#171513',
  },

  locale: 'es-AR',
  timezone: 'America/Argentina/Buenos_Aires',
  currency: 'ARS',
  currencySymbol: '$',

  type: 'restaurant',
  schemaOrgType: 'Restaurant',
  cuisines: [],
  priceRange: '$$',

  hours: [],

  defaultSettings: {
    biz_name: 'Dico',
    logo_letter: 'D',
    logo_color: '#C45D3E',
    cover_url: '',
    exp_cats: ['Materia Prima', 'Servicios', 'Packaging', 'Transporte', 'Alquiler', 'Equipamiento', 'Otros'],
    ing_cats: ['Carnes', 'Verduras', 'Condimentos', 'Bebidas', 'Packaging', 'Otros'],
    cat_images: {},
  },
  dailyDeals: {},
  fallbackProducts: [],
  fallbackCategoryGroups: [],

  legal: {
    privacyUrl: '/privacidad',
    termsUrl: '/terminos',
    copyrightHolder: 'Divianco',
    copyrightYear: 2026,
  },
};

export default business;

export function waLink(message = '') {
  const encoded = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${business.whatsapp}${encoded}`;
}
export function telLink() {
  return `tel:${business.phone}`;
}
export function fullName(withTagline = false) {
  return withTagline ? `${business.name} — ${business.tagline}` : business.name;
}
