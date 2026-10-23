// booking — la reserva online de turnos (agenda de servicios, fase 3).
//
// Una sola function con varias acciones para la clienta que reserva sin cuenta:
//   info    el catalogo de reserva del negocio (servicios, profesionales, zonas,
//           reglas y, si hay sena, si se puede cobrar)
//   slots   horarios libres de un servicio
//   create  reservar (y, si el negocio pide sena, armar el link de pago)
//   get     ver un turno con su token
//   cancel  cancelar con su token, dentro del plazo
//
// verify_jwt=false (CLAUDE.md, bug #6): las keys sb_publishable_ no son JWT.
// La proteccion real es: rate limit por IP, uuid/tokens opacos, y que TODO lo que
// decide plata, horario o profesional sale de la base y no del navegador:
//   - el monto de la sena se calcula aca con el precio del servicio
//   - el traslado sale de la zona (tabla), no del body
//   - el horario se vuelve a pedir a get_available_slots antes de insertar
// La garantia final contra el doble turno es el EXCLUDE de `appointments`.
//
// Body: { action, tenant_slug, ... }. Reglas puras en ./reglas.ts (con tests).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  elegirHueco, esUuid, montoDeSena, puedeCancelarSola, rangoDeConsulta, refDeSena,
  validarPedido, vencimientoDeRetencion,
} from "./reglas.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
}

function getClientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
}

// deno-lint-ignore no-explicit-any
type Fila = Record<string, any>;

const ESTADOS_DEL_NEGOCIO = ["active", "trial"];
const COLS_TURNO =
  "id, tenant_id, staff_id, service_id, customer_name, starts_at, ends_at, status, location_kind, " +
  "address, travel_min, zone_id, deposit_amount, deposit_status, hold_until, public_token";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const ip = getClientIp(req);
    const { data: permitido } = await supabase.rpc("check_rate_limit", {
      p_key: `booking:${ip}`,
      p_max_requests: 40,
      p_window_seconds: 60,
    });
    if (permitido === false) {
      return jsonRes({ error: "Demasiados intentos. Esperá un momento." }, 429, { "Retry-After": "60" });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const slug = String(body.tenant_slug || "").trim().toLowerCase();
    if (!slug) return jsonRes({ error: "Falta el negocio" }, 400);

    const { data: tenant } = await supabase.from("tenants")
      .select("id, slug, name, status, channels, timezone")
      .eq("slug", slug).maybeSingle();
    if (!tenant || !ESTADOS_DEL_NEGOCIO.includes(tenant.status)) {
      return jsonRes({ error: "Negocio no encontrado" }, 404);
    }
    if (!Array.isArray(tenant.channels) || !tenant.channels.includes("online_booking")) {
      return jsonRes({ error: "Este negocio no toma reservas online." }, 403);
    }

    const reglas = await leerReglas(supabase, tenant.id);

    switch (action) {
      case "info": return await accionInfo(supabase, tenant, reglas);
      case "slots": return await accionSlots(supabase, tenant, reglas, body);
      case "create": return await accionCreate(supabase, tenant, reglas, body);
      case "get": return await accionGet(supabase, tenant, reglas, body);
      case "cancel": return await accionCancel(supabase, tenant, reglas, body);
      default: return jsonRes({ error: "Accion desconocida" }, 400);
    }
  } catch (err) {
    console.error("booking error:", err);
    return jsonRes({ error: "No se pudo completar la operación" }, 500);
  }
});

/* ───────────────────────────── Datos comunes ─────────────────────────── */

async function leerReglas(supabase: ReturnType<typeof createClient>, tenantId: string): Promise<Fila> {
  const { data } = await supabase.from("booking_settings")
    .select("min_notice_min, max_advance_days, slot_step_min, cancel_window_hours, offers_local, offers_home, travel_min, deposit_mode, deposit_value, deposit_hold_min")
    .eq("tenant_id", tenantId).maybeSingle();
  // Los mismos defaults que usa get_available_slots (0109).
  return {
    min_notice_min: 120, max_advance_days: 60, slot_step_min: 15, cancel_window_hours: 24,
    offers_local: true, offers_home: false, travel_min: 0,
    deposit_mode: "none", deposit_value: null, deposit_hold_min: 30,
    ...(data || {}),
  };
}

/** Un servicio que se puede reservar online: activo, con duracion, no adicional. */
async function leerServicio(supabase: ReturnType<typeof createClient>, tenantId: string, id: string) {
  const { data } = await supabase.from("products")
    .select("id, name, price, duration_min, is_addon")
    .eq("tenant_id", tenantId).eq("id", id).eq("type", "service")
    .eq("active", true).eq("is_archived", false).maybeSingle();
  if (!data || !(data.duration_min > 0) || data.is_addon) return null;
  return data;
}

