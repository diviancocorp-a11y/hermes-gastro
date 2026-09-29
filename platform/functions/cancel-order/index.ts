// cancel-order del EDIFICIO (multi-tenant).
//
// El boton de arrepentimiento: el comprador cancela su pedido en los primeros
// 60 segundos. Por que no se reuso supabase/functions/cancel-order: no sabe de
// negocios (cancela por id sin tenant), escribe cancelled_at/cancelled_by que
// el edificio no tiene, y le avisa a TODOS los admin sin tenant.
//
// La regla (negocio, status 'new', < 60s) vive en la RPC cancel_own_order
// (0082), en un update atomico. Esta function pone lo que SQL no puede: el
// rate limit por IP y el push al local, para que la cancelacion no sea
// silenciosa (caso Ornela 5/jul: el local preparo un pedido cancelado).
//
// Body: { tenant_slug, order_id }  ->  { ok: true } | { ok: false }
//   ok:false es "ya no se puede" (paso el minuto, ya esta en la cocina, no
//   existe): no es un error, el front lo muestra como tal.
//
// verify_jwt=false (bug #6 de CLAUDE.md): el comprador casi nunca tiene sesion.
// La proteccion real es el rate limit + el uuid del pedido como secreto + la
// regla del lado del servidor.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function getClientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      p_key: `cancel-order:${getClientIp(req)}`,
      p_max_requests: 10,
      p_window_seconds: 60,
    });
    if (allowed === false) return jsonRes({ error: "Demasiados intentos. Esperá un momento." }, 429);

    const body = await req.json().catch(() => ({}));
    const tenantSlug = typeof body.tenant_slug === "string" ? body.tenant_slug.trim().toLowerCase() : "";
    const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
    if (!tenantSlug) return jsonRes({ error: "Falta tenant_slug" }, 400);
    if (!UUID.test(orderId)) return jsonRes({ error: "order_id invalido" }, 400);

    const { data: r, error } = await supabase.rpc("cancel_own_order", {
      p_tenant_slug: tenantSlug,
      p_order_id: orderId,
    });
    if (error) {
      console.error("cancel_own_order:", error.message);
      return jsonRes({ error: "Error al cancelar" }, 500);
    }
    if (!r?.cancelado) return jsonRes({ ok: false });

    // Aviso al local: best-effort, el pedido ya esta cancelado. Con tenant_id
    // siempre: send-push sin negocio corta con 400 (nunca manda a todos).
    try {
      await supabase.functions.invoke("send-push", {
        body: {
          tenant_id: r.tenant_id,
          title: "Pedido cancelado",
          body: `${r.customer_first_name || "Cliente"} - $${r.total ?? ""} (lo cancelo el cliente)`,
          url: "/admin?tab=orders",
          target: { role: "admin" },
        },
      });
    } catch (e) {
      console.warn("cancel-order send-push (non-blocking):", (e as Error)?.message);
    }

    return jsonRes({ ok: true });
  } catch (err) {
    console.error("cancel-order error:", err);
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
