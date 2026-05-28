// supabase/functions/create-payment-preference/index.ts
// Crea una preference en MercadoPago para una orden ya creada en la DB.
// Devuelve init_point (URL de pago) al frontend, que redirige al cliente.
//
// Flow:
//   1. Cliente termina checkout → submitOrder crea order con payment='mercadopago'
//   2. Frontend llama a esta función con orderId
//   3. Esta función:
//      - Lee la order de la DB
//      - Lee la integración MP activa (access_token del comerciante)
//      - Llama a MP API para crear preference (https://api.mercadopago.com/checkout/preferences)
//      - Guarda preference_id en order.payment_preference_id
//      - Devuelve init_point al frontend
//   4. Frontend redirige a init_point → cliente paga en MP → vuelve a back_urls
//
// Body esperado: { orderId: string, items: [{title, quantity, unit_price}], ... }
//
// Env vars:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - APP_URL (para back_urls, ej: https://la-nona-pato.vercel.app)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // 1. Cargar la orden
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, customer, phone, email, total, items, order_items')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Cargar la integración MP activa
    const { data: integration, error: intErr } = await supabase
      .from('payment_integrations')
      .select('access_token')
      .eq('provider', 'mercadopago')
      .eq('is_active', true)
      .single();

    if (intErr || !integration?.access_token) {
      return new Response(JSON.stringify({ error: 'MercadoPago no configurado' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Construir items de la preference. Si la orden tiene order_items con
    //    detalle individual, los usamos. Si no, fallback a un único item agregado.
    const items = Array.isArray(order.order_items) && order.order_items.length > 0
      ? order.order_items.map((it: any) => ({
          title: it.name || 'Producto',
          quantity: it.quantity || it.qty || 1,
          unit_price: Number(it.unit_price || 0),
          currency_id: 'ARS',
        }))
      : [{
          title: `Pedido #${String(order.id).slice(0, 8)}`,
          quantity: 1,
          unit_price: Number(order.total || 0),
          currency_id: 'ARS',
        }];

    // 4. Crear preference en MP
    const appUrl = Deno.env.get('APP_URL') ?? '';
    const preferencePayload = {
      items,
      external_reference: String(order.id),
      payer: {
        name: order.customer || '',
        email: order.email || undefined,
        phone: order.phone ? { number: order.phone } : undefined,
      },
      back_urls: appUrl ? {
        success: `${appUrl}/pago/exitoso?orderId=${order.id}`,
        failure: `${appUrl}/pago/fallido?orderId=${order.id}`,
        pending: `${appUrl}/pago/pendiente?orderId=${order.id}`,
      } : undefined,
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
      statement_descriptor: 'PEDIDO',
      metadata: { order_id: order.id },
    };

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

    // 5. Persistir preference_id en la orden + marcar provider
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
      init_point: pref.init_point,            // URL prod
      sandbox_init_point: pref.sandbox_init_point, // URL sandbox (para test)
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
