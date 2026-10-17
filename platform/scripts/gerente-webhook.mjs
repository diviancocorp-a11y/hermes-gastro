#!/usr/bin/env node
// platform/scripts/gerente-webhook.mjs
//
// Le dice a Telegram que lo que recibe GerenteDico vaya a la edge function
// gerente-webhook, o muestra como esta configurado.
//
// Lo corre el workflow "GerenteDico webhook" de GitHub, que ya tiene el token
// en el secret GERENTEDICOBOT. A mano (el token nunca se imprime):
//
//   PowerShell:
//     $env:GERENTEDICOBOT = "<token de BotFather>"
//     node platform/scripts/gerente-webhook.mjs            # registrar
//     node platform/scripts/gerente-webhook.mjs --info     # solo mirar
//     node platform/scripts/gerente-webhook.mjs --borrar   # dejar de recibir
//
// secret_token: se DERIVA del token, igual que en
// platform/functions/gerente-webhook/firma.ts (un test compara las dos).

import { createHmac } from "node:crypto";

const URL_FUNCTION = "https://wwwzdgprsooyjgkuyoav.supabase.co/functions/v1/gerente-webhook";

export function firmaDelGerente(token) {
  return createHmac("sha256", token).update("dico-gerente-webhook").digest("hex");
}

async function telegram(token, metodo, cuerpo = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}

async function main() {
  const token = process.env.GERENTEDICOBOT?.trim();
  if (!token) {
    console.error("Falta GERENTEDICOBOT en el entorno.");
    return 1;
  }

  if (process.argv.includes("--info")) {
    const r = await telegram(token, "getWebhookInfo");
    if (!r.ok) { console.error("Telegram rechazo la consulta:", r.description); return 1; }
    const i = r.result;
    console.log("URL registrada:          ", i.url || "(ninguna)");
    console.log("Coincide con la esperada:", i.url === URL_FUNCTION ? "si" : "NO");
    console.log("Updates pendientes:      ", i.pending_update_count);
    console.log("Ultimo error:            ", i.last_error_message || "ninguno");
    return 0;
  }

  if (process.argv.includes("--borrar")) {
    const r = await telegram(token, "deleteWebhook", { drop_pending_updates: false });
    console.log(r.ok ? "Webhook borrado." : `Telegram rechazo: ${r.description}`);
    return r.ok ? 0 : 1;
  }

  const r = await telegram(token, "setWebhook", {
    url: URL_FUNCTION,
    secret_token: firmaDelGerente(token),
    allowed_updates: ["message"],
    // Lo viejo que haya quedado esperando no se contesta: el bot no escuchaba.
    drop_pending_updates: true,
  });
  if (!r.ok) {
    console.error(`Telegram rechazo el webhook: ${r.description}`);
    return 1;
  }
  console.log(`Webhook de GerenteDico registrado: ${URL_FUNCTION}`);
  return 0;
}

const ES_MAIN = process.argv[1]?.replace(/\\/g, "/").endsWith("platform/scripts/gerente-webhook.mjs");
if (ES_MAIN) process.exitCode = await main();
