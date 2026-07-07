// supabase/functions/cancel-order/index.ts
// Boton de arrepentimiento server-side (jul/2026, caso Ornela 5/jul): cancela
// el pedido validando la MISMA ventana que el RPC cancel_own_order (status=new
// + <60s), deja autoria 'customer', y avisa al admin con push "Pedido
// cancelado". El RPC solo (SQL puro) no puede invocar send-push — y una
// cancelacion silenciosa convierte un pedido en un misterio operativo.
//
// El RPC cancel_own_order queda como fallback del front para chunks viejos
// del catalogo (leccion HERMES-GASTRO-G: chunk viejo tras deploy).
//
// verify_jwt=false (funcion publica, mismo criterio que submit-order): la
// proteccion real es rate-limit + el UUID del pedido como secreto +
// validacion server-side de estado y ventana.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function jsonRes(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}
function getClientIp(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  try {
    const clientIp = getClientIp(req);
    const { data: allowed } = await supabase.rpc("check_rate_limit", { p_key: `cancel-order:${clientIp}`, p_max_requests: 10, p_window_seconds: 60 });
    if (allowed === false) return jsonRes({ error: "Demasiados intentos. Esperá un momento." }, 429);

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.order_id === "string" ? body.order_id : null;
    if (!orderId) return jsonRes({ error: "order_id requerido" }, 400);

    // Misma ventana que el RPC: solo pedidos 'new' de menos de 60 segundos.
    const cutoff = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: cancelled, error } = await supabase
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: "customer" })
      .eq("id", orderId)
      .eq("status", "new")
      .gt("created_at", cutoff)
      .select("customer, total")
      .maybeSingle();
    if (error) { console.error("cancel-order update:", error); return jsonRes({ error: "Error al cancelar" }, 500); }
    if (!cancelled) return jsonRes({ ok: false }); // ventana cerrada o pedido ya avanzado

    // Aviso al admin (fire-and-forget). Sin esto, la cancelacion es invisible
    // hasta que el cliente reclama en el mostrador.
    try {
      await supabase.functions.invoke("send-push", {
        body: {
          title: "Pedido cancelado",
          body: `${cancelled.customer || "Cliente"} - $${cancelled.total ?? ""} (cancelado por el cliente)`,
          url: "/admin?tab=orders",
          target: { role: "admin" },
        },
      });
    } catch (e) {
      console.warn("cancel-order send-push (non-blocking):", e?.message);
    }

    return jsonRes({ ok: true });
  } catch (err) {
    console.error("cancel-order error:", err);
    return jsonRes({ error: err.message }, 500);
  }
});
