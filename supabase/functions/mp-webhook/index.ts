// supabase/functions/mp-webhook/index.ts
// Recibe notificaciones IPN/Webhook de MercadoPago cuando cambia el estado
// de un pago. Actualiza order.payment_status + order.paid_at.
//
// MP envía POST con body { action, type, data: { id } }.
// Para type='payment', `data.id` es el payment ID. Consultamos MP API para
// obtener el detalle (status, external_reference, etc.) y actualizamos la order.
//
// IMPORTANTE: MP puede reintentar el webhook varias veces — la operación
// debe ser IDEMPOTENTE. Por eso solo escribimos `paid_at` cuando pasa de
// pending → approved.
//
// Env vars:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // MP no respeta CORS preflight; aceptamos POST directo.
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // MP soporta varios formatos. El moderno es { action, type, data: { id } }.
    // También llega { topic, resource } en el legacy. Soportamos ambos.
    let paymentId: string | null = null;

    if (body?.type === 'payment' && body?.data?.id) {
      paymentId = String(body.data.id);
    } else if (body?.topic === 'payment' && body?.resource) {
      // resource es una URL tipo /v1/payments/12345
      const match = String(body.resource).match(/payments\/(\d+)/);
      if (match) paymentId = match[1];
    }

    // También puede venir el id en query string ?id=...&topic=payment
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

    // Solo escribimos paid_at en el primer aprobado (idempotencia)
    const updates: any = {
      payment_external_id: String(payment.id),
      payment_status: payment.status,
    };
    if (payment.status === 'approved') {
      // Solo setear paid_at si todavía no estaba
      const { data: current } = await supabase
        .from('orders')
        .select('paid_at')
        .eq('id', orderId)
        .single();
      if (!current?.paid_at) {
        updates.paid_at = new Date().toISOString();
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

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('mp-webhook error:', err);
    // Devolvemos 200 para que MP no reintente indefinidamente; el error queda
    // loggeado para investigar.
    return new Response('OK', { status: 200 });
  }
});
