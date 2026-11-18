// src/lib/cupones.js
// Espejo para MOSTRAR de platform/functions/submit-order/cupones.ts (un test
// los compara: src/test/cuponesAmpliados.test.js). El que decide es el
// servidor; esto solo calcula lo que el checkout le muestra al cliente.
import { redondearMoneda } from './moneda.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** pct sobre el subtotal (redondeo por moneda) o monto fijo acotado al subtotal. */
export function descuentoDeCupon(c, subtotal, moneda) {
  const sub = Math.max(0, num(subtotal));
  if (c?.discount_type === 'fixed') {
    return redondearMoneda(Math.min(sub, Math.max(0, num(c.discount_amount))), moneda);
  }
  return redondearMoneda(sub * (num(c?.discount_pct) / 100), moneda);
}

export function evaluarCupon(c, { subtotal, moneda, ahora = new Date(), email = null } = {}) {
  if (!c) return { ok: false, motivo: 'no_existe' };
  if (c.email && email && c.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, motivo: 'no_corresponde' };
  }
  if (c.starts_at && new Date(c.starts_at) > ahora) return { ok: false, motivo: 'todavia_no' };
  if (c.expires_at && new Date(c.expires_at) < ahora) return { ok: false, motivo: 'vencido' };
  const maxUses = c.max_uses === undefined ? 1 : c.max_uses;
  const usos = c.uses_count == null ? (c.used ? 1 : 0) : num(c.uses_count);
  if (maxUses != null && usos >= maxUses) return { ok: false, motivo: 'agotado' };
  const minimo = c.min_subtotal == null ? 0 : num(c.min_subtotal);
  if (minimo > 0 && num(subtotal) < minimo) return { ok: false, motivo: 'minimo', minimo };
  return { ok: true, descuento: descuentoDeCupon(c, subtotal, moneda) };
}

export function mensajeCupon(motivo, minimoTexto = '') {
  switch (motivo) {
    case 'no_existe': return 'Ese cupón no existe.';
    case 'no_corresponde': return 'Ese cupón es personal y no corresponde a tu email.';
    case 'todavia_no': return 'Ese cupón todavía no está vigente.';
    case 'vencido': return 'Ese cupón está vencido.';
    case 'agotado': return 'Ese cupón ya alcanzó su límite de usos.';
    case 'limite_cliente': return 'Ya usaste este cupón el máximo de veces permitido.';
    case 'minimo': return minimoTexto
      ? `Este cupón es para compras desde ${minimoTexto} en productos.`
      : 'No alcanzás la compra mínima de este cupón.';
    default: return 'No pudimos aplicar el cupón.';
  }
}

/** Etiqueta corta del cupon: "-10%" o "-$5.00" (con el texto de la moneda que pase el que llama). */
export function etiquetaCupon(c, textoMonto) {
  if (!c) return '';
  if (c.discount_type === 'fixed') return `-${textoMonto ? textoMonto(num(c.discount_amount)) : num(c.discount_amount)}`;
  return `-${num(c.discount_pct)}%`;
}