/**
 * Traslado de la modalidad pedida, sacado de la base. Devuelve el error si la
 * modalidad no se ofrece o falta la zona.
 */
async function resolverModalidad(
  supabase: ReturnType<typeof createClient>, tenantId: string, reglas: Fila,
  modalidad: string, zoneId: string | null,
): Promise<{ travel: number | null; zona: Fila | null } | { error: string }> {
  if (modalidad === "local") {
    if (!reglas.offers_local) return { error: "El negocio no atiende en el local." };
    return { travel: null, zona: null };
  }
  if (!reglas.offers_home) return { error: "El negocio no atiende a domicilio." };
  const { data: zonas } = await supabase.from("booking_zones")
    .select("id, name, travel_min").eq("tenant_id", tenantId).eq("active", true);
  if (zonas && zonas.length) {
    const z = zonas.find((x: Fila) => x.id === zoneId);
    if (!z) return { error: "Elegí la zona." };
    return { travel: Number(z.travel_min) || 0, zona: z };
  }
  // Sin zonas cargadas: el traslado fijo del negocio, como en el panel.
  return { travel: Number(reglas.travel_min) || 0, zona: null };
}

async function llamarHuecos(
  supabase: ReturnType<typeof createClient>, tenantId: string, serviceId: string,
  desde: string, hasta: string, staffId: string | null, modalidad: string, travel: number | null,
) {
  // La function de la base pide el rol service_role en el JWT: el cliente de
  // esta function ya lo usa.
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_tenant_id: tenantId,
    p_service_id: serviceId,
    p_from: desde,
    p_to: hasta,
    p_staff_id: staffId,
    p_location_kind: modalidad,
    p_travel_min: travel,
  });
  if (error) throw new Error(`get_available_slots: ${error.message}`);
  return (data || []) as Fila[];
}

function dia(iso: string, desplazar = 0) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + desplazar);
  return d.toISOString().slice(0, 10);
}

/* ─────────────────────────────── info ─────────────────────────────────── */

async function accionInfo(supabase: ReturnType<typeof createClient>, tenant: Fila, reglas: Fila) {
  const [servicios, staff, relaciones, zonas, ajustes, mp] = await Promise.all([
    supabase.from("products")
      .select("id, name, price, duration_min, category, is_addon")
      .eq("tenant_id", tenant.id).eq("type", "service").eq("active", true).eq("is_archived", false)
      .order("name"),
    supabase.from("staff").select("id, name, color")
      .eq("tenant_id", tenant.id).eq("active", true).order("name"),
    supabase.from("staff_services").select("staff_id, service_id").eq("tenant_id", tenant.id),
    supabase.from("booking_zones").select("id, name, travel_min")
      .eq("tenant_id", tenant.id).eq("active", true).order("name"),
    supabase.from("settings").select("biz_name, whatsapp, store_address, instagram")
      .eq("tenant_id", tenant.id).maybeSingle(),
    supabase.rpc("mp_credenciales", { p_tenant_id: tenant.id }).maybeSingle(),
  ]);

  const todos = (servicios.data || []) as Fila[];
  const reservables = todos.filter((s) => s.duration_min > 0 && !s.is_addon).map((s) => ({
    id: s.id, name: s.name, price: Number(s.price) || 0, duration_min: s.duration_min,
    category: s.category ?? null,
    deposit_amount: montoDeSena(reglas, Number(s.price)),
  }));
  const adicionales = todos.filter((s) => s.is_addon)
    .map((s) => ({ id: s.id, name: s.name, price: Number(s.price) || 0 }));

  const pideSena = reservables.some((s) => s.deposit_amount > 0);
  const mpConectado = !!(mp.data as Fila | null)?.access_token;

  return jsonRes({
    ok: true,
    negocio: {
      name: (ajustes.data as Fila | null)?.biz_name || tenant.name,
      whatsapp: (ajustes.data as Fila | null)?.whatsapp ?? null,
      address: (ajustes.data as Fila | null)?.store_address ?? null,
      instagram: (ajustes.data as Fila | null)?.instagram ?? null,
      timezone: tenant.timezone,
    },
    servicios: reservables,
    adicionales,
    staff: staff.data || [],
    // Que servicio hace cada una; vacio = cualquiera hace cualquiera.
    relaciones: relaciones.data || [],
    zonas: zonas.data || [],
    reglas: {
      offers_local: !!reglas.offers_local,
      offers_home: !!reglas.offers_home,
      min_notice_min: reglas.min_notice_min,
      max_advance_days: reglas.max_advance_days,
      cancel_window_hours: reglas.cancel_window_hours,
      travel_min: reglas.travel_min,
    },
    sena: {
      activa: pideSena,
      // Si pide sena pero no puede cobrarla, la reserva no se ofrece: mejor
      // eso que tomar un turno que nadie puede pagar.
      disponible: !pideSena || mpConectado,
      retencion_min: reglas.deposit_hold_min,
    },
  });
}

