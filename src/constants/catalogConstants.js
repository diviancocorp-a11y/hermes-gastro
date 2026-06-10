// ── Shared constants for the catalog ──
import business from '@business';

export const avatarColors = business.branding.accentColors;

// Category groups from per-client business config (dynamic override from DB via categories.js)
export const CAT_GROUPS = (business.fallbackCategoryGroups || []).map(g => ({
  name: g.name,
  icon: g.icon,
  subs: g.subcategories || [],
}));

export const SUB_TO_PARENT = {};
CAT_GROUPS.forEach(g => g.subs.forEach(s => { SUB_TO_PARENT[s] = g.name; }));

// Daily deals: map day-of-week to category names (per-client, empty = no deals)
export const DAILY_DEALS = business.dailyDeals || {};
export const DEAL_PCT = 15;

export const fallbackSettings = {
  biz_name: business.name,
  logo_letter: business.logoLetter,
  logo_color: business.logoColor,
  cover_url: business.defaultSettings.cover_url,
};

export const fallbackProducts = business.fallbackProducts || [];

export const STORE_LAT = business.geo.lat;
export const STORE_LNG = business.geo.lng;

export const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// Escalones default — fallback si el tenant no configuro settings.delivery_pricing.
// max_km null = "el resto" (distancias mayores al ultimo escalon).
export const DEFAULT_DELIVERY_PRICING = [
  { max_km: 2,  cost: 500 },
  { max_km: 5,  cost: 1000 },
  { max_km: 10, cost: 1800 },
  { max_km: 15, cost: 2500 },
  { max_km: 25, cost: 3500 },
  { max_km: null, cost: 5000 },
];

/**
 * Costo de envio por distancia. `pricing` viene de settings.delivery_pricing
 * (configurable por tenant en Personalizacion); si falta o es invalida usa
 * DEFAULT_DELIVERY_PRICING.
 */
export const calcDeliveryCost = (km, pricing = null) => {
  const table = Array.isArray(pricing) && pricing.length > 0
    && pricing.every(s => s && typeof s.cost === 'number' && s.cost >= 0)
    ? pricing
    : DEFAULT_DELIVERY_PRICING;
  // Ordenar por max_km asc, null (resto) al final
  const sorted = [...table].sort((a, b) => {
    if (a.max_km == null) return 1;
    if (b.max_km == null) return -1;
    return a.max_km - b.max_km;
  });
  for (const step of sorted) {
    if (step.max_km == null || km <= step.max_km) return step.cost;
  }
  return sorted[sorted.length - 1]?.cost ?? 0;
};

export const CHECKOUT_STEPS = ["Datos", "Entrega", "Pago"];

export const DEFAULT_FORM = { name: "", phone: "", email: "", birth_date: "", delivery: "retiro", payment: "efectivo", payment_account_id: null, address: "", address_piso: "", address_notas: "", note: "", is_gift: false, gift_note: "", delivery_date: "", delivery_time: "", change_amount: "justo" };
