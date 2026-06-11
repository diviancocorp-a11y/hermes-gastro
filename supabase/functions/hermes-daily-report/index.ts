// hermes-daily-report — informe diario del tenant a Telegram (Hermes/Ricky).
//
// Corre via pg_cron a las 09:00 AR (12:00 UTC) en CADA tenant: cada proyecto
// reporta SOLO sus numeros con su propia service role — cero secretos
// cruzados entre clientes. Ricky recibe un mensaje por tenant.
//
// Reusa los secrets de sentry-to-telegram:
//   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
//
// verify_jwt = false (la llama pg_cron). Proteccion: rate limit 2/hora por IP
// — lo peor que puede hacer un abusador es mandarle el informe a Ricky de mas.
//
// Nota honesta: "ayer" usa orders.date (fecha UTC al crear el pedido), que
// puede diferir de la fecha argentina en pedidos de 21:00-00:00. Aproximacion
// aceptable para un informe gerencial.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function arDate(shiftDays = 0): string {
  const d = new Date(Date.now() - 3 * 3600 * 1000 + shiftDays * 86400 * 1000);
  return d.toISOString().split("T")[0];
}
const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { data: allowed } = await supabase.rpc("check_rate_limit", {
    p_key: `hermes-report:${ip}`, p_max_requests: 2, p_window_seconds: 3600,
  });
  if (allowed === false) return new Response("rate limited", { status: 429 });

  const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!TG_TOKEN || !TG_CHAT) return new Response("Missing Telegram credentials", { status: 500 });

  try {
    const ayer = arDate(-1);
    const anteayer = arDate(-2);
    const hoy = arDate(0);
    const mesStart = hoy.slice(0, 8) + "01";
    // 00:00 AR = 03:00 UTC
    const ayerStartUtc = `${ayer}T03:00:00Z`;
    const hoyStartUtc = `${hoy}T03:00:00Z`;

    const [bizQ, ordersQ, prevQ, mesQ, activosQ, clientesQ, stockQ] = await Promise.all([
      supabase.from("settings").select("biz_name").eq("id", 1).single(),
      supabase.from("orders").select("total, status").eq("date", ayer),
      supabase.from("orders").select("total, status").eq("date", anteayer),
      supabase.from("orders").select("total").gte("date", mesStart).eq("status", "completed"),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["new", "preparing", "active"]),
      supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", ayerStartUtc).lt("created_at", hoyStartUtc),
      supabase.from("ingredients").select("name, stock, min_stock").eq("is_archived", false),
    ]);

    const biz = bizQ.data?.biz_name || "Tenant";
    const ordersAyer = ordersQ.data || [];
    const compAyer = ordersAyer.filter((o) => o.status === "completed");
    const ventasAyer = compAyer.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const cancelAyer = ordersAyer.filter((o) => o.status === "cancelled").length;
    const compPrev = (prevQ.data || []).filter((o) => o.status === "completed");
    const ventasPrev = compPrev.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const delta = ventasPrev > 0 ? Math.round(((ventasAyer - ventasPrev) / ventasPrev) * 100) : null;
    const ventasMes = (mesQ.data || []).reduce((s, o) => s + (Number(o.total) || 0), 0);
    const pedidosMes = (mesQ.data || []).length;
    const activos = activosQ.count || 0;
    const clientesNuevos = clientesQ.count || 0;
    const bajos = (stockQ.data || []).filter(
      (i) => i.min_stock != null && Number(i.stock) <= Number(i.min_stock),
    );

    const [, m, d] = ayer.split("-");
    const lines = [
      `🥐 <b>${biz}</b> — informe diario`,
      ``,
      `📅 <b>Ayer ${d}/${m}:</b> ${fmt(ventasAyer)} en ${compAyer.length} pedido${compAyer.length !== 1 ? "s" : ""}` +
        (delta !== null ? ` (${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs anteayer)` : ""),
    ];
    if (cancelAyer > 0) lines.push(`✖️ Cancelados ayer: ${cancelAyer}`);
    lines.push(`📈 <b>Mes:</b> ${fmt(ventasMes)} (${pedidosMes} pedidos)`);
    lines.push(`🟢 Pedidos activos ahora: ${activos}`);
    lines.push(`👥 Clientes nuevos ayer: ${clientesNuevos}`);
    if (bajos.length > 0) {
      const names = bajos.slice(0, 5).map((i) => i.name).join(", ");
      lines.push(`⚠️ <b>Stock bajo (${bajos.length}):</b> ${names}${bajos.length > 5 ? "…" : ""}`);
    }

    const tg = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text: lines.join("\n"), parse_mode: "HTML" }),
    });
    if (!tg.ok) {
      const err = await tg.text();
      console.error("Telegram error:", err);
      return new Response("telegram failed", { status: 502 });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("hermes-daily-report:", e);
    return new Response("error", { status: 500 });
  }
});
