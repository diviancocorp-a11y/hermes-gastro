// src/config/delivery.js
// Delivery method plugin registry.
// Configurable delivery options — each client can enable/disable and set pricing.

/**
 * @typedef {Object} DeliveryMethod
 * @property {string}  id       — unique key (matches form.delivery value)
 * @property {string}  label    — display name
 * @property {string}  icon     — emoji icon
 * @property {boolean} enabled  — whether to show in checkout
 * @property {string}  type     — 'pickup' | 'delivery' | 'shipping'
 * @property {Object}  [config] — method-specific settings
 */

/** @type {DeliveryMethod[]} */
const DELIVERY_METHODS = [
  {
    id: 'retiro',
    label: 'Retiro en local',
    icon: '🏠',
    type: 'pickup',
    enabled: true,
    config: {
      // Pickup-specific: no address needed
      requiresAddress: false,
    },
  },
  {
    id: 'envio',
    label: 'Delivery',
    icon: '🛵',
    type: 'delivery',
    enabled: true,
    config: {
      requiresAddress: true,
      freeAbove: 0,        // free delivery above this cart total (0 = never free)
      baseCost: 500,        // base delivery cost
      perKmCost: 200,       // cost per km
      maxDistanceKm: 15,    // max delivery radius
      estimateMinutes: 45,  // estimated delivery time
    },
  },
];

// ─── API ────────────────────────────────────────────────────

/** Get all enabled delivery methods */
export function getDeliveryMethods() {
  return DELIVERY_METHODS.filter(m => m.enabled);
}

/** Get a specific delivery method by id */
export function getDeliveryMethod(id) {
  return DELIVERY_METHODS.find(m => m.id === id) || null;
}

/** Check if a method requires an address */
export function requiresAddress(id) {
  const m = getDeliveryMethod(id);
  return m?.config?.requiresAddress ?? false;
}

/** Get delivery cost estimate for a method */
export function getDeliveryCost(id, distanceKm = 0, cartTotal = 0) {
  const m = getDeliveryMethod(id);
  if (!m || m.type === 'pickup') return 0;

  const cfg = m.config || {};
  if (cfg.freeAbove > 0 && cartTotal >= cfg.freeAbove) return 0;

  const base = cfg.baseCost || 0;
  const perKm = cfg.perKmCost || 0;
  return base + Math.ceil(distanceKm) * perKm;
}

/** Check if distance is within delivery range */
export function isWithinRange(id, distanceKm) {
  const m = getDeliveryMethod(id);
  if (!m || m.type === 'pickup') return true;
  return distanceKm <= (m.config?.maxDistanceKm ?? Infinity);
}

/**
 * Register or override a delivery method at runtime.
 * Used by delivery plugins (e.g., a Rappi/PedidosYa integration).
 */
export function registerDeliveryMethod(method) {
  const idx = DELIVERY_METHODS.findIndex(m => m.id === method.id);
  if (idx >= 0) {
    DELIVERY_METHODS[idx] = { ...DELIVERY_METHODS[idx], ...method };
  } else {
    DELIVERY_METHODS.push(method);
  }
}

/**
 * Enable/disable a delivery method by id.
 */
export function setDeliveryEnabled(id, enabled) {
  const m = getDeliveryMethod(id);
  if (m) m.enabled = enabled;
}

export { DELIVERY_METHODS };
