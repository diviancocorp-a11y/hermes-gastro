// exchange-rate-sync: trae la tasa USD/VES y la guarda en exchange_rates para
// cada negocio con secondary_currency = 'VES' (y currency = 'USD').
//
// La llama un cron (pg_cron + pg_net), no un navegador.
// verify_jwt=false (bug #6 de CLAUDE.md). Proteccion: header `x-dico-aviso`
// comparado en tiempo constante contra el secreto de Vault que devuelve
// `tg_secreto_de_aviso()` (solo service role), igual que tg-notificar.
//
// Reglas:
//  - Nunca pisa una tasa manual del mismo dia: si ya hay una manual para ese
//    dia, el negocio se saltea. Re-correr el mismo dia es idempotente
//    (indice unico por dia y fuente).
//  - Si ninguna fuente da un valor valido y razonable, no inserta nada: el
//    catalogo seguira mostrando la ultima y marcara "por verificar" al vencer.
//
//  - La primera lectura del dia gana (guardarTasa no pisa): el BCV publica a la
//    tarde la tasa que rige el dia habil SIGUIENTE, y no debe reemplazar la de
//    hoy. Por eso el cron corre solo de manana, hora de Caracas (UTC-4):
//    06:00 y 09:00 = 10:00 y 13:00 UTC. La segunda corrida cubre un fallo de
//    la primera; si la primera tuvo exito, no cambia nada.
//
// Como se programaria (NO aplicado), desde un cron del edificio:
//   select cron.schedule('exchange-rate-sync', '0 10,13 * * *', $$
//     select net.http_post(
//       url := 'https://wwwzdgprsooyjgkuyoav.supabase.co/functions/v1/exchange-rate-sync',
//       headers := jsonb_build_object('Content-Type','application/json',
//                  'x-dico-aviso', public.tg_secreto_de_aviso()),
//       body := '{}'::jsonb) $$);
// Deploy: npm run deploy:functions (lo corre Ricky).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { diaEnZona, guardarTasa, tasaVigente } from "./fuentes.ts";

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: secreto } = await supabase.rpc("tg_secreto_de_aviso");
  if (!secreto || !iguales(String(secreto), req.headers.get("x-dico-aviso") || "")) {
    return jsonRes({ error: "No autorizado" }, 401);
  }

  const { data: tenants, error } = await supabase.from("tenants")
    .select("id, slug, timezone").eq("currency", "USD").eq("secondary_currency", "VES");
  if (error) return jsonRes({ error: error.message }, 500);

  const resultado: Record<string, unknown>[] = [];
  const cache = new Map<string, Awaited<ReturnType<typeof tasaVigente>>>();

  for (const t of tenants ?? []) {
    const { data: ult } = await supabase.from("exchange_rates")
      .select("rate").eq("tenant_id", t.id).eq("base_currency", "USD").eq("quote_currency", "VES")
      .order("effective_date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const ultima = ult ? Number(ult.rate) : null;

    const dia = diaEnZona(new Date(), t.timezone || "America/Caracas");

    const { data: manual } = await supabase.from("exchange_rates").select("id")
      .eq("tenant_id", t.id).eq("base_currency", "USD").eq("quote_currency", "VES")
      .eq("effective_date", dia).eq("source", "manual").limit(1).maybeSingle();
    if (manual) { resultado.push({ slug: t.slug, estado: "manual_del_dia" }); continue; }

    const clave = String(ultima);
    if (!cache.has(clave)) cache.set(clave, await tasaVigente(ultima));
    const { tasa, errores } = cache.get(clave)!;
    if (!tasa) { resultado.push({ slug: t.slug, estado: "sin_fuente", errores }); continue; }

    const r = await guardarTasa(supabase, {
      tenant_id: t.id, base_currency: "USD", quote_currency: "VES",
      rate: tasa.rate, effective_date: dia, source: tasa.source, created_by: null,
    });
    resultado.push({ slug: t.slug, ...r, rate: tasa.rate, source: tasa.source });
  }

  return jsonRes({ ok: true, resultado });
});
