// src/services/featureFlags.js
// Feature flags del catalogo. Son constantes: el edificio no tiene tabla de
// flags. Hasta el 29/sep se leian de `feature_flags` (una tabla del modelo
// single-tenant) y en el edificio esa consulta daba un 404 en cada carga para
// terminar siempre en estos mismos valores.
//
// Si un flag tiene que variar por negocio, va en los settings del tenant
// (get_catalog), no en una tabla global.

const FLAGS = Object.freeze({
  RECIPES_WITH_INGREDIENTS: true,
  DELIVERY_ENABLED: true,
  SCHEDULING_ENABLED: true,
  GIFT_MODE: true,
  COUPONS: true,
  WHATSAPP: true,
  LOYALTY: false,
  REFERRAL: true,
  E_INVOICE: false,
  PUSH_NOTIFICATIONS: true,
  DAILY_DEALS: true,
});

/** Si un flag esta prendido. Uno desconocido cuenta como apagado. */
export function isEnabled(key) {
  return FLAGS[key] ?? false;
}
