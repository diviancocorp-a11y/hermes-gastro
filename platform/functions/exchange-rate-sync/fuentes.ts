// Fuentes de la tasa USD/VES y validacion. Puro, sin Deno ni Supabase: lo
// importa la edge function y los tests (src/test/exchangeRateSync.test.js).
//
// Primaria: bcv.org.ve, la fuente oficial. Su servidor manda la intermedia
// equivocada y el fetch normal falla ("unable to verify the first certificate"):
// se arma el cliente con la intermedia correcta (bcv-ca.ts), sin desactivar la
// verificacion. Respaldo: ve.dolarapi.com (agregador de una sola persona).

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

/** Home de bcv.org.ve: el bloque `id="dolar"` trae `<strong class="strong-tb">914,02180000</strong>`
 *  y despues "Fecha Valor" con `content="2026-11-16T00:00:00-04:00"` (el dia en que rige). */
export function parseBcv(html: string): TasaLeida | null {
  const bloque = String(html).match(/id="dolar"[\s\S]{0,900}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>([\s\S]{0,500})/i);
  const rate = numeroPositivo(bloque?.[1]);
  if (rate == null) return null;
  const f = String(bloque?.[2] ?? "").match(/content="(\d{4}-\d{2}-\d{2})T/);
  return { rate, fecha: f ? f[1] : null, source: "bcv" };
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

export type FilaTasa = {
  tenant_id: string; base_currency: string; quote_currency: string;
  rate: number; effective_date: string; source: string; created_by: null;
};

/**
 * Guarda la tasa solo si ese proveedor no tiene ya una para ese dia: la
 * primera lectura del dia gana (el BCV publica a la tarde la tasa del dia
 * habil siguiente; no debe pisar la de hoy). No usa upsert: PostgREST no
 * resuelve onConflict contra el indice parcial. 23505 (carrera con otra
 * corrida) cuenta como ya_estaba.
 * `sb` es el cliente de supabase-js; tipado minimo para poder testearlo.
 */
// deno-lint-ignore no-explicit-any
export async function guardarTasa(sb: any, f: FilaTasa): Promise<{ estado: "ok" | "ya_estaba" | "error"; error?: string }> {
  const { data: previa, error: e1 } = await sb.from("exchange_rates").select("id")
    .eq("tenant_id", f.tenant_id).eq("base_currency", f.base_currency).eq("quote_currency", f.quote_currency)
    .eq("effective_date", f.effective_date).eq("source", f.source).limit(1).maybeSingle();
  if (e1) return { estado: "error", error: e1.message };
  if (previa) return { estado: "ya_estaba" };
  const { error } = await sb.from("exchange_rates").insert(f);
  if (!error) return { estado: "ok" };
  return error.code === "23505" ? { estado: "ya_estaba" } : { estado: "error", error: error.message };
}

type Fuente = { nombre: string; leer: () => Promise<TasaLeida | null> };

// deno-lint-ignore no-explicit-any
async function traer(url: string, tipo: "json" | "text", client?: any) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(10000), headers: { "User-Agent": "dico-exchange-rate-sync" },
    ...(client ? { client } : {}),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return tipo === "json" ? r.json() : r.text();
}

/** BCV con la intermedia que le falta a su cadena (bcv-ca.ts), solo para este
 *  fetch y con la verificacion TLS activa. Si el runtime no tiene
 *  Deno.createHttpClient, lanza: tasaVigente lo anota y sigue con el respaldo. */
async function leerBcv(): Promise<TasaLeida | null> {
  // deno-lint-ignore no-explicit-any
  const deno = (globalThis as any).Deno;
  if (typeof deno?.createHttpClient !== "function") throw new Error("Deno.createHttpClient no disponible");
  const { BCV_CA_PEM } = await import("./bcv-ca.ts");
  const client = deno.createHttpClient({ caCerts: [BCV_CA_PEM] });
  try {
    return parseBcv(await traer("https://www.bcv.org.ve/", "text", client));
  } finally {
    client.close?.();
  }
}

/** Orden = prioridad: el BCV oficial primero, dolarapi de respaldo. */
export const FUENTES: Fuente[] = [
  { nombre: "bcv", leer: leerBcv },
  { nombre: "dolarapi", leer: async () => parseDolarApi(await traer("https://ve.dolarapi.com/v1/dolares/oficial", "json")) },
];

/** Diferencia relativa entre dos fuentes que se avisa en el resultado (1%). */
export const DIFERENCIA_AVISO = 0.01;

/**
 * Lee todas las fuentes. Gana la primera valida (por orden); si hay una
 * segunda valida, devuelve la diferencia entre ambas y un aviso si pasa 1%
 * (igual se guarda la primera). Una fuente con "Fecha Valor" posterior a hoy
 * (el BCV publica a la tarde la tasa del dia habil siguiente) todavia no rige:
 * se descarta y se sigue con la que sigue.
 */
export async function tasaVigente(ultima: number | null, fuentes: Fuente[] = FUENTES, hoy?: string) {
  const errores: string[] = [];
  const validas: TasaLeida[] = [];
  for (const f of fuentes) {
    try {
      const t = await f.leer();
      if (!t) { errores.push(`${f.nombre}: sin valor`); continue; }
      if (hoy && t.fecha && t.fecha > hoy) { errores.push(`${f.nombre}: rige desde ${t.fecha}, todavia no`); continue; }
      if (!variacionRazonable(t.rate, ultima)) { errores.push(`${f.nombre}: variacion fuera de rango (${t.rate} vs ${ultima})`); continue; }
      validas.push(t);
    } catch (e) {
      errores.push(`${f.nombre}: ${(e as Error).message}`);
    }
  }
  const [tasa, otra] = validas;
  if (!tasa) return { tasa: null, errores };
  if (!otra) return { tasa, errores };
  const diferencia = Math.abs(tasa.rate - otra.rate) / tasa.rate;
  return {
    tasa, errores,
    cruce: { contra: otra.source, rate: otra.rate, diferencia, aviso: diferencia > DIFERENCIA_AVISO },
  };
}
