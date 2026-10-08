// src/services/catalog.js
import { supabase } from '../lib/supabase';
import { OrderInputSchema, CouponValidateSchema, validateInput } from '../lib/schemas/index.js';
import { setGuestUser } from '../lib/guestUser.js';
import { resolveTenantSlug } from '../lib/activeTenant.js';
import { claveDeIdempotencia, reiniciarClave } from '../lib/idempotencia.js';
import { vincularTelegram } from './telegramLink.js';

/**
 * Trae los datos que necesita el catálogo público: la configuración del
 * negocio (nombre, logo, color, tema) y los productos visibles.
 *
 * Un solo RPC (get_catalog) devuelve settings+products ya con el shape de
 * catalog-pro. El tenant sale del HOSTNAME, no del build: un mismo bundle
 * sirve a todos. business.slug queda solo como fallback de dev/preview.
 *
 * Retorna: { settings, products, serverNow }, o null si no hay catalogo que
 * mostrar o fallo el RPC.
 */
export async function fetchCatalog() {
  try {
    const slug = await resolveTenantSlug();
    if (!slug) {
      // Raiz de la plataforma (divianco.app): no hay catalogo que mostrar,
      // va la landing. No es un error.
      return null;
    }
    const { data, error } = await supabase.rpc('get_catalog', { p_tenant_slug: slug });
    if (error || !data) {
      console.error('get_catalog RPC error:', error?.message);
      return null;
    }
    return {
      settings: data.settings || {},
      products: data.products || [],
      serverNow: data.serverNow || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error inesperado en fetchCatalog:', err);
    return null;
  }
}

// Lo que hace que dos envios sean "el mismo pedido": quien, como y que. No
// entra el timestamp a proposito — si entrara, un reintento seria un pedido
// nuevo y la garantia no serviria para nada.
function firmaDelPedido(p) {
  return [
    p.phone, p.delivery, p.payment, p.address,
    (p.items || []).map(i => [i.recipeId, i.qty]),
    p.coupon_code, p.tip_pct, p.delivery_cost,
    p.table_code,
  ];
}

/**
 * Envía un pedido nuevo via Edge Function server-side.
 * El servidor calcula precios, valida cupones y gestiona el CRM.
 * El cliente solo envía: nombre, teléfono, items (recipeId + qty), y preferencias de entrega/pago.
 *
 * SEGURIDAD: El cliente NO envía precios. Los precios se calculan server-side
 * usando el catálogo de la DB + deals del día. Esto previene manipulación de precios.
 *
 * @param {Object} orderData - Los datos del pedido:
 *   { customer, phone, email, delivery, payment, note, items: [{recipeId, qty}],
 *     coupon_code?, is_gift?, gift_note?, delivery_date?, user_id?,
 *     address?, delivery_cost?, tip_pct? }
 *
 * @returns {{ ok: boolean, orderId: string|null }}
 */
export async function submitOrder(orderData) {
  try {
    // Validar inputs con Zod antes de enviar al servidor
    const validation = validateInput(OrderInputSchema, orderData, 'submitOrder');
    if (!validation.ok) {
      console.error('submitOrder validation failed:', validation.errors);
      return { ok: false, orderId: null, errors: validation.errors };
    }
    const validated = validation.data;

    // Sin tenant_slug la function rechaza el pedido (400). Sale del hostname
    // igual que el catalogo — si el pedido se armo mirando
    // cochi.divianco.app, tiene que entrar en cochi.
    const tenantSlug = await resolveTenantSlug();

    // Llamar a la Edge Function que calcula todo server-side
    const { data, error } = await supabase.functions.invoke('submit-order', {
      body: {
        tenant_slug: tenantSlug,
        customer: validated.customer,
        phone: validated.phone,
        email: validated.email,
        delivery: validated.delivery,
        payment: validated.payment,
        payment_account_id: validated.payment_account_id || null,
        note: validated.note,
        items: validated.items.map(item => ({ recipeId: item.recipeId, qty: item.qty })),
        coupon_code: validated.coupon_code || null,
        is_gift: validated.is_gift || false,
        gift_note: validated.gift_note || '',
        delivery_date: validated.delivery_date || null,
        user_id: validated.user_id || null,
        // address y delivery_cost DEBEN ir validados (Zod) — ver bug Zod-strip #5
        address: validated.address || null,
        delivery_cost: validated.delivery_cost || 0,
        tip_pct: validated.tip_pct || 0,
        table_code: validated.table_code || null,
        client_request_id: claveDeIdempotencia('checkout', firmaDelPedido(validated)),
      },
    });

    if (error) {
      // FunctionsHttpError: el mensaje util del server (429 rate limit,
      // "producto no disponible", "cuenta de pago no valida") viene en
      // error.context — propagarlo para que el checkout lo muestre (Sprint 4).
      let serverMsg = null;
      try {
        if (error.context && typeof error.context.json === 'function') {
          const body = await error.context.json();
          serverMsg = body?.error || null;
        }
      } catch { /* body no-json: usamos generico */ }
      console.error('submitOrder edge function error:', serverMsg || error);
      return { ok: false, orderId: null, error: serverMsg };
    }

    if (!data?.ok) {
      console.error('submitOrder server error:', data?.error);
      return { ok: false, orderId: null, error: data?.error || null };
    }

    // El pedido entro (o ya estaba). Lo proximo que arme este cliente es un
    // pedido nuevo, aunque repita exactamente los mismos items.
    reiniciarClave('checkout');

    // Persistir identidad guest: el usuario ya tiene al menos 1 pedido y
    // queda "registrado" sin volver a loguearse. Va sin id: la ficha del
    // cliente la arma submit-order del lado del servidor. Hasta el 29/sep aca
    // se llamaba a upsert_customer, notify-new-customer y un backup CSV de
    // clientes: legacy que en el edificio fallaba en silencio en cada pedido.
    setGuestUser({
      id: null,
      name: validated.customer,
      phone: validated.phone,
      email: validated.email,
    });

    // Si el pedido se hizo desde la mini app de Telegram, se vincula ese chat
    // con el telefono para poder avisarle el estado. Sin esperar: no es parte
    // del pedido y no puede demorar la pantalla de "listo".
    void vincularTelegram(validated.phone);

    return { ok: true, orderId: data.orderId };

  } catch (err) {
    console.error('Error inesperado en submitOrder:', err);
    return { ok: false, orderId: null };
  }
}

export async function validateCouponPublic(code, email) {
  try {
    const validation = validateInput(CouponValidateSchema, { code, email }, 'validateCouponPublic');
    if (!validation.ok) return null;
    const { code: cleanCode, email: cleanEmail } = validation.data;

    const { data, error } = await supabase
      .from('coupons')
      .select('id, code, discount_pct, email, used, expires_at')
      .eq('code', cleanCode.toUpperCase().trim())
      .eq('used', false)
      .single();
    if (error || !data) return null;
    if (data.email && cleanEmail && data.email.toLowerCase() !== cleanEmail.toLowerCase()) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    return { id: data.id, discount_pct: data.discount_pct };
  } catch (err) {
    console.error('Error en validateCouponPublic:', err);
    return null;
  }
}
