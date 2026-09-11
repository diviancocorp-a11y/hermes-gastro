// Canal publico del menu de mesa.
//
// Abre la visita cuando el cliente elige autogestion y crea llamados
// idempotentes. La base resuelve tenant, mesa y camarero desde un codigo opaco;
// el browser nunca decide a quien notificar.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
}

const LABELS: Record<string, string> = {
  waiter: "Solicitan al camarero",
  bill: "Solicitan la cuenta",
  manager: "Solicitan al encargado",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const body = await req.json();
    const operation = String(body.operation || "");
    const tenantSlug = String(body.tenant_slug || "").trim().toLowerCase();
    const tableCode = String(body.table_code || "").trim().toLowerCase();
    const requestId = String(body.client_request_id || "").trim().toLowerCase() || null;

    if (!tenantSlug || !tableCode) return json({ error: "Faltan negocio o mesa" }, 400);

    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      p_key: `table-assistance:${clientIp(req)}:${tableCode}`,
      p_max_requests: 12,
      p_window_seconds: 60,
    });
    if (allowed === false) return json({ error: "Espera un momento antes de volver a intentar" }, 429);

    if (operation === "open") {
      const { data, error } = await supabase.rpc("open_table_visit_from_menu", {
        p_tenant_slug: tenantSlug,
        p_table_code: tableCode,
        p_service_mode: body.service_mode || "self_service",
        p_party_size: body.party_size || null,
        p_client_request_id: requestId,
      });
      if (error) throw error;
      return json({ ok: true, visit: data });
    }

    if (operation !== "request") return json({ error: "Operacion invalida" }, 400);
    const kind = String(body.kind || "");
    if (!LABELS[kind]) return json({ error: "Solicitud invalida" }, 400);

    const { data, error } = await supabase.rpc("request_table_assistance", {
      p_tenant_slug: tenantSlug,
      p_table_code: tableCode,
      p_kind: kind,
      p_client_request_id: requestId,
    });
    if (error) throw error;

    // El push es best-effort. La solicitud ya esta persistida y tambien llega
    // por Realtime cuando la app del responsable esta abierta.
    try {
      await supabase.functions.invoke("send-push", {
        body: {
          tenant_id: data.tenant_id,
          title: LABELS[kind],
          body: `${data.table_name} necesita atencion`,
          url: "/admin?tab=mesas",
          target: data.assigned_user_id
            ? { user_id: data.assigned_user_id }
            : { role: "admin" },
        },
      });
    } catch (pushError) {
      console.warn("table-assistance push (non-blocking):", (pushError as Error)?.message);
    }

    // No se devuelven ids internos de tenant o personal al visitante.
    return json({
      ok: true,
      request: {
        id: data.request_id,
        status: data.status,
        kind: data.kind,
        table_name: data.table_name,
      },
    });
  } catch (error) {
    const message = (error as Error)?.message || "Error interno";
    const known = /mesa_no_encontrada|visita_no_abierta|tipo_solicitud_invalido|modo_invalido/.test(message);
    console.error("table-assistance:", message);
    return json({ error: known ? message : "No se pudo enviar la solicitud" }, known ? 409 : 500);
  }
});
