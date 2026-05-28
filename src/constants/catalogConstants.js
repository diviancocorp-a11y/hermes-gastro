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

export const calcDeliveryCost = (km) => {
  if (km <= 2) return 500;
  if (km <= 5) return 1000;
  if (km <= 10) return 1800;
  if (km <= 15) return 2500;
  if (km <= 25) return 3500;
  return 5000;
};

export const CHECKOUT_STEPS = ["Datos", "Entrega", "Pago", "Resumen"];

export const DEFAULT_FORM = { name: "", phone: "", email: "", birth_date: "", delivery: "retiro", payment: "efectivo", address: "", address_piso: "", address_notas: "", note: "", is_gift: false, gift_note: "", delivery_date: "", delivery_time: "", change_amount: "justo" };
