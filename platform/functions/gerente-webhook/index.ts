// gerente-webhook: Ricky le escribe a GerenteDico por Telegram y le contesta.
//
// Etapa 2 del plan de GerenteDico (HANDOFF 16/oct): conversacion con
// herramientas de SOLO LECTURA (herramientas.ts). El cerebro es OpenAI, con la
// misma key que ya usan morning-health y sentry-alerta (DICO_BRAIN).
//
// Se registra en Telegram con platform/scripts/gerente-webhook.mjs (o el
// workflow "GerenteDico webhook" de GitHub, que ya tiene el token).
//
// verify_jwt=false: la llama Telegram, sin JWT. Proteccion:
//   1) header X-Telegram-Bot-Api-Secret-Token derivado del token (firma.ts);
//   2) solo se atiende el chat TELEGRAM_CHAT_ID (el de Ricky). Cualquier otro
//      chat se ignora sin contestar.
//
// Secrets (los mismos de sentry-alerta, ya cargados):
//   GERENTEDICOBOT, TELEGRAM_CHAT_ID, DICO_BRAIN, DICO_BRAIN_MODEL (opcional)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
//
// Se responde 200 enseguida y se trabaja en segundo plano (waitUntil): si
// Telegram no recibe respuesta a tiempo reintenta, y la respuesta saldria dos
// veces.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { firmaDelGerente, iguales } from "./firma.ts";
import {
  cortar, diasValidos, HERRAMIENTAS, PROMPT_SISTEMA, resumirPedidos, slugValido,
} from "./herramientas.ts";

const ok = () => new Response("ok", { status: 200 });
const MAX_VUELTAS = 4;

async function telegram(token: string, metodo: string, cuerpo: Record<string, unknown>) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  } catch (e) {
    console.warn("gerente telegram:", metodo, (e as Error).message);
  }
}

async function tenantPorSlug(db: SupabaseClient, slug: string) {
  const { data } = await db.from("tenants").select("id, slug, name").eq("slug", slug).maybeSingle();
  return data;
}

async function ejecutar(db: SupabaseClient, nombre: string, args: Record<string, unknown>) {
  if (nombre === "negocios") {
    const desde = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [{ data: tenants }, { data: productos }, { data: pedidos }] = await Promise.all([
      db.from("tenants").select("id, slug, name, status, plan, created_at, first_order_at, last_activity_at"),
      db.from("products").select("tenant_id").eq("active", true).eq("is_archived", false),
      db.from("orders").select("tenant_id, status, total").gte("created_at", desde),
    ]);
    return (tenants ?? []).map((t) => {
      const suyos = (pedidos ?? []).filter((p) => p.tenant_id === t.id);
      return {
        slug: t.slug, nombre: t.name, estado: t.status, plan: t.plan,
        alta: t.created_at, primer_pedido: t.first_order_at, ultima_actividad: t.last_activity_at,
        productos_activos: (productos ?? []).filter((p) => p.tenant_id === t.id).length,
        pedidos_7_dias: suyos.length,
        facturado_7_dias: Math.round(suyos.filter((p) => p.status !== "cancelled")
          .reduce((s, p) => s + (Number(p.total) || 0), 0)),
      };
    });
  }

  const slug = slugValido(args.slug);
  if (!slug) return { error: "slug invalido" };
  const t = await tenantPorSlug(db, slug);
  if (!t) return { error: `no existe el negocio ${slug}` };

  if (nombre === "pedidos") {
    const dias = diasValidos(args.dias);
    const desde = new Date(Date.now() - dias * 86400_000).toISOString();
    const { data, error } = await db.from("orders").select("status, channel, total, created_at")
      .eq("tenant_id", t.id).gte("created_at", desde);
    if (error) return { error: error.message };
    return { negocio: t.slug, ...resumirPedidos(data ?? [], dias) };
  }

  if (nombre === "productos") {
    const { data, error } = await db.from("products")
      .select("name, category, price, stock, active, is_archived").eq("tenant_id", t.id).order("name");
    if (error) return { error: error.message };
    return { negocio: t.slug, productos: data ?? [] };
  }

  return { error: `herramienta desconocida: ${nombre}` };
}

