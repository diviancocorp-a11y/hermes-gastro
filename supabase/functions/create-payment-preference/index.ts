// create-payment-preference v9 — crea preference en MercadoPago para un pedido.
//
// Fix 12/jun/2026: la version anterior hacia select de columnas inexistentes
// (orders.items / orders.order_items) -> PostgREST error -> 404 "Order not found"
// en TODOS los tenants. El front caia al fallback manual sin redirigir a MP.
//
// La preference se crea con UN solo item por el total de la orden: el total
// incluye envio + propina - descuento, asi que itemizar order_items cobraria
// de menos. external_reference = order.id para conciliar via mp-webhook.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL (back_urls).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Missing orderId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 1. Cargar la orden (solo columnas que existen en el schema real)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, customer, phone, email, total, payment, status')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      console.error('Order not found:', orderId, orderErr);
      return new Response(JSON.stringify({ error: 'Order not found', orderId }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const total = Number(order.total || 0);
    if (!(total > 0)) {
      return new Response(JSON.stringify({ error: 'Order total invalido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Integracion MP activa
    const { data: integration, error: intErr } = await supabase
      .from('payment_integrations')
      .select('access_token')
      .eq('provider', 'mercadopago')
      .eq('is_active', true)
      .single();

    if (intErr || !integration?.access_token) {
      console.error('MP no configurado:', intErr);
      return new Response(JSON.stringify({ error: 'MercadoPago no configurado' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Preference: un solo item por el total (incluye envio/propina/descuento)
    const appUrl = Deno.env.get('APP_URL') ?? '';
    const preferencePayload: Record<string, unknown> = {
      items: [{
        id: String(order.id),
        title: `Pedido #${String(order.id).slice(0, 8)}`,
        quantity: 1,
        unit_price: total,
        currency_id: 'ARS',
      }],
      external_reference: String(order.id),
      payer: {
        name: order.customer || '',
        email: order.email || undefined,
        phone: order.phone ? { number: order.phone } : undefined,
      },
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
      statement_descriptor: 'PEDIDO',
      metadata: { order_id: order.id },
    };
    if (appUrl) {
      preferencePayload.back_urls = {
        success: `${appUrl}/pago/exitoso?orderId=${order.id}`,
        failure: `${appUrl}/pago/fallido?orderId=${order.id}`,
        pending: `${appUrl}/pago/pendiente?orderId=${order.id}`,
      };
      preferencePayload.auto_return = 'approved';
    } else {
      console.warn('APP_URL no seteada: preference sin back_urls (el cliente no vuelve solo al sitio)');
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.access_token}`,
      },
      body: JSON.stringify(preferencePayload),
    });

    if (!mpRes.ok) {
      const errBody = await mpRes.text();
      console.error('MP preference create failed:', mpRes.status, errBody);
      return new Response(JSON.stringify({ error: 'MP preference failed', detail: errBody }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pref = await mpRes.json();

    await supabase
      .from('orders')
      .update({
        payment_provider: 'mercadopago',
        payment_preference_id: pref.id,
        payment_status: 'pending',
      })
      .eq('id', order.id);

    return new Response(JSON.stringify({
      ok: true,
      preference_id: pref.id,
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-payment-preference error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
