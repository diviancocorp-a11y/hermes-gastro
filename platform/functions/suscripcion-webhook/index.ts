// suscripcion-webhook — Mercado Pago avisa como van las suscripciones de Dico.
//
// Diseno: docs/plataforma/COBRO-SUSCRIPCION.md. La suscripcion la crea
// suscripcion-alta con `notification_url` apuntando aca.
//
// ── QUE SE CREE Y QUE NO ──
// De la notificacion solo se usa el id. El estado se le pregunta a MP con el
// token de Divianco: una notificacion inventada no sobrevive a esa consulta.
// Si DIVIANCO_MP_WEBHOOK_SECRET esta cargado, ademas se valida la firma.
//
// ── IDEMPOTENCIA ──
// MP reintenta. Cada debito es una fila de `cobros_suscripcion` con el id de MP
// unique, y `paga_hasta` se corre solo si esa fila todavia no tenia
// `cubre_hasta`: el update que lo reclama es atomico, asi que dos avisos
// simultaneos del mismo debito no extienden dos veces.
//
// ── QUE CAMBIA EN EL NEGOCIO ──
//   debito aprobado  -> plan_id = el elegido, ciclo, paga_hasta corrido,
//                       status 'active', sin suspension.
//   debito rechazado -> Dante/Magnus sin nada pago bajan a Paris. Paris queda
//                       para la suspension por fecha (0052).
//   suscripcion      -> solo se guarda el estado que dice MP.
//
// verify_jwt=false: lo llama MP, sin sesion.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  estadoDelDebito, firmaValida, leerEvento, nuevoPagaHasta, planTrasRechazo,
} from "./logica.ts";

const OK = () => new Response("OK", { status: 200 });

Deno.serve(async (req) => {
  // MP no manda preflight: POST directo.
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => null);
    const evento = leerEvento(url, body);
    // Otros topics: 200 igual, o MP reintenta para siempre algo que no atendemos.
    if (!evento) return OK();

    const mpToken = Deno.env.get("DIVIANCO_MP_ACCESS_TOKEN");
    if (!mpToken) {
      console.error("suscripcion-webhook: falta DIVIANCO_MP_ACCESS_TOKEN");
      // 503: que MP reintente cuando el secret este cargado.
      return new Response("Not configured", { status: 503 });
    }

    const secreto = Deno.env.get("DIVIANCO_MP_WEBHOOK_SECRET");
    if (secreto) {
      const ok = await firmaValida(
        req.headers.get("x-signature"), req.headers.get("x-request-id"), evento.id, secreto,
      );
      if (!ok) {
        console.error("suscripcion-webhook: firma invalida", evento);
        return new Response("Invalid signature", { status: 401 });
      }
    } else {
      console.warn("suscripcion-webhook: sin DIVIANCO_MP_WEBHOOK_SECRET, no se valida la firma");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const preguntarAMp = async (ruta: string) => {
      const res = await fetch(`https://api.mercadopago.com${ruta}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      if (!res.ok) {
        console.error("suscripcion-webhook: MP no respondio", ruta, res.status);
        return null;
      }
      return await res.json();
    };

    /* ── La suscripcion cambio de estado ── */
    if (evento.tipo === "suscripcion") {
      const mp = await preguntarAMp(`/preapproval/${evento.id}`);
      // 502: puede ser momentaneo del lado de MP, que reintente.
      if (!mp) return new Response("Fetch failed", { status: 502 });
      const { error } = await supabase.from("suscripciones")
        .update({ estado: String(mp.status), updated_at: new Date().toISOString() })
        .eq("preapproval_id", String(mp.id));
      if (error) {
        console.error("suscripcion-webhook: no se pudo guardar el estado", error);
        return new Response("Update failed", { status: 500 });
      }
      return OK();
    }

    /* ── Un debito ── */
    const debito = await preguntarAMp(`/authorized_payments/${evento.id}`);
    if (!debito) return new Response("Fetch failed", { status: 502 });

    const { data: sus } = await supabase.from("suscripciones")
      .select("id, tenant_id, plan_id, ciclo")
      .eq("preapproval_id", String(debito.preapproval_id ?? "")).maybeSingle();
    if (!sus) {
      // Una suscripcion que Dico no conoce (otra app de la misma cuenta de MP).
      console.error("suscripcion-webhook: suscripcion desconocida", debito.preapproval_id);
      return OK();
    }
    if (!sus.tenant_id) {
      // No deberia pasar: el registro crea el negocio antes del primer debito.
      // 503 para que MP reintente cuando el negocio exista.
      console.error("suscripcion-webhook: debito de una suscripcion sin negocio", sus.id);
      return new Response("Tenant pending", { status: 503 });
    }

    const estado = estadoDelDebito(debito);
    const ahora = new Date();

    const { error: upErr } = await supabase.from("cobros_suscripcion").upsert({
      suscripcion_id: sus.id,
      tenant_id: sus.tenant_id,
      mp_pago_id: String(debito.id),
      monto: Number(debito.transaction_amount) || 0,
      estado: String((debito.payment as Record<string, unknown> | undefined)?.status ?? debito.status),
      updated_at: ahora.toISOString(),
    }, { onConflict: "mp_pago_id" });
    if (upErr) {
      console.error("suscripcion-webhook: no se pudo guardar el debito", upErr);
      return new Response("Update failed", { status: 500 });
    }

    const { data: negocio } = await supabase.from("tenants")
      .select("id, plan_id, paga_hasta").eq("id", sus.tenant_id).maybeSingle();
    if (!negocio) return OK();

    if (estado === "aprobado") {
      const hasta = nuevoPagaHasta(ahora, negocio.paga_hasta, sus.ciclo);
      // El reclamo atomico: solo el primer aviso de este debito corre la fecha.
      const { data: reclamado } = await supabase.from("cobros_suscripcion")
        .update({ cubre_hasta: hasta.toISOString() })
        .eq("mp_pago_id", String(debito.id)).is("cubre_hasta", null)
        .select("id");
      if (!reclamado?.length) return OK();

      const { error } = await supabase.from("tenants").update({
        plan_id: sus.plan_id,
        ciclo: sus.ciclo,
        paga_hasta: hasta.toISOString(),
        status: "active",
        suspendido_at: null,
        medio_de_cobro: "mercadopago",
      }).eq("id", negocio.id);
      if (error) {
        // Se suelta el reclamo para que el reintento de MP lo vuelva a intentar.
        console.error("suscripcion-webhook: no se pudo correr paga_hasta", error);
        await supabase.from("cobros_suscripcion").update({ cubre_hasta: null })
          .eq("mp_pago_id", String(debito.id));
        return new Response("Update failed", { status: 500 });
      }
      return OK();
    }

    if (estado === "rechazado") {
      const plan = planTrasRechazo(ahora, negocio.plan_id, negocio.paga_hasta);
      if (plan) {
        const { error } = await supabase.from("tenants").update({ plan_id: plan }).eq("id", negocio.id);
        if (error) {
          console.error("suscripcion-webhook: no se pudo bajar el plan", error);
          return new Response("Update failed", { status: 500 });
        }
      }
    }

    return OK();
  } catch (err) {
    console.error("suscripcion-webhook error:", err);
    // 200 a proposito: un 500 haria que MP reintente para siempre un error nuestro.
    return OK();
  }
});
