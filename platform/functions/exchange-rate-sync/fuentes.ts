// Fuentes de la tasa USD/VES y validacion. Puro, sin Deno ni Supabase: lo
// importa la edge function y los tests (src/test/exchangeRateSync.test.js).
//
// Primaria: ve.dolarapi.com (JSON, sirve bien por HTTPS). Respaldo: bcv.org.ve,
// la fuente oficial, pero su certificado llega con la cadena incompleta y el
// fetch de Deno lo rechaza ("unable to verify the first certificate", visto el
// 13/nov/2026), asi que solo sirve si algun dia lo arreglan.

export type TasaLeida = { rate: number; fecha: string | null; source: string };

/** Numero positivo y finito, o null. Acepta "911,62430000" y "1.234,56". */
export function numeroPositivo(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else {
    const s = String(v ?? "").trim();
    if (!s) return null;
    n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  }
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** ve.dolarapi.com/v1/dolares/oficial -> { promedio, fechaActualizacion }. */
export function parseDolarApi(json: unknown): TasaLeida | null {
  const j = json as Record<string, unknown> | null;
  const rate = numeroPositivo(j?.promedio);
  if (rate == null) return null;
  const f = String(j?.fechaActualizacion ?? "").match(/^\d{4}-\d{2}-\d{2}/);
  return { rate, fecha: f ? f[0] : null, source: "dolarapi" };
}

/** Home de bcv.org.ve: el bloque `id="dolar"` trae <strong> 911,62430000 </strong>. */
export function parseBcv(html: string): TasaLeida | null {
  const bloque = String(html).match(/id="dolar"[\s\S]{0,600}?<strong>\s*([\d.,]+)\s*<\/strong>/i);
  const rate = numeroPositivo(bloque?.[1]);
  return rate == null ? null : { rate, fecha: null, source: "bcv" };
}

/** Variacion maxima aceptada contra la ultima tasa (20%): el bolivar se mueve
 *  de a poco; un salto mayor es un parseo roto o un dato basura. */
export const VARIACION_MAXIMA = 0.2;

export function variacionRazonable(nueva: number, ultima: number | null): boolean {
  if (!(nueva > 0)) return false;
  if (ultima == null || !(ultima > 0)) return true;
  return Math.abs(nueva - ultima) / ultima <= VARIACION_MAXIMA;
}

/** Dia (YYYY-MM-DD) en la zona dada. */
export function diaEnZona(ahora: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

type Fuente = { nombre: string; leer: () => Promise<TasaLeida | null> };

async function traer(url: string, tipo: "json" | "text") {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "dico-exchange-rate-sync" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return tipo === "json" ? r.json() : r.text();
}

export const FUENTES: Fuente[] = [
  { nombre: "dolarapi", leer: async () => parseDolarApi(await traer("https://ve.dolarapi.com/v1/dolares/oficial", "json")) },
  { nombre: "bcv", leer: async () => parseBcv(await traer("https://www.bcv.org.ve/", "text")) },
];

/** Primera fuente que responde con un valor valido y razonable. */
export async function tasaVigente(ultima: number | null, fuentes: Fuente[] = FUENTES) {
  const errores: string[] = [];
  for (const f of fuentes) {
    try {
      const t = await f.leer();
      if (!t) { errores.push(`${f.nombre}: sin valor`); continue; }
      if (!variacionRazonable(t.rate, ultima)) { errores.push(`${f.nombre}: variacion fuera de rango (${t.rate} vs ${ultima})`); continue; }
      return { tasa: t, errores };
    } catch (e) {
      errores.push(`${f.nombre}: ${(e as Error).message}`);
    }
  }
  return { tasa: null, errores };
}
