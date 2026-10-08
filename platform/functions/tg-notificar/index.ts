// tg-notificar: manda los avisos del bot de Telegram de un negocio.
//
// La llama el trigger `tg_avisar_pedido` (migracion 0085) por pg_net cada vez
// que un pedido entra o cambia de estado. Decide a quien escribirle:
//
//   nuevo       -> al dueno, con botones Aceptar / Rechazar
//   cancelado   -> al dueno y al cliente
//   preparando  -> al cliente
//   listo       -> al cliente
//
// Body: { order_id, evento }   Header: x-dico-aviso (firma compartida en Vault)
//
// verify_jwt=false (bug #6 de CLAUDE.md): no la llama un navegador sino la base,
// asi que no hay JWT. La proteccion es la firma del header, comparada en tiempo
// constante contra `tg_secreto_de_aviso()` (solo ejecutable por service role).
//
// Un fallo de Telegram NUNCA vuelve al pedido: esto corre despues de que el
// pedido ya se guardo. Si el usuario bloqueo al bot (403) se lo marca inactivo
// para no seguir intentando.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { iguales, nombreDelSecreto, ultimos10 } from "./validar.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTOS = ["nuevo", "cancelado", "preparando", "listo"] as const;
type Evento = typeof EVENTOS[number];

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

// Telegram con parse_mode HTML: lo unico que hay que escapar son estos tres.
function h(s: unknown): string {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

function plata(n: unknown): string {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
}

async function enviar(token: string, chatId: number, text: string, markup?: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
      ...(markup ? { reply_markup: markup } : {}),
    }),
  });
  return { status: res.status, ok: res.ok };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. La firma: sin ella no se hace nada.
    const { data: secreto } = await supabase.rpc("tg_secreto_de_aviso");
    const recibido = req.headers.get("x-dico-aviso") || "";
    if (!secreto || !iguales(String(secreto), recibido)) return jsonRes({ error: "No autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id || "");
    const evento = body.evento as Evento;
    if (!UUID.test(orderId) || !EVENTOS.includes(evento)) return jsonRes({ error: "Datos invalidos" }, 400);

    // 2. El pedido, su negocio y su bot.
    const { data: order } = await supabase.from("orders")
      .select("id, tenant_id, status, customer_name, customer_phone, total, delivery, delivery_address, payment, note, ticket_number")
      .eq("id", orderId).maybeSingle();
    if (!order) return jsonRes({ error: "Pedido inexistente" }, 404);

    const { data: tenant } = await supabase.from("tenants")
      .select("slug, name").eq("id", order.tenant_id).maybeSingle();
    if (!tenant) return jsonRes({ error: "Negocio inexistente" }, 404);

    const token = Deno.env.get(nombreDelSecreto(tenant.slug));
    if (!token) return jsonRes({ ok: true, enviados: 0, motivo: "sin_bot" });

    const { data: items } = await supabase.from("order_items")
      .select("name_snapshot, qty").eq("order_id", order.id);

    const numero = order.ticket_number ? `#${order.ticket_number}` : "";
    const retira = order.delivery !== "envio";

    // 3. Que decirle al dueno y que al cliente.
    let paraDueno: { texto: string; botones?: unknown } | null = null;
    let paraCliente: string | null = null;

    if (evento === "nuevo") {
      const lineas = (items || []).map((i) => `• ${i.qty}× ${h(i.name_snapshot)}`).join("\n");
      paraDueno = {
        texto: [
          `🆕 <b>Pedido nuevo ${numero}</b>`,
          `👤 ${h(order.customer_name || "Cliente")}${order.customer_phone ? ` · ${h(order.customer_phone)}` : ""}`,
          retira ? "🏃 Retira en el local" : `🛵 Envío a: ${h(order.delivery_address || "sin dirección")}`,
          order.payment ? `💳 ${h(order.payment)}` : "",
          lineas,
          order.note ? `📝 ${h(order.note)}` : "",
          `💰 <b>${plata(order.total)}</b>`,
        ].filter(Boolean).join("\n"),
        botones: {
          inline_keyboard: [[
            { text: "✅ Aceptar", callback_data: `ped:${order.id}:ok` },
            { text: "❌ Rechazar", callback_data: `ped:${order.id}:no` },
          ]],
        },
      };
    } else if (evento === "cancelado") {
      paraDueno = { texto: `❌ <b>Pedido ${numero} cancelado</b>\n👤 ${h(order.customer_name || "Cliente")} · ${plata(order.total)}` };
      paraCliente = `Tu pedido ${numero} de ${h(tenant.name)} fue cancelado. Si fue un error, escribinos y lo resolvemos.`;
    } else if (evento === "preparando") {
      paraCliente = `👩‍🍳 <b>¡Estamos preparando tu pedido ${numero}!</b>\nLa cocina de ${h(tenant.name)} ya arrancó. Te avisamos cuando esté listo.`;
    } else if (evento === "listo") {
      paraCliente = retira
        ? `🍪 <b>¡Tu pedido ${numero} está listo!</b>\nYa podés pasar a retirarlo.`
        : `🛵 <b>¡Tu pedido ${numero} está listo!</b>\nSale en camino.`;
    }

    // 4. A quienes: dueno por kind, cliente por telefono.
    let enviados = 0;
    const apagar: string[] = [];
    const mandar = async (chat: { id: string; chat_id: number }, texto: string, botones?: unknown) => {
      const r = await enviar(token, chat.chat_id, texto, botones);
      if (r.ok) enviados++;
      else if (r.status === 403) apagar.push(chat.id); // bloqueo al bot
      else console.warn("tg-notificar: sendMessage", r.status);
    };

    if (paraDueno) {
      const { data: duenos } = await supabase.from("telegram_chats")
        .select("id, chat_id").eq("tenant_id", order.tenant_id).eq("kind", "owner").eq("active", true);
      for (const c of duenos || []) await mandar(c, paraDueno.texto, paraDueno.botones);
    }

    if (paraCliente) {
      const tail = ultimos10(order.customer_phone);
      if (tail) {
        const { data: clientes } = await supabase.from("telegram_chats")
          .select("id, chat_id").eq("tenant_id", order.tenant_id).eq("kind", "customer")
          .eq("phone_tail", tail).eq("active", true);
        for (const c of clientes || []) await mandar(c, paraCliente);
      }
    }

    if (apagar.length) {
      await supabase.from("telegram_chats").update({ active: false, updated_at: new Date().toISOString() }).in("id", apagar);
    }

    return jsonRes({ ok: true, enviados });
  } catch (err) {
    console.error("tg-notificar error:", err);
    return jsonRes({ error: "Error inesperado" }, 500);
  }
});
