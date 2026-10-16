// sentry-alerta: un error nuevo en Sentry le llega a Ricky por GerenteDico, al
// momento y explicado en castellano.
//
// La llama Sentry: una integracion interna ("GerenteDico") con Alert Rule
// Action, disparada por la regla "A new issue is created". Ver
// docs/plataforma/SENTRY.md para el alta en Sentry.
//
// verify_jwt=false: no hay JWT, la llama Sentry. La proteccion es la firma
// `sentry-hook-signature` (HMAC del body con el Client Secret de la
// integracion). Sin firma valida responde 401 y no manda nada.
//
// Secrets de la function (panel de Supabase -> Edge Functions -> Secrets):
//   SENTRY_ALERTA_SECRET  Client Secret de la integracion interna de Sentry
//   GERENTEDICOBOT        token del bot GerenteDico
//   TELEGRAM_CHAT_ID      chat de Ricky
//   DICO_BRAIN            (opcional) API key de OpenAI para la explicacion
//
// Un fallo de OpenAI no frena el aviso: sale sin la explicacion.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { armarMensaje, firmaValida, leerAlerta, resumenParaCerebro } from "./validar.ts";

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function explicar(resumen: string): Promise<string | null> {
  const key = Deno.env.get("DICO_BRAIN")?.trim();
  if (!key) return null;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: Deno.env.get("DICO_BRAIN_MODEL")?.trim() || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 250,
        messages: [
          {
            role: "system",
            content: "Sos el gerente tecnico de Dico, una plataforma de catalogos y pedidos para negocios "
              + "(cada negocio vive en <slug>.divianco.app). Le explicas al dueno, que no es programador, "
              + "un error que acaba de aparecer. En espanol argentino, maximo 3 renglones, sin Markdown: "
              + "que le pasa al cliente que lo sufre, que tan urgente es (ya / hoy / puede esperar) y que "
              + "conviene hacer. No inventes datos que no esten en el error.",
          },
          { role: "user", content: resumen },
        ],
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return String(d.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const cuerpo = await req.text();
  const secreto = Deno.env.get("SENTRY_ALERTA_SECRET")?.trim() ?? "";
  if (!(await firmaValida(secreto, cuerpo, req.headers.get("sentry-hook-signature")))) {
    return jsonRes({ error: "firma invalida" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(cuerpo);
  } catch {
    return jsonRes({ error: "json invalido" }, 400);
  }

  const alerta = leerAlerta(req.headers.get("sentry-hook-resource"), body);
  // installation, issue resolved, etc.: se contesta 200 para que Sentry no reintente.
  if (!alerta) return jsonRes({ ok: true, ignorado: true });

  const token = Deno.env.get("GERENTEDICOBOT")?.trim();
  const chat = Deno.env.get("TELEGRAM_CHAT_ID")?.trim();
  if (!token || !chat) return jsonRes({ error: "faltan GERENTEDICOBOT o TELEGRAM_CHAT_ID" }, 500);

  const texto = armarMensaje(alerta, await explicar(resumenParaCerebro(alerta)));
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!r.ok) return jsonRes({ error: `telegram ${r.status}` }, 502);
  return jsonRes({ ok: true });
});
