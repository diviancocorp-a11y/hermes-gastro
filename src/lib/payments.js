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

// Devuelve el subset de medios visibles en el catálogo público.
// Se intersecta con la lista master (payment_methods) por si la master cambió
// y el catálogo quedó referenciando un método que ya no existe.
// Default cuando settings.catalog_payment_methods es undefined: TODOS los del master.
export function catalogPaymentMethods(settings) {
  const master = enabledPaymentMethods(settings);
  const catalogList = settings?.catalog_payment_methods;
  if (!Array.isArray(catalogList)) return master; // default: todos
  return catalogList.filter(m => master.includes(m));
}
