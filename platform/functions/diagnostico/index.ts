// Canal publico del diagnostico de la landing (divianco.app/diagnostico).
//
// Guarda las respuestas en public.diagnosticos (0100/0101/0105) con el service role
// y devuelve el id, que viaja al alta para vincular el diagnostico al negocio
// (vincular_diagnostico). No guarda email, telefono ni nombre de persona.
//
// Publica: verify_jwt=false (ver NO_VERIFY_JWT en deploy-functions.mjs). La
// proteccion es el rate limit por IP y que cada campo sale de una lista
// cerrada, igual que los CHECK de la tabla. El plan recomendado lo calcula el
// front (src/lib/diagnostico.js); aca solo se valida que sea uno de los tres.

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

// Las mismas listas que los CHECK de la tabla. Si una cambia, cambian las dos.
const VERTICALES = ["gastronomia", "comercio", "servicios", "otro"];
const ESTABLECIMIENTOS: Record<string, string[]> = {
  gastronomia: ["restaurante", "parrilla", "cafeteria", "panaderia_pasteleria", "bar_cerveceria", "dark_kitchen"],
  comercio: ["indumentaria", "almacen_kiosco", "bebidas", "otro_comercio"],
  servicios: ["barberia_peluqueria", "estetica", "otro_servicio"],
  otro: [],
};
const CANALES = ["salon", "mostrador", "delivery_propio", "apps_delivery", "catalogo_online"];
const LOCALES = ["uno", "dos_tres", "cuatro_o_mas"];
const EQUIPOS = ["hasta_5", "de_6_a_15", "mas_de_15"];
const GESTIONES = ["planillas", "registro_manual", "otro_sistema", "contador", "sin_control"];
const DESAFIOS = ["rentabilidad", "costos", "costo_laboral", "mermas_caja", "pedidos", "stock", "turnos"];
const PLANES = ["digital", "local", "cadena"];
const URGENCIAS = ["ya", "este_mes", "proximos_meses", "explorando"];
const INVERSIONES = ["gratis", "hasta_60k", "hasta_100k", "mas_de_100k", "no_se"];

function texto(v: unknown, max: number) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return s || null;
}

function deLaLista(v: unknown, lista: string[]) {
  const s = String(v ?? "");
  return lista.includes(s) ? s : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: permitido } = await supabase.rpc("check_rate_limit", {
      p_key: `diagnostico:${clientIp(req)}`,
      p_max_requests: 10,
      p_window_seconds: 3600,
    });
    if (permitido === false) return json({ error: "Demasiados diagnosticos seguidos" }, 429);

    const b = await req.json().catch(() => ({}));

    const vertical = deLaLista(b.vertical, VERTICALES);
    if (!vertical) return json({ error: "Rubro invalido" }, 400);

    const establecimiento = b.establecimiento == null || b.establecimiento === ""
      ? null
      : deLaLista(b.establecimiento, ESTABLECIMIENTOS[vertical]);
    if (b.establecimiento && !establecimiento) return json({ error: "Tipo de negocio invalido" }, 400);

    const canales = Array.isArray(b.canales)
      ? [...new Set((b.canales as unknown[]).map((c) => String(c)))].filter((c) => CANALES.includes(c))
      : [];

    const locales = deLaLista(b.locales, LOCALES);
    const gestion = deLaLista(b.gestion_actual, GESTIONES);
    const desafio = deLaLista(b.desafio, DESAFIOS);
    const plan = deLaLista(b.plan_recomendado, PLANES);
    if (!locales || !gestion || !desafio || !plan) return json({ error: "Faltan respuestas" }, 400);

    const { data, error } = await supabase
      .from("diagnosticos")
      .insert({
        vertical,
        establecimiento,
        canales,
        locales,
        equipo: deLaLista(b.equipo, EQUIPOS),
        gestion_actual: gestion,
        desafio,
        plan_recomendado: plan,
        urgencia: deLaLista(b.urgencia, URGENCIAS),
        inversion: deLaLista(b.inversion, INVERSIONES),
        nombre_negocio: texto(b.nombre_negocio, 80),
        origen: texto(b.origen, 200),
      })
      .select("id")
      .single();
    if (error) throw error;

    return json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[diagnostico]", err);
    return json({ error: "No se pudo guardar el diagnostico" }, 500);
  }
});
