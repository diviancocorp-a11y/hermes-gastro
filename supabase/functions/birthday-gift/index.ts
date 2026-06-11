// birthday-gift — cupon de regalo de cumpleanos
//
// POST { phone?, email?, claim?: boolean }
//   - Sin claim: chequea si HOY (hora Argentina) es el cumple del cliente
//     (customers.birth_date, matcheado por phone normalizado o email).
//     Devuelve { ok, birthday, name } sin crear nada.
//   - Con claim: crea (o recupera, idempotente) el cupon del anio para ese
//     cliente. Codigo deterministico CUMPLE{YY}-{6 chars del customer id}
//     => un solo cupon por cliente por anio aunque llame N veces.
//     Vence al final del dia argentino. % viene de settings.birthday_coupon_pct
//     (0 = regalo desactivado, se gestiona desde el CRM).
//
// verify_jwt = false (los guests no tienen JWT). Proteccion real:
// rate-limit por IP + el server valida birth_date contra la DB (el cliente
// no puede inventarse un cumple) + cupon unico por anio.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}
function getClientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

// "Ahora" en Argentina (UTC-3, sin DST)
function argentinaNow(): Date {
  return new Date(Date.now() - 3 * 3600 * 1000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const clientIp = getClientIp(req);
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      p_key: `birthday-gift:${clientIp}`, p_max_requests: 15, p_window_seconds: 60,
    });
    if (allowed === false) return jsonRes({ error: "Demasiados intentos. Probá en un rato." }, 429);

    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone || "").replace(/\D/g, "").slice(0, 20);
    const email = body.email ? String(body.email).trim().toLowerCase().slice(0, 200) : "";
    const claim = body.claim === true;
    if (!phone && !email) return jsonRes({ ok: true, birthday: false });

    // % configurado en CRM. 0 / null en settings viejas sin la columna = apagado
    const { data: cfg } = await supabase.from("settings").select("birthday_coupon_pct").eq("id", 1).single();
    const pct = Math.round(Number(cfg?.birthday_coupon_pct ?? 0));
    if (!pct || pct <= 0) return jsonRes({ ok: true, birthday: false });

    // Buscar cliente (mismo criterio que upsert_customer: phone primero, despues email)
    let customer: { id: string; name: string | null; email: string | null; birth_date: string | null } | null = null;
    if (phone) {
      const { data } = await supabase
        .from("customers").select("id, name, email, birth_date, phone")
        .not("birth_date", "is", null).not("phone", "is", null);
      customer = (data || []).find((c) => String(c.phone || "").replace(/\D/g, "") === phone) || null;
    }
    if (!customer && email) {
      const { data } = await supabase
        .from("customers").select("id, name, email, birth_date")
        .ilike("email", email).not("birth_date", "is", null).limit(1).maybeSingle();
      customer = data || null;
    }
    if (!customer?.birth_date) return jsonRes({ ok: true, birthday: false });

    // Cumple = mismo mes y dia en hora argentina. birth_date es date "YYYY-MM-DD"
    const ar = argentinaNow();
    const [, bMonth, bDay] = customer.birth_date.split("-").map(Number);
    const isBirthday = ar.getUTCMonth() + 1 === bMonth && ar.getUTCDate() === bDay;
    if (!isBirthday) return jsonRes({ ok: true, birthday: false });

    const firstName = (customer.name || "").trim().split(/\s+/)[0] || null;
    if (!claim) return jsonRes({ ok: true, birthday: true, name: firstName, pct });

    // ---- CLAIM: cupon idempotente por cliente/anio ----
    const yy = String(ar.getUTCFullYear()).slice(-2);
    const idChunk = customer.id.replace(/-/g, "").slice(0, 6).toUpperCase();
    const code = `CUMPLE${yy}-${idChunk}`;

    const { data: existing } = await supabase
      .from("coupons").select("code, discount_pct, used, expires_at")
      .eq("code", code).maybeSingle();
    if (existing) {
      return jsonRes({ ok: true, birthday: true, name: firstName, code: existing.code, pct: existing.discount_pct, used: !!existing.used, expires_at: existing.expires_at });
    }

    // Vence 23:59:59 hora argentina de HOY (= manana 02:59:59 UTC)
    const expiresAt = new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate() + 1, 2, 59, 59)).toISOString();

    const { error: insErr } = await supabase.from("coupons").insert({
      code,
      discount_pct: pct,
      email: customer.email || null, // si tiene email, el cupon queda atado a el
      expires_at: expiresAt,
    });
    if (insErr) {
      // carrera: otro request lo creo entre el select y el insert → recuperar
      const { data: raced } = await supabase.from("coupons").select("code, discount_pct, used, expires_at").eq("code", code).maybeSingle();
      if (raced) return jsonRes({ ok: true, birthday: true, name: firstName, code: raced.code, pct: raced.discount_pct, used: !!raced.used, expires_at: raced.expires_at });
      console.error("birthday-gift insert:", insErr.message);
      return jsonRes({ ok: false, error: "No se pudo generar el cupon" }, 500);
    }

    return jsonRes({ ok: true, birthday: true, name: firstName, code, pct, used: false, expires_at: expiresAt });
  } catch (e) {
    console.error("birthday-gift:", e);
    return jsonRes({ ok: false, error: "Error interno" }, 500);
  }
});
