// tg-webhook: lo que Telegram le manda al bot de un negocio.
//
// Telegram llama a esta URL por cada mensaje o boton que recibe el bot. Se
// registra con platform/scripts/telegram-webhook.mjs:
//   POST .../functions/v1/tg-webhook?t=<slug del negocio>
//
// Atiende tres cosas:
//   /start            registra el chat (como cliente) y le muestra el boton de pedir
//   ped:<id>:ok|no    el dueno acepta o rechaza un pedido nuevo desde el aviso
//   my_chat_member    el usuario bloqueo o desbloqueo el bot
//
// verify_jwt=false (bug #6 de CLAUDE.md): la llama Telegram, sin JWT. La
// proteccion es el header X-Telegram-Bot-Api-Secret-Token, que se deriva del
// token del bot (firma.ts) y se compara en tiempo constante. Ademas, los botones
// del dueno solo valen si el chat esta registrado como `owner` de ESE negocio.
//
// Siempre se responde 200: si se devuelve un error Telegram reintenta y se
// duplican las acciones.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { iguales, nombreDelSecreto } from "./validar.ts";
import { firmaDeWebhook } from "./firma.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMINIO = "divianco.app";

const ok = () => new Response("ok", { status: 200 });

async function api(token: string, metodo: string, cuerpo: Record<string, unknown>) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    return r.ok;
  } catch (e) {
    console.warn("tg-webhook api:", metodo, (e as Error).message);
    return false;
  }
}

function h(s: unknown): string {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

// deno-lint-ignore no-explicit-any
type Update = any;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const slug = (new URL(req.url).searchParams.get("t") || "").trim().toLowerCase();
  const token = slug ? Deno.env.get(nombreDelSecreto(slug)) : undefined;
  if (!token) return new Response("Not found", { status: 404 });

  // Sin la firma de Telegram no se mira ni el cuerpo.
  const esperada = await firmaDeWebhook(token);
  const recibida = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!iguales(esperada, recibida)) return new Response("Forbidden", { status: 403 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const u: Update = await req.json().catch(() => ({}));

    const { data: tenant } = await supabase.from("tenants")
      .select("id, name").eq("slug", slug).maybeSingle();
    if (!tenant) return ok();

    // ── El usuario bloqueo o desbloqueo el bot ──
    if (u.my_chat_member?.chat?.id) {
      const bloqueado = ["kicked", "left"].includes(u.my_chat_member.new_chat_member?.status);
      await supabase.from("telegram_chats")
        .update({ active: !bloqueado, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant.id).eq("chat_id", u.my_chat_member.chat.id);
      return ok();
    }

    // ── /start ──
    const msg = u.message;
    if (msg?.chat?.id && typeof msg.text === "string" && msg.text.startsWith("/start")) {
      const chatId: number = msg.chat.id;
      const { data: existente } = await supabase.from("telegram_chats")
        .select("id").eq("tenant_id", tenant.id).eq("chat_id", chatId).maybeSingle();

      const datos = {
        telegram_user_id: msg.from?.id ?? chatId,
        first_name: msg.from?.first_name ?? null,
        username: msg.from?.username ?? null,
        active: true,
        updated_at: new Date().toISOString(),
      };
      // Se actualiza sin tocar `kind`: un dueno que vuelve a tocar /start sigue
      // siendo dueno. Quien es dueno lo decide el negocio, no el chat.
      if (existente) await supabase.from("telegram_chats").update(datos).eq("id", existente.id);
      else await supabase.from("telegram_chats").insert({ ...datos, tenant_id: tenant.id, chat_id: chatId, kind: "customer" });

      await api(token, "sendMessage", {
        chat_id: chatId,
        parse_mode: "HTML",
        text: `¡Hola${msg.from?.first_name ? ` ${h(msg.from.first_name)}` : ""}! 👋 Soy el bot de <b>${h(tenant.name)}</b>.\nTocá el botón para ver la carta y pedir. Te aviso por acá cómo va tu pedido.`,
        reply_markup: {
          inline_keyboard: [[{ text: "Pedir 🍪", web_app: { url: `https://${slug}.${DOMINIO}` } }]],
        },
      });
      return ok();
    }

    // ── Aceptar / Rechazar ──
    const cb = u.callback_query;
    if (cb?.data && cb.message?.chat?.id) {
      const m = /^ped:([0-9a-f-]{36}):(ok|no)$/i.exec(String(cb.data));
      const chatId: number = cb.message.chat.id;

      // Solo el dueno de ESTE negocio.
      const { data: dueno } = await supabase.from("telegram_chats")
        .select("id").eq("tenant_id", tenant.id).eq("chat_id", chatId)
        .eq("kind", "owner").eq("active", true).maybeSingle();

      if (!m || !UUID.test(m[1]) || !dueno) {
        await api(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "No tenés permiso para esto." });
        return ok();
      }

      const aceptar = m[2].toLowerCase() === "ok";

      // Un pedido ya pagado no se rechaza desde aca: cancelarlo no devuelve la
      // plata, y eso se resuelve a mano en el panel y en MercadoPago.
      let pagoPorTransferencia = false;
      if (!aceptar) {
        const { data: pedido } = await supabase.from("orders")
          .select("payment, payment_status, paid_at").eq("id", m[1]).eq("tenant_id", tenant.id).maybeSingle();
        // Alias o transferencia: el sistema no ve la plata, asi que no puede
        // saber si ya llego. Se deja rechazar y se le recuerda al dueno.
        pagoPorTransferencia = pedido?.payment === "transferencia";
        if (pedido && (pedido.payment_status === "approved" || pedido.paid_at)) {
          await api(token, "answerCallbackQuery", {
            callback_query_id: cb.id, show_alert: true,
            text: "Este pedido ya está pagado. Cancelalo desde el panel para poder devolver el dinero.",
          });
          return ok();
        }
      }

      // Atomico: solo si el pedido sigue en 'new'. Si alguien ya lo movio desde
      // el panel, esto no pisa nada.
      const { data: cambiado } = await supabase.from("orders")
        .update({ status: aceptar ? "preparing" : "cancelled" })
        .eq("id", m[1]).eq("tenant_id", tenant.id).eq("status", "new")
        .select("id").maybeSingle();

      await api(token, "answerCallbackQuery", {
        callback_query_id: cb.id,
        text: cambiado ? (aceptar ? "Pedido aceptado" : "Pedido rechazado") : "Este pedido ya no está pendiente",
      });

      // Se sacan los botones para que no se toque dos veces.
      await api(token, "editMessageReplyMarkup", {
        chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] },
      });
      if (cambiado) {
        await api(token, "sendMessage", {
          chat_id: chatId, parse_mode: "HTML", reply_to_message_id: cb.message.message_id,
          text: aceptar
            ? "✅ Aceptado. Pasó a preparación."
            : `❌ Rechazado. Le avisamos al cliente.${pagoPorTransferencia ? "\n💸 Pagaba por transferencia: si ya te transfirió, coordiná la devolución con él." : ""}`,
        });
      }
      return ok();
    }

    return ok();
  } catch (err) {
    console.error("tg-webhook error:", err);
    return ok();
  }
});
