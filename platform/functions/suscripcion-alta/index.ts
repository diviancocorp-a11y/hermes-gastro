// suscripcion-alta — deja la tarjeta del paso 3 del registro en Mercado Pago y
// crea la suscripcion de Dico con el primer debito pendiente.
//
// Diseno: docs/plataforma/COBRO-SUSCRIPCION.md.
//
// ── QUIEN COBRA ──
// La cuenta de MP de DIVIANCO (secret DIVIANCO_MP_ACCESS_TOKEN). No es la de
// ningun negocio: `mp-connect`/`mp-preference` son para que el negocio le cobre
// a sus clientes; esto es Divianco cobrandole al negocio.
//
// ── LA TARJETA NO PASA POR ACA ──
// El navegador la tokeniza con el Card Payment Brick y manda solo el
// `card_token_id` (de un solo uso). MP la guarda; la base se queda con el id de
// la suscripcion, la marca y los ultimos 4 para mostrarlos.
//
// ── QUE SE COBRA NO LO DICE EL BROWSER ──
// El plan y el ciclo salen del user_metadata que escribio el registro, y el
// precio de la tabla `plans`. Del body solo se usa el token.
//
// verify_jwt=false (las keys sb_publishable_ no son JWT): la auth es interna,
// con la sesion del usuario, que tiene que tener el mail confirmado. Rate limit
// por usuario: sin el, una cuenta confirmada sirve para probar tarjetas robadas
// contra MP de a una.
//
// Body: { card_token_id, ultimos4?, marca? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  armarPreapproval, cobroDelCiclo, datosVisiblesDeTarjeta, eleccionDelAlta, primerDebito,
} from "./calculo.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const mpToken = Deno.env.get("DIVIANCO_MP_ACCESS_TOKEN");
    if (!mpToken) {
      console.error("suscripcion-alta: falta DIVIANCO_MP_ACCESS_TOKEN");
      return json({ error: "El cobro todavía no está disponible" }, 503);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    /* ── Quien es ── */
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "No autorizado" }, 401);
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user?.id || !user.email) return json({ error: "No autorizado" }, 401);
    // Regla del registro (Ricky, 6/nov): sin mail confirmado no se llega a la tarjeta.
    if (!user.email_confirmed_at) return json({ error: "Confirmá tu email para seguir" }, 403);

    const { data: permitido, error: errorLimite } = await supabase.rpc("check_rate_limit", {
      p_key: `suscripcion-alta:${user.id}`,
      p_max_requests: 5,
      p_window_seconds: 3600,
    });
    if (errorLimite) return json({ error: "El cobro no está disponible en este momento" }, 503);
    if (permitido !== true) {
      return json({ error: "Demasiados intentos. Probá de nuevo en una hora." }, 429);
    }

    const body = await req.json().catch(() => null);
    const cardTokenId = String(body?.card_token_id || "").trim();
    if (!/^[a-z0-9]{8,64}$/i.test(cardTokenId)) return json({ error: "Faltan los datos de la tarjeta" }, 400);

    /* ── Una sola suscripcion viva por cuenta ── */
    const { data: viva } = await supabase.from("suscripciones")
      .select("id").eq("user_id", user.id).neq("estado", "cancelled").maybeSingle();
    if (viva) return json({ error: "Tu cuenta ya tiene la tarjeta cargada" }, 409);

    /* ── Que eligio y cuanto sale ── */
    const eleccion = eleccionDelAlta(user.user_metadata);
    if (!eleccion) return json({ error: "Elegí un plan para seguir" }, 400);

    const { data: plan } = await supabase.from("plans")
      .select("id, nombre, precio_mensual, precio_anual_por_mes, disponible")
      .eq("id", eleccion.planId).maybeSingle();
    const cobro = cobroDelCiclo(plan, eleccion.ciclo);
    if (!plan || !cobro) return json({ error: "Ese plan no está disponible" }, 400);

    /* ── Si ya tiene negocio (cambio de tarjeta o alta tardia) ── */
    const { data: filas } = await supabase.from("tenant_members")
      .select("tenant_id, roles").eq("user_id", user.id);
    const tenantId = (filas || []).find((f) => (f.roles || []).includes("owner"))?.tenant_id ?? null;
    let negocio: { prueba_hasta: string | null } | null = null;
    if (tenantId) {
      const { data } = await supabase.from("tenants")
        .select("prueba_hasta").eq("id", tenantId).maybeSingle();
      negocio = data ?? { prueba_hasta: null };
    }
    const inicio = primerDebito(new Date(), negocio);

    /* ── La suscripcion, en MP ── */
    const preapproval = armarPreapproval({
      planNombre: plan.nombre,
      ciclo: eleccion.ciclo,
      monto: cobro.monto,
      frecuencia: cobro.frecuencia,
      inicio,
      email: user.email,
      userId: user.id,
      cardTokenId,
      notificationUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/suscripcion-webhook`,
      backUrl: "https://divianco.app/bienvenido",
    });

    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        // El token de tarjeta es de un solo uso: dos toques al boton con el
        // mismo token no crean dos suscripciones.
        "X-Idempotency-Key": `alta-${user.id}-${cardTokenId}`,
      },
      body: JSON.stringify(preapproval),
    });

    if (!res.ok) {
      const detalle = await res.text();
      console.error("suscripcion-alta: MP rechazo la suscripcion", res.status, detalle);
      // MP valida la tarjeta con un cobro minimo al crear: un 4xx casi siempre
      // es la tarjeta. El detalle no se devuelve: puede traer datos de la cuenta.
      return json({
        error: res.status < 500
          ? "La tarjeta no fue aceptada. Revisá los datos o probá con otra."
          : "No pudimos registrar la tarjeta. Probá de nuevo en unos minutos.",
      }, res.status < 500 ? 402 : 502);
    }

    const mp = await res.json();
    if (mp.status !== "authorized") {
      console.error("suscripcion-alta: estado inesperado", mp.id, mp.status);
      return json({ error: "La tarjeta no fue aceptada. Revisá los datos o probá con otra." }, 402);
    }

    const { error: insErr } = await supabase.from("suscripciones").insert({
      user_id: user.id,
      tenant_id: tenantId,
      preapproval_id: String(mp.id),
      plan_id: plan.id,
      ciclo: eleccion.ciclo,
      monto: cobro.monto,
      moneda: "ARS",
      estado: mp.status,
      primer_debito: inicio.toISOString(),
      ...datosVisiblesDeTarjeta(body),
    });

    if (insErr) {
      // Sin fila en la base, la suscripcion de MP cobraria sin que Dico lo
      // sepa: se cancela alla antes de devolver el error.
      console.error("suscripcion-alta: no se pudo guardar; se cancela en MP", mp.id, insErr);
      await fetch(`https://api.mercadopago.com/preapproval/${mp.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${mpToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }).catch((e) => console.error("suscripcion-alta: tampoco se pudo cancelar", mp.id, e));
      return json({ error: "No pudimos registrar la tarjeta. Probá de nuevo." }, 500);
    }

    return json({
      ok: true,
      plan: plan.id,
      ciclo: eleccion.ciclo,
      monto: cobro.monto,
      primer_debito: inicio.toISOString(),
    });
  } catch (err) {
    console.error("suscripcion-alta error:", err);
    return json({ error: "No pudimos registrar la tarjeta" }, 500);
  }
});
