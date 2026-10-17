// Firma del webhook de GerenteDico.
//
// Mismo esquema que tg-webhook/firma.ts: Telegram manda de vuelta el
// `secret_token` que se fijo al registrar el webhook, en el header
// `X-Telegram-Bot-Api-Secret-Token`. Se DERIVA del token del bot, asi no hay un
// segundo secreto que cargar. Otro mensaje que el de tg-webhook para que una
// firma no sirva en la otra function.
//
//   HMAC_SHA256(key = GERENTEDICOBOT, msg = "dico-gerente-webhook") en hex
//
// platform/scripts/gerente-webhook.mjs usa la misma formula; hay un test que
// compara las dos.

const enc = new TextEncoder();

export async function firmaDelGerente(botToken: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw", enc.encode(botToken), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode("dico-gerente-webhook")));
  return [...firma].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparacion en tiempo constante (para el header de Telegram). */
export function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
