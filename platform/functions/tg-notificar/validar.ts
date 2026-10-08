// Validacion de `initData` de Telegram y utilidades puras de la integracion.
//
// Sin dependencias de Deno ni de Supabase a proposito: lo importa la edge
// function y tambien los tests (src/test/telegramFunctions.test.js), que son
// lo unico que nota si alguien rompe la comprobacion de firma.
//
// El algoritmo es el documentado por Telegram para Mini Apps:
//   secret = HMAC_SHA256(key = "WebAppData", msg = <token del bot>)
//   hash   = HMAC_SHA256(key = secret, msg = data_check_string)
// donde data_check_string son los campos de initData menos `hash`, ordenados
// por nombre y unidos como "clave=valor" con saltos de linea.
//
// Nada que venga de `initDataUnsafe` en el cliente es confiable: se puede
// escribir a mano. Lo unico que prueba quien es el usuario es esta firma.

const enc = new TextEncoder();

async function firmar(clave: BufferSource, datos: BufferSource): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey(
    "raw", clave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, datos));
}

export function aHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparacion en tiempo constante: no filtra cuantos caracteres coinciden. */
export function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export type UsuarioTelegram = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  allows_write_to_pm?: boolean;
};

export type ResultadoInitData =
  | { ok: true; user: UsuarioTelegram; authDate: number }
  | { ok: false; motivo: "faltan_datos" | "sin_hash" | "firma_invalida" | "vencido" | "sin_usuario" };

/**
 * @param maxEdadSeg  cuanto vale una firma. Un initData robado deja de servir
 *                    pasado este tiempo. 24 h es lo que recomienda Telegram.
 */
export async function validarInitData(
  initData: string,
  botToken: string,
  ahoraSeg: number = Math.floor(Date.now() / 1000),
  maxEdadSeg = 86400,
): Promise<ResultadoInitData> {
  if (!initData || !botToken) return { ok: false, motivo: "faltan_datos" };

  const p = new URLSearchParams(initData);
  const hash = p.get("hash");
  if (!hash) return { ok: false, motivo: "sin_hash" };
  p.delete("hash");

  const dataCheckString = [...p.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secreta = await firmar(enc.encode("WebAppData"), enc.encode(botToken));
  const calculado = aHex(await firmar(secreta, enc.encode(dataCheckString)));
  if (!iguales(calculado, hash.toLowerCase())) return { ok: false, motivo: "firma_invalida" };

  // Despues de la firma: la fecha tambien viaja firmada, no se puede falsear.
  const authDate = Number(p.get("auth_date"));
  if (!authDate || ahoraSeg - authDate > maxEdadSeg || authDate - ahoraSeg > 300) {
    return { ok: false, motivo: "vencido" };
  }

  let user: UsuarioTelegram | null = null;
  try { user = JSON.parse(p.get("user") || "null"); } catch { /* sin user */ }
  if (!user || typeof user.id !== "number") return { ok: false, motivo: "sin_usuario" };

  return { ok: true, user, authDate };
}

/**
 * Los ultimos 10 digitos: el mismo numero llega como 549351..., 351... o
 * 0351... segun quien lo escriba. Mismo criterio que
 * 20260708_phone_match_by_suffix. Devuelve null si no hay un telefono usable.
 */
export function ultimos10(telefono: unknown): string | null {
  const d = String(telefono ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-10) : null;
}

/** Nombre del secreto del bot de un negocio: crazy-miga -> TELEGRAM_BOT_TOKEN_CRAZYMIGA. */
export function nombreDelSecreto(slug: string): string {
  return `TELEGRAM_BOT_TOKEN_${String(slug).replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
}