/* ─────────────────────────────── slots ────────────────────────────────── */

async function accionSlots(supabase: ReturnType<typeof createClient>, tenant: Fila, reglas: Fila, body: Fila) {
  if (!esUuid(body.service_id)) return jsonRes({ error: "Elegí un servicio" }, 400);
  const rango = rangoDeConsulta(body.from, body.to);
  if ("error" in rango) return jsonRes({ error: rango.error }, 400);
  const staff = body.staff_id && body.staff_id !== "any" ? String(body.staff_id) : null;
  if (staff !== null && !esUuid(staff)) return jsonRes({ error: "Profesional inválida" }, 400);
  const modalidad = body.location_kind === "home" ? "home" : "local";
  const zoneId = esUuid(body.zone_id) ? String(body.zone_id) : null;

  const servicio = await leerServicio(supabase, tenant.id, String(body.service_id));
  if (!servicio) return jsonRes({ error: "Ese servicio no se puede reservar" }, 404);
  const mod = await resolverModalidad(supabase, tenant.id, reglas, modalidad, zoneId);
  if ("error" in mod) return jsonRes({ error: mod.error }, 400);

  const huecos = await llamarHuecos(
    supabase, tenant.id, servicio.id, rango.desde, rango.hasta, staff, modalidad, mod.travel);
  return jsonRes({
    ok: true,
    slots: huecos.map((h) => ({ staff_id: h.staff_id, starts_at: h.starts_at, ends_at: h.ends_at })),
  });
}

/* ─────────────────────────────── create ───────────────────────────────── */

async function accionCreate(supabase: ReturnType<typeof createClient>, tenant: Fila, reglas: Fila, body: Fila) {
  const v = validarPedido(body);
  if (!v.ok) return jsonRes({ error: v.error }, 400);
  const p = v.pedido;

  // Idempotencia: un reintento de red o un doble toque devuelve el mismo turno.
  if (p.client_request_id) {
    const { data: previo } = await supabase.from("appointments")
      .select(COLS_TURNO).eq("tenant_id", tenant.id)
      .eq("client_request_id", p.client_request_id).maybeSingle();
    if (previo) return await respuestaDelTurno(supabase, tenant, previo as Fila, null, true);
  }

  const servicio = await leerServicio(supabase, tenant.id, p.service_id);
  if (!servicio) return jsonRes({ error: "Ese servicio no se puede reservar" }, 404);

  const mod = await resolverModalidad(supabase, tenant.id, reglas, p.location_kind, p.zone_id);
  if ("error" in mod) return jsonRes({ error: mod.error }, 400);

  // El monto lo decide el servidor. Si hay sena, tiene que poder cobrarse.
  const monto = montoDeSena(reglas, Number(servicio.price));
  let credenciales: Fila | null = null;
  if (monto > 0) {
    const { data } = await supabase.rpc("mp_credenciales", { p_tenant_id: tenant.id }).maybeSingle();
    credenciales = data as Fila | null;
    if (!credenciales?.access_token) {
      return jsonRes({ error: "Este negocio todavía no habilita reservas con seña." }, 503);
    }
  }

  // El horario se vuelve a calcular ACA: el navegador solo propone.
  const huecos = await llamarHuecos(
    supabase, tenant.id, servicio.id, dia(p.starts_at, -1), dia(p.starts_at, 1),
    p.staff_id, p.location_kind, mod.travel);
  const carga = await cargaDeTurnos(supabase, tenant.id, p.starts_at);
  const hueco = elegirHueco(huecos as never, p.starts_at, p.staff_id, carga);
  if (!hueco) {
    return jsonRes({ error: "Ese horario ya no está disponible. Elegí otro.", code: "slot_taken" }, 409);
  }

  const ahora = Date.now();
  const retiene = monto > 0;
  const fila = {
    tenant_id: tenant.id,
    staff_id: hueco.staff_id,
    service_id: servicio.id,
    customer_name: p.customer_name,
    customer_phone: p.customer_phone,
    customer_email: p.customer_email,
    starts_at: hueco.starts_at,
    ends_at: hueco.ends_at,
    status: "booked",
    source: "online",
    notes: p.notes,
    location_kind: p.location_kind,
    address: p.address,
    travel_min: p.location_kind === "home" ? (mod.travel ?? 0) : 0,
    zone_id: mod.zona?.id ?? null,
    deposit_amount: retiene ? monto : null,
    deposit_status: retiene ? "pending" : null,
    hold_until: retiene ? vencimientoDeRetencion(ahora, Number(reglas.deposit_hold_min)) : null,
    cancellation_policy: `Cancelación sin cargo hasta ${reglas.cancel_window_hours} h antes.`,
    client_request_id: p.client_request_id,
  };

  const { data: turno, error } = await supabase.from("appointments")
    .insert(fila).select(COLS_TURNO).single();
  if (error) {
    // 23P01: el EXCLUDE (otra clienta tomo el hueco en el mismo instante).
    if (error.code === "23P01" || String(error.message).includes("appt_no_overlap")) {
      return jsonRes({ error: "Ese horario se acaba de ocupar. Elegí otro.", code: "slot_taken" }, 409);
    }
    // 23505: carrera de dos requests con la misma clave de idempotencia.
    if (error.code === "23505" && p.client_request_id) {
      const { data: previo } = await supabase.from("appointments")
        .select(COLS_TURNO).eq("tenant_id", tenant.id)
        .eq("client_request_id", p.client_request_id).maybeSingle();
      if (previo) return await respuestaDelTurno(supabase, tenant, previo as Fila, null, true);
    }
    console.error("booking/create insert:", error);
    return jsonRes({ error: "No se pudo reservar. Probá de nuevo." }, 500);
  }

  let pago: { init_point: string | null } | null = null;
  if (retiene && credenciales) {
    pago = await armarPreferencia(tenant, turno as Fila, servicio, monto, credenciales);
    if (!pago) {
      // Sin link de pago no hay turno: no se deja un hueco retenido que nadie
      // puede pagar.
      await supabase.from("appointments").update({ status: "cancelled" }).eq("id", (turno as Fila).id);
      return jsonRes({ error: "No se pudo generar el link de pago de la seña." }, 502);
    }
  } else {
    await avisarAlNegocio(supabase, tenant, "Nuevo turno",
      `${p.customer_name} · ${servicio.name}`);
  }

  return await respuestaDelTurno(supabase, tenant, turno as Fila, pago, false);
}

