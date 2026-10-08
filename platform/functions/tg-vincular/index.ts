// tg-vincular: el cliente de la mini app vincula su Telegram con su telefono.
//
// Despues de hacer un pedido, el front manda el `initData` firmado por Telegram
// y el telefono del pedido. Aca se valida la firma contra el token del bot del
// negocio y se guarda (negocio, chat, telefono). Asi, cuando el pedido cambia de
// estado, tg-notificar sabe a que chat escribirle.
//
// Body: { tenant_slug, init_data, phone }
//   -> { ok: true, puede_escribir } | { ok: false, error }
//
// verify_jwt=false (bug #6 de CLAUDE.md): el comprador casi nunca tiene sesion.
// La proteccion real es la firma HMAC de Telegram + rate limit. `puede_escribir`
// dice si el usuario ya autorizo al bot a mandarle mensajes; si es false el
// front tiene que pedir `requestWriteAccess`.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { nombreDelSecreto, ultimos10, validarInitData } from "./validar.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
      p_key: `tg-vincular:${getClientIp(req)}`,
      p_max_requests: 20,
      p_window_seconds: 60,
    });
    if (allowed === false) return jsonRes({ ok: false, error: "Demasiados intentos" }, 429);

    const body = await req.json().catch(() => ({}));
    const slug = String(body.tenant_slug || "").trim().toLowerCase();
    const tail = ultimos10(body.phone);
    if (!slug || !body.init_data || !tail) return jsonRes({ ok: false, error: "Datos incompletos" }, 400);

    const token = Deno.env.get(nombreDelSecreto(slug));
    if (!token) return jsonRes({ ok: false, error: "Este negocio no tiene bot" }, 404);

    const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", slug).maybeSingle();
    if (!tenant) return jsonRes({ ok: false, error: "Negocio inexistente" }, 404);

    // Sin firma valida no se guarda nada. El mensaje no dice cual fue el motivo
    // para no ayudar a quien este probando.
    const v = await validarInitData(String(body.init_data), token);
    if (!v.ok) {
      console.warn("tg-vincular: initData rechazado:", v.motivo);
      return jsonRes({ ok: false, error: "No pudimos verificar tu Telegram" }, 401);
    }

    const phone = String(body.phone).replace(/\D/g, "").slice(0, 20);
    const { user } = v;

    // Si ya es el dueno, no se lo degrada a cliente por pedir desde su propio
    // telefono: se actualizan los datos y se deja el `kind` como esta.
    const { data: existente } = await supabase.from("telegram_chats")
      .select("id").eq("tenant_id", tenant.id).eq("chat_id", user.id).maybeSingle();

    const datos = {
      telegram_user_id: user.id,
      first_name: user.first_name ?? null,
      username: user.username ?? null,
      phone,
      phone_tail: tail,
      active: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = existente
      ? await supabase.from("telegram_chats").update(datos).eq("id", existente.id)
      : await supabase.from("telegram_chats").insert({
        ...datos, tenant_id: tenant.id, chat_id: user.id, kind: "customer",
      });
    if (error) {
      console.error("tg-vincular db:", error.message);
      return jsonRes({ ok: false, error: "No se pudo guardar" }, 500);
    }

    return jsonRes({ ok: true, puede_escribir: user.allows_write_to_pm === true });
  } catch (err) {
    console.error("tg-vincular error:", err);
    return jsonRes({ ok: false, error: "Error inesperado" }, 500);
  }
});