// deno-lint-ignore no-explicit-any
type Mensaje = Record<string, any>;

async function pensar(db: SupabaseClient, pregunta: string, contexto: string | null): Promise<string> {
  const key = Deno.env.get("DICO_BRAIN")?.trim();
  if (!key) return "No tengo cerebro: falta el secret DICO_BRAIN en la function.";
  const model = Deno.env.get("DICO_BRAIN_MODEL")?.trim() || "gpt-4o-mini";

  const mensajes: Mensaje[] = [{ role: "system", content: PROMPT_SISTEMA }];
  // Si Ricky contesta a un mensaje (un aviso de Sentry, una respuesta anterior),
  // ese texto es el contexto de la pregunta.
  if (contexto) mensajes.push({ role: "user", content: `Contexto (mensaje al que respondo):\n${contexto}` });
  mensajes.push({ role: "user", content: pregunta });

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    let d: Mensaje;
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ model, temperature: 0.2, max_tokens: 600, messages: mensajes, tools: HERRAMIENTAS }),
      });
      if (!r.ok) {
        console.error("gerente openai:", r.status, (await r.text()).slice(0, 200));
        return `No pude pensar la respuesta (OpenAI respondio ${r.status}).`;
      }
      d = await r.json();
    } catch (e) {
      return `No pude pensar la respuesta (${(e as Error).message}).`;
    }

    const msg = d.choices?.[0]?.message;
    if (!msg) return "OpenAI no devolvio respuesta.";
    const llamadas = msg.tool_calls ?? [];
    if (!llamadas.length) return String(msg.content ?? "").trim() || "(sin respuesta)";

    mensajes.push(msg);
    for (const c of llamadas) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* args vacios */ }
      let resultado: unknown;
      try {
        resultado = await ejecutar(db, c.function?.name, args);
      } catch (e) {
        resultado = { error: (e as Error).message };
      }
      mensajes.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(resultado).slice(0, 12000) });
    }
  }
  return "Me quede dando vueltas con las consultas y no llegue a una respuesta. Proba preguntarlo mas concreto.";
}

const BIENVENIDA = [
  "Soy GerenteDico. Por ahora puedo consultar, no cambiar nada:",
  "- que negocios hay y como vienen (pedidos y facturacion de la semana)",
  "- los pedidos de un negocio en los ultimos dias",
  "- los productos de un negocio",
  "Preguntame en castellano, por ejemplo: como viene crazy-miga esta semana?",
].join("\n");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const token = Deno.env.get("GERENTEDICOBOT")?.trim();
  const chatRicky = Deno.env.get("TELEGRAM_CHAT_ID")?.trim();
  if (!token || !chatRicky) return new Response("Not configured", { status: 500 });

  const recibida = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!iguales(recibida, await firmaDelGerente(token))) return new Response("Unauthorized", { status: 401 });

  // deno-lint-ignore no-explicit-any
  let update: any;
  try { update = await req.json(); } catch { return ok(); }

  const m = update?.message;
  const texto = typeof m?.text === "string" ? m.text.trim() : "";
  // Solo el chat de Ricky. A cualquier otro no se le contesta: ni confirma que
  // el bot existe.
  if (!m || String(m.chat?.id) !== chatRicky || !texto) return ok();

  const trabajo = (async () => {
    if (texto === "/start" || texto === "/ayuda") {
      await telegram(token, "sendMessage", { chat_id: chatRicky, text: BIENVENIDA });
      return;
    }
    await telegram(token, "sendChatAction", { chat_id: chatRicky, action: "typing" });
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const contexto = typeof m.reply_to_message?.text === "string" ? m.reply_to_message.text : null;
    const respuesta = await pensar(db, texto, contexto);
    await telegram(token, "sendMessage", {
      chat_id: chatRicky,
      text: cortar(respuesta),
      reply_to_message_id: m.message_id,
      disable_web_page_preview: true,
    });
  })().catch((e) => console.error("gerente:", (e as Error).message));

  EdgeRuntime.waitUntil(trabajo);
  return ok();
});