/** Cuantos turnos tiene cada profesional en la ventana, para repartir la carga. */
async function cargaDeTurnos(supabase: ReturnType<typeof createClient>, tenantId: string, startsAt: string) {
  const { data } = await supabase.from("appointments").select("staff_id")
    .eq("tenant_id", tenantId).neq("status", "cancelled")
    .gte("starts_at", new Date(Date.parse(startsAt) - 86400000).toISOString())
    .lte("starts_at", new Date(Date.parse(startsAt) + 86400000).toISOString());
  const carga: Record<string, number> = {};
  for (const r of (data || []) as Fila[]) carga[r.staff_id] = (carga[r.staff_id] ?? 0) + 1;
  return carga;
}

/** Preferencia de MercadoPago para la sena. Mismo patron que mp-preference. */
async function armarPreferencia(
  tenant: Fila, turno: Fila, servicio: Fila, monto: number, integ: Fila,
): Promise<{ init_point: string | null } | null> {
  const base = `https://${tenant.slug}.divianco.app`;
  const volver = `${base}/reservar/turno/${turno.public_token}`;
  const pref = {
    items: [{
      id: turno.id,
      title: `Seña · ${servicio.name} en ${tenant.name}`,
      quantity: 1,
      currency_id: "ARS",
      unit_price: monto,
    }],
    external_reference: refDeSena(turno.id),
    notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook?tenant=${encodeURIComponent(tenant.slug)}`,
    back_urls: { success: `${volver}?pago=ok`, pending: `${volver}?pago=pendiente`, failure: `${volver}?pago=error` },
    auto_return: "approved",
    // El link deja de servir cuando vence la retencion del hueco.
    expires: true,
    expiration_date_to: turno.hold_until,
  };
  try {
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integ.access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `sena-${turno.id}`,
      },
      body: JSON.stringify(pref),
    });
    if (!res.ok) {
      console.error("booking: MP rechazo la preferencia", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return { init_point: integ.live_mode ? data.init_point : data.sandbox_init_point };
  } catch (e) {
    console.error("booking: no se pudo hablar con MP", (e as Error)?.message);
    return null;
  }
}

/* ───────────────────────────── get / cancel ───────────────────────────── */

async function turnoPorToken(supabase: ReturnType<typeof createClient>, tenantId: string, token: unknown) {
  if (!esUuid(token)) return null;
  const { data } = await supabase.from("appointments").select(COLS_TURNO)
    .eq("tenant_id", tenantId).eq("public_token", String(token).toLowerCase()).maybeSingle();
  return (data as Fila | null) ?? null;
}

async function accionGet(supabase: ReturnType<typeof createClient>, tenant: Fila, reglas: Fila, body: Fila) {
  const turno = await turnoPorToken(supabase, tenant.id, body.token);
  if (!turno) return jsonRes({ error: "No encontramos ese turno" }, 404);
  return await respuestaDelTurno(supabase, tenant, turno, null, false, reglas);
}

async function accionCancel(supabase: ReturnType<typeof createClient>, tenant: Fila, reglas: Fila, body: Fila) {
  const turno = await turnoPorToken(supabase, tenant.id, body.token);
  if (!turno) return jsonRes({ error: "No encontramos ese turno" }, 404);
  if (!["booked", "confirmed"].includes(turno.status)) {
    return jsonRes({ error: "Ese turno ya no se puede cancelar.", status: turno.status }, 409);
  }
  if (!puedeCancelarSola(turno.starts_at, Date.now(), Number(reglas.cancel_window_hours))) {
    return jsonRes({
      error: `Pasó el plazo para cancelar solo (${reglas.cancel_window_hours} h antes). Escribile al negocio.`,
      code: "fuera_de_plazo",
    }, 409);
  }
  const { error } = await supabase.from("appointments")
    .update({ status: "cancelled" }).eq("id", turno.id).eq("tenant_id", tenant.id);
  if (error) {
    console.error("booking/cancel:", error);
    return jsonRes({ error: "No se pudo cancelar. Probá de nuevo." }, 500);
  }
  // Una sena ya pagada NO se devuelve sola: se le avisa al negocio.
  const conSena = turno.deposit_status === "paid";
  await avisarAlNegocio(supabase, tenant,
    conSena ? "Turno cancelado con seña pagada" : "Turno cancelado",
    `${turno.customer_name || "Clienta"}${conSena ? " · devolvé la seña según tu política" : ""}`);
  return jsonRes({ ok: true, status: "cancelled", sena_pagada: conSena });
}

/* ─────────────────────────────── respuesta ────────────────────────────── */

async function respuestaDelTurno(
  supabase: ReturnType<typeof createClient>, tenant: Fila, turno: Fila,
  pago: { init_point: string | null } | null, deduplicado: boolean, reglasYa?: Fila,
) {
  const reglas = reglasYa ?? await leerReglas(supabase, tenant.id);
  const [{ data: servicio }, { data: staff }, { data: zona }] = await Promise.all([
    supabase.from("products").select("name").eq("id", turno.service_id).maybeSingle(),
    supabase.from("staff").select("name").eq("id", turno.staff_id).maybeSingle(),
    turno.zone_id
      ? supabase.from("booking_zones").select("name").eq("id", turno.zone_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return jsonRes({
    ok: true,
    deduplicated: deduplicado,
    turno: {
      token: turno.public_token,
      status: turno.status,
      starts_at: turno.starts_at,
      ends_at: turno.ends_at,
      servicio: (servicio as Fila | null)?.name ?? null,
      profesional: (staff as Fila | null)?.name ?? null,
      location_kind: turno.location_kind,
      address: turno.address,
      zona: (zona as Fila | null)?.name ?? null,
      sena: turno.deposit_amount
        ? {
          monto: Number(turno.deposit_amount),
          estado: turno.deposit_status,
          vence: turno.hold_until,
          init_point: pago?.init_point ?? null,
        }
        : null,
      puede_cancelar: ["booked", "confirmed"].includes(turno.status)
        && puedeCancelarSola(turno.starts_at, Date.now(), Number(reglas.cancel_window_hours)),
      cancel_window_hours: reglas.cancel_window_hours,
    },
  });
}

async function avisarAlNegocio(
  supabase: ReturnType<typeof createClient>, tenant: Fila, title: string, body: string,
) {
  try {
    await supabase.functions.invoke("send-push", {
      body: { tenant_slug: tenant.slug, title, body, url: "/admin?tab=agenda", target: { role: "admin" } },
    });
  } catch (e) {
    // Que no llegue el aviso no puede deshacer una reserva ya tomada.
    console.warn("booking: push (no bloqueante):", (e as Error)?.message);
  }
}
