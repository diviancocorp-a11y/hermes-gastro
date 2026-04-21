// src/config/payments.js
// Payment method plugin registry.
// Each client can enable/disable methods and configure provider details.
// The catalog checkout reads from this config instead of hardcoding.

/**
 * @typedef {Object} PaymentMethod
 * @property {string} id       — unique key (matches form.payment value)
 * @property {string} label    — display name
 * @property {string} icon     — emoji icon
 * @property {string} type     — 'cash' | 'transfer' | 'gateway'
 * @property {boolean} enabled — whether to show in checkout
 * @property {boolean} requiresReceipt — must upload comprobante
 * @property {Object} [config] — provider-specific settings
 */

/** @type {PaymentMethod[]} */
const PAYMENT_METHODS = [
  {
    id: 'efectivo',
    label: 'Efectivo',
    icon: '💵',
    type: 'cash',
    enabled: true,
    requiresReceipt: false,
    config: {
      askChange: true, // ask "con cuánto paga?"
    },
  },
  {
    id: 'transferencia',
    label: 'Transferencia bancaria',
    icon: '🏦',
    type: 'transfer',
    enabled: true,
    requiresReceipt: true,
    config: {
      bankName: '',     // set via business config or onboarding
      cbu: '',
      alias: '',
      holder: '',
    },
  },
  {
    id: 'mercadopago',
    label: 'MercadoPago',
    icon: '💳',
    type: 'gateway',
    enabled: false, // disabled by default — enable with API keys
    requiresReceipt: false,
    config: {
      publicKey: '',
      accessToken: '', // stored server-side only
      checkoutUrl: '', // optional: pre-built checkout link
    },
  },
];

// ─── API ────────────────────────────────────────────────────

/** Get all enabled payment methods */
export function getPaymentMethods() {
  return PAYMENT_METHODS.filter(m => m.enabled);
}

/** Get a specific payment method by id */
export function getPaymentMethod(id) {
  return PAYMENT_METHODS.find(m => m.id === id) || null;
}

/** Check if a payment method requires a receipt upload */
export function requiresReceipt(id) {
  const m = getPaymentMethod(id);
  return m?.requiresReceipt ?? false;
}

/** Check if a payment method is digital (transfer or gateway) */
export function isDigitalPayment(id) {
  const m = getPaymentMethod(id);
  return m?.type === 'transfer' || m?.type === 'gateway';
}

/** Check if payment method asks for change amount */
export function askForChange(id) {
  const m = getPaymentMethod(id);
  return m?.type === 'cash' && m?.config?.askChange;
}

/**
 * Register or override a payment method at runtime.
 * Used by payment plugins (e.g., a Stripe plugin) to inject themselves.
 */
export function registerPaymentMethod(method) {
  const idx = PAYMENT_METHODS.findIndex(m => m.id === method.id);
  if (idx >= 0) {
    PAYMENT_METHODS[idx] = { ...PAYMENT_METHODS[idx], ...method };
  } else {
    PAYMENT_METHODS.push(method);
  }
}

/**
 * Enable/disable a payment method by id.
 */
export function setPaymentEnabled(id, enabled) {
  const m = getPaymentMethod(id);
  if (m) m.enabled = enabled;
}

export { PAYMENT_METHODS };
