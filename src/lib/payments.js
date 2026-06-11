// src/lib/payments.js
// Single source of truth para etiquetas e iconos de medios de pago.
// Usado por Gastos, Compras, Pedidos, MonthSummary, etc.

export const PAYMENT_LABELS = {
  efectivo:      { label: "Efectivo",      icon: "💵" },
  transferencia: { label: "Transferencia", icon: "🏦" },
  mercadopago:   { label: "MercadoPago",   icon: "💳" },
  tarjeta:       { label: "Tarjeta",       icon: "💳" },
};

export const PAYMENT_PRESET_KEYS = Object.keys(PAYMENT_LABELS);

export const DEFAULT_PAYMENT_METHODS = ["efectivo", "transferencia", "mercadopago"];

export function paymentLabel(key) {
  if (!key) return "";
  return PAYMENT_LABELS[key]?.label
    || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

export function paymentIcon(key) {
  return PAYMENT_LABELS[key]?.icon || "🏷️";
}

// Devuelve la lista de medios habilitados desde settings (con fallback)
export function enabledPaymentMethods(settings) {
  const list = settings?.payment_methods;
  return Array.isArray(list) && list.length > 0 ? list : DEFAULT_PAYMENT_METHODS;
}

// catalogPaymentMethods() ELIMINADA (unificacion de pagos, jun 2026):
// el checkout deriva todo de settings.payment_accounts (efectivo implicito +
// MP + cuentas con scope checkout/ambos). settings.catalog_payment_methods y
// settings.payment_methods quedaron deprecados; enabledPaymentMethods() solo
// sobrevive para el form de pedido manual del admin y data historica.
