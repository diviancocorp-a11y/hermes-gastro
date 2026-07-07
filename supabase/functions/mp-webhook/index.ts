// supabase/functions/mp-webhook/index.ts
// Recibe notificaciones IPN/Webhook de MercadoPago cuando cambia el estado de
// un pago. Concilia el pago con la orden (external_reference = order.id).
//
// MP envia POST con body { action, type, data: { id } } (moderno) o
// { topic, resource } (legacy). Tambien puede venir el id por query string.
//
// FLUJO pending_payment (jun/2026):
//   - submit-order crea las ordenes de MercadoPago como `pending_payment`
//     (invisibles en el panel del admin: todavia no hay plata).
//   - Cuando el pago se APRUEBA, este webhook promueve la orden a `new`
//     (entra al panel), setea paid_at y dispara el push "Nuevo pedido".
//   - Si el cliente nunca paga, un cron la auto-cancela a los 30 min.
//
// IDEMPOTENCIA: MP reintenta el webhook varias veces. Solo promovemos y
// pusheamos cuando la orden todavia esta en pending_payment (o fue
// auto-cancelada sin pagar). Una segunda notificacion aprobada no repite el
// push ni vuelve a tocar el estado.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // MP no respeta CORS preflight; aceptamos POST directo.
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // MP soporta varios formatos. El moderno es { action, type, data: { id } }.
    // Tambien llega { topic, resource } en el legacy. Soportamos ambos.
    let paymentId: string | null = null;

    if (body?.type === 'payment' && body?.data?.id) {
      paymentId = String(body.data.id);
    } else if (body?.topic === 'payment' && body?.resource) {
      // resource es una URL tipo /v1/payments/12345
      const match = String(body.resource).match(/payments\/(\d+)/);
      if (match) paymentId = match[1];
    }

    // Tambien puede venir el id en query string ?id=...&topic=payment
    if (!paymentId) {
      const url = new URL(req.url);
      const idParam = url.searchParams.get('id') || url.searchParams.get('data.id');
      const topicParam = url.searchParams.get('topic') || url.searchParams.get('type');
      if (idParam && topicParam === 'payment') paymentId = idParam;
    }

    if (!paymentId) {
      // Otros tipos de notification (merchant_order, plan, subscription) los
      // ignoramos por ahora. Respondemos 200 para que MP no reintente.
      console.log('mp-webhook: ignored (no payment id)', body);
      return new Response('OK', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Necesitamos el access_token para consultar MP API
    const { data: integration } = await supabase
      .from('payment_integrations')
      .select('access_token')
      .eq('provider', 'mercadopago')
      .eq('is_active', true)
      .single();

    if (!integration?.access_token) {
      console.error('mp-webhook: no MP integration');
      return new Response('No MP integration', { status: 503 });
    }

    // Consultar el payment en MP API
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${integration.access_token}` },
    });

    if (!paymentRes.ok) {
      console.error('mp-webhook: failed to fetch payment', paymentId, paymentRes.status);
      return new Response('Payment fetch failed', { status: 502 });
    }

    const payment = await paymentRes.json();
    // payment.status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'refunded' | 'cancelled'
    // payment.external_reference: el order.id que pusimos al crear la preference
    const orderId = payment.external_reference;
    if (!orderId) {
      console.warn('mp-webhook: payment without external_reference', paymentId);
      return new Response('OK', { status: 200 });
    }

    // Estado actual de la orden (para idempotencia + promocion + datos del push)
    const { data: current } = await supabase
      .from('orders')
      .select('status, paid_at, customer, total')
      .eq('id', orderId)
      .single();

    const updates: any = {
      payment_external_id: String(payment.id),
      payment_status: payment.status,
    };

    // Promover a 'new' (entra al panel) SOLO si la orden todavia esperaba el
    // pago, o si el cron la auto-cancelo sin que hubiera pagado (pago tardio).
    // Una orden ya promovida/avanzada por el admin no se vuelve a tocar -> el
    // push de "Nuevo pedido" sale una sola vez (idempotente ante reintentos).
    let promote = false;
    if (payment.status === 'approved') {
      if (!current?.paid_at) updates.paid_at = new Date().toISOString();
      const st = current?.status;
      if (st === 'pending_payment' || (st === 'cancelled' && !current?.paid_at)) {
        updates.status = 'new';
        promote = true;
      }
    }

    const { error: updErr } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (updErr) {
      console.error('mp-webhook: order update failed', updErr);
      return new Response('Update failed', { status: 500 });
    }

    // Recien ahora (pago confirmado) avisamos al admin — mismo push que las
    // ordenes en efectivo/transferencia disparan al crearse.
    if (promote) {
      try {
        await supabase.functions.invoke('send-push', {
          body: {
            title: 'Nuevo pedido',
            body: `${current?.customer || 'Cliente'} - $${current?.total ?? ''} (pagado)`,
            url: '/admin?tab=orders',
            target: { role: 'admin' },
          },
        });
      } catch (e) {
        console.warn('mp-webhook: send-push admin (non-blocking):', e?.message);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('mp-webhook error:', err);
    // Devolvemos 200 para que MP no reintente indefinidamente; el error queda
    // loggeado para investigar.
    return new Response('OK', { status: 200 });
  }
});
