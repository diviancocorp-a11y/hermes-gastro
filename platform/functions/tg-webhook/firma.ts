// Firma del webhook de Telegram.
//
// Telegram permite fijar un `secret_token` al registrar el webhook y lo manda de
// vuelta en el header `X-Telegram-Bot-Api-Secret-Token` en cada llamada. Sin
// esto, cualquiera que conozca la URL de la function podria hacerse pasar por
// Telegram (por ejemplo, mandar un "Aceptar" falso).
//
// Se DERIVA del token del bot en vez de guardarse aparte: no hay un segundo
// secreto que cargar ni que perder. El script que registra el webhook usa la
// misma formula (platform/scripts/telegram-webhook.mjs); hay un test que
// compara las dos.
//
//   HMAC_SHA256(key = <token del bot>, msg = "dico-tg-webhook") en hexadecimal
//
// Hexadecimal porque Telegram solo acepta A-Z a-z 0-9 _ - en el secret_token.

const enc = new TextEncoder();

export async function firmaDeWebhook(botToken: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw", enc.encode(botToken), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode("dico-tg-webhook")));
  return [...firma].map((b) => b.toString(16).padStart(2, "0")).join("");
}
