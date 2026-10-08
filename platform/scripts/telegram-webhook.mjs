#!/usr/bin/env node
// platform/scripts/telegram-webhook.mjs
//
// Le dice a Telegram a que URL mandar lo que recibe el bot de un negocio, o
// muestra como esta configurado.
//
// El token del bot es un secreto: se lee del entorno y nunca se imprime. Va en
// la terminal de quien corre esto, no en un chat:
//
//   PowerShell:
//     $env:TELEGRAM_BOT_TOKEN_CRAZYMIGA = "<token de BotFather>"
//     node platform/scripts/telegram-webhook.mjs --slug crazy-miga
//     node platform/scripts/telegram-webhook.mjs --slug crazy-miga --info
//
// El nombre de la variable sale del slug (crazy-miga -> TELEGRAM_BOT_TOKEN_CRAZYMIGA)
// y es el mismo que usan las edge functions.
//
// --info     solo consulta: URL registrada, errores y updates pendientes
// --borrar   saca el webhook (el bot deja de recibir)
//
// secret_token: se DERIVA del token del bot, igual que en
// platform/functions/tg-webhook/firma.ts (un test compara las dos formulas).

import { createHmac } from "node:crypto";

const PROYECTO = "https://wwwzdgprsooyjgkuyoav.supabase.co";

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
}

const slug = String(argumento("--slug") || "").trim().toLowerCase();
if (!slug) {
  console.error("Falta --slug. Ejemplo: node platform/scripts/telegram-webhook.mjs --slug crazy-miga");
  process.exit(1);
}

const variable = `TELEGRAM_BOT_TOKEN_${slug.replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
const token = process.env[variable];
if (!token) {
  console.error(`Falta la variable ${variable} en esta terminal.`);
  console.error(`PowerShell:  $env:${variable} = "<token de BotFather>"`);
  process.exit(1);
}

async function telegram(metodo, cuerpo = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return res.json();
}

const secreto = createHmac("sha256", token).update("dico-tg-webhook").digest("hex");
const url = `${PROYECTO}/functions/v1/tg-webhook?t=${encodeURIComponent(slug)}`;

if (argumento("--info")) {
  const r = await telegram("getWebhookInfo");
  if (!r.ok) { console.error("Telegram rechazo la consulta:", r.description); process.exit(1); }
  const i = r.result;
  console.log("URL registrada:      ", i.url || "(ninguna)");
  console.log("Updates pendientes:  ", i.pending_update_count);
  console.log("Ultimo error:        ", i.last_error_message || "ninguno");
  console.log("Coincide con la esperada:", i.url === url ? "si" : "NO");
  process.exit(0);
}

if (argumento("--borrar")) {
  const r = await telegram("deleteWebhook", { drop_pending_updates: false });
  console.log(r.ok ? "Webhook borrado." : `Telegram rechazo: ${r.description}`);
  process.exit(r.ok ? 0 : 1);
}

const r = await telegram("setWebhook", {
  url,
  secret_token: secreto,
  allowed_updates: ["message", "callback_query", "my_chat_member"],
  // No se descartan los updates pendientes: si el dueno ya toco /start antes de
  // registrar esto, ese mensaje todavia esta esperando.
  drop_pending_updates: false,
});

if (!r.ok) {
  console.error(`Telegram rechazo el webhook: ${r.description}`);
  process.exit(1);
}
console.log(`Webhook registrado para ${slug}.`);
console.log(`URL: ${url}`);
