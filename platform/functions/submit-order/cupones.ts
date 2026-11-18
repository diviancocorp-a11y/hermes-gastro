// Cupones de submit-order: logica PURA (sin Deno ni Supabase).
//
// El servidor manda: este archivo decide si un cupon aplica y cuanto
// descuenta. El checkout tiene un espejo (src/lib/cupones.js) para MOSTRAR el
// descuento; un test compara los dos. El contador de usos NO se mira aca con
// autoridad: lo cuenta reservar_cupon (0144) con la fila tomada.

import { redondearMoneda } from "./montos.ts";

export type Cupon = {
  discount_type?: string | null;
  discount_pct?: number | string | null;
  discount_amount?: number | string | null;
  min_subtotal?: number | string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  email?: string | null;
  max_uses?: number | null;
  uses_count?: number | null;
  used?: boolean | null;
};

export type Motivo =
  | "no_existe" | "no_corresponde" | "todavia_no" | "vencido"
  | "agotado" | "limite_cliente" | "minimo";

export type Evaluacion =
  | { ok: true; descuento: number }
  | { ok: false; motivo: Motivo; minimo?: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Descuento de un cupon sobre el subtotal de productos.
 * - pct: subtotal * pct / 100, redondeado por moneda (ARS entero).
 * - fixed: el monto, nunca mas que el subtotal.
 * Un cupon sin columnas nuevas (los de antes de la 0144) es pct.
 */
export function descuentoDeCupon(c: Cupon, subtotal: number, moneda: string | null | undefined): number {
  const sub = Math.max(0, num(subtotal));
  if (c.discount_type === "fixed") {
    return redondearMoneda(Math.min(sub, Math.max(0, num(c.discount_amount))), moneda);
  }
  return redondearMoneda(sub * (num(c.discount_pct) / 100), moneda);
}

/** Todo lo que se puede juzgar sin tomar la fila: vigencia, email, usos vistos y minimo. */
export function evaluarCupon(
  c: Cupon | null | undefined,
  { subtotal, moneda, ahora = new Date(), email = null }: {
    subtotal: number; moneda: string | null | undefined; ahora?: Date; email?: string | null;
  },
): Evaluacion {
  if (!c) return { ok: false, motivo: "no_existe" };
  if (c.email && email && c.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, motivo: "no_corresponde" };
  }
  if (c.starts_at && new Date(c.starts_at) > ahora) return { ok: false, motivo: "todavia_no" };
  if (c.expires_at && new Date(c.expires_at) < ahora) return { ok: false, motivo: "vencido" };
  // max_uses undefined = fila de antes de la 0144: manda `used` (un solo uso).
  const maxUses = c.max_uses === undefined ? 1 : c.max_uses;
  const usos = c.uses_count == null ? (c.used ? 1 : 0) : num(c.uses_count);
  if (maxUses != null && usos >= maxUses) return { ok: false, motivo: "agotado" };
  const minimo = c.min_subtotal == null ? 0 : num(c.min_subtotal);
  if (minimo > 0 && num(subtotal) < minimo) return { ok: false, motivo: "minimo", minimo };
  return { ok: true, descuento: descuentoDeCupon(c, subtotal, moneda) };
}

/** Texto para el cliente. `montoTexto` formatea el minimo en la moneda principal. */
export function mensajeCupon(motivo: Motivo | string, minimoTexto = ""): string {
  switch (motivo) {
    case "no_existe": return "Ese cupón no existe.";
    case "no_corresponde": return "Ese cupón es personal y no corresponde a tu email.";
    case "todavia_no": return "Ese cupón todavía no está vigente.";
    case "vencido": return "Ese cupón está vencido.";
    case "agotado": return "Ese cupón ya alcanzó su límite de usos.";
    case "limite_cliente": return "Ya usaste este cupón el máximo de veces permitido.";
    case "minimo": return minimoTexto
      ? `Este cupón es para compras desde ${minimoTexto} en productos.`
      : "No alcanzás la compra mínima de este cupón.";
    default: return "No pudimos aplicar el cupón.";
  }
}

/** Monto para el mensaje del servidor. ARS como $ 5.000; el resto con su codigo y 2 decimales. */
export function textoMonto(n: number, moneda: string | null | undefined): string {
  if (!moneda || moneda === "ARS") return "$ " + Math.round(n).toLocaleString("es-AR");
  return `${moneda} ${num(n).toFixed(2)}`;
}
