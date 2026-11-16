// Montos y doble moneda de submit-order: logica PURA (sin Deno ni Supabase).
//
// La prueba la corre vitest (src/test/submitOrderFx.test.js) y el front tiene
// un espejo (src/lib/moneda.js) que otro test compara contra esto. El cliente
// nunca manda ni decide la tasa: sale de exchange_rates, del lado servidor.

export type FilaTasa = {
  rate: number | string; effective_date: string; source?: string | null; created_at?: string | null;
};
export type Tasa = { rate: number; fecha: string };
export type Congelada = {
  fx_rate: number; fx_currency: string; total_secondary: number;
  fecha: string; estado: "ok" | "vencida";
};

/** 2 decimales, mitad hacia arriba en valor absoluto (igual que redondear() de src/lib/moneda.js). */
export function redondear(n: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const signo = x < 0 ? -1 : 1;
  return signo * Math.round((Math.abs(x) + Number.EPSILON) * 100) / 100;
}

const esArs = (moneda: string | null | undefined) => !moneda || moneda === "ARS";

/**
 * Redondeo de un monto de pedido (cupon, propina, precio del dia, envio).
 * ARS: entero, EXACTAMENTE como el Math.round que habia (los pesos no tienen
 * centavos utiles). Cualquier otra moneda: 2 decimales.
 */
export function redondearMoneda(n: number, moneda: string | null | undefined): number {
  return esArs(moneda) ? Math.round(n) : redondear(n);
}

/** Cierra una suma de montos: ARS queda como sale (no se toca), el resto a 2 decimales. */
export function cerrarTotal(n: number, moneda: string | null | undefined): number {
  return esArs(moneda) ? n : redondear(n);
}

const dia = (d: Date, zona: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const aDias = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86400000; };

/** Espejo de tasaVencida() de src/lib/moneda.js: mas de `maxDias` dias calendario en la zona del local. */
export function tasaVencida(fecha: string | null | undefined, hoy = new Date(), zona = "America/Caracas", maxDias = 3): boolean {
  if (!fecha) return true;
  const desde = String(fecha).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return true;
  let hoyYmd: string;
  try { hoyYmd = dia(hoy, zona); } catch { hoyYmd = dia(hoy, "America/Caracas"); }
  return aDias(hoyYmd) - aDias(desde) > maxDias;
}

/**
 * La tasa vigente entre varias filas: fecha mas reciente, a igual fecha la
 * manual, a igual todo la mas nueva. Mismo orden que get_exchange_rate (0126).
 */
export function elegirTasa(filas: FilaTasa[] | null | undefined): Tasa | null {
  const validas = (filas || []).filter((f) => Number(f?.rate) > 0 && f?.effective_date);
  if (!validas.length) return null;
  validas.sort((a, b) => {
    const fa = String(a.effective_date).slice(0, 10), fb = String(b.effective_date).slice(0, 10);
    if (fa !== fb) return fa < fb ? 1 : -1;
    const ma = a.source === "manual" ? 1 : 0, mb = b.source === "manual" ? 1 : 0;
    if (ma !== mb) return mb - ma;
    return String(b.created_at || "") < String(a.created_at || "") ? -1 : 1;
  });
  return { rate: Number(validas[0].rate), fecha: String(validas[0].effective_date).slice(0, 10) };
}

/**
 * Congela la tasa del pedido. Sin tasa devuelve null (el pedido entra igual,
 * sin fx_*); con tasa vencida se congela igual y el estado lo avisa.
 */
export function congelarTasa(
  total: number, tasa: Tasa | null, secundaria: string, hoy = new Date(), zona = "America/Caracas",
): Congelada | null {
  if (!tasa || !(tasa.rate > 0)) return null;
  return {
    fx_rate: tasa.rate,
    fx_currency: secundaria,
    total_secondary: redondear(total * tasa.rate),
    fecha: tasa.fecha,
    estado: tasaVencida(tasa.fecha, hoy, zona) ? "vencida" : "ok",
  };
}

/** Datos extra de una cuenta de pago (pago movil, etc.): hasta 6 filas {label, value} de texto corto. */
export function limpiarDetalles(v: unknown): { label: string; value: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { label: string; value: string }[] = [];
  for (const d of v) {
    if (out.length >= 6) break;
    const label = typeof d?.label === "string" ? d.label.trim().slice(0, 40) : "";
    const value = typeof d?.value === "string" ? d.value.trim().slice(0, 80) : "";
    if (label && value) out.push({ label, value });
  }
  return out;
}

/** Moneda de una cuenta: codigo de 3 letras o null. */
export function limpiarMoneda(v: unknown): string | null {
  return typeof v === "string" && /^[A-Z]{3}$/.test(v) ? v : null;
}
