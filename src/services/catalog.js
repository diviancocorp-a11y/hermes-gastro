// src/services/catalog.js
import { supabase } from '../lib/supabase';
import { OrderInputSchema, CouponValidateSchema, validateInput } from '../lib/schemas/index.js';
import business from '../config/business';

/**
 * Trae los datos que necesita el catálogo público:
 * - La configuración del negocio (nombre, logo, color)
 * - Los productos/recetas que tienen visible = true
 *
 * Retorna: { settings: {...}, products: [...] }
 * Si hay error, retorna null
 */
/**
 * Try the edge-cached get-catalog endpoint first.
 * Falls back to direct Supabase queries if the Edge Function isn't deployed.
 */
export async function fetchCatalog() {
  // 1. Try edge-cached endpoint (fast, CDN-backed)
  try {
    const { data, error } = await supabase.functions.invoke('get-catalog', { method: 'GET' });
    if (!error && data?.products) return data;
  } catch {
    // Edge function not deployed yet — fall through to direct queries
  }

  // 2. Fallback: direct Supabase queries
  return fetchCatalogDirect();
}

/**
 * Direct database fetch (original implementation). Used as fallback
 * when the get-catalog Edge Function is not yet deployed.
 */
async function fetchCatalogDirect() {
  try {
    const { data: settingsRows, error: settErr } = await supabase
      .from('settings')
      .select('*')
      .limit(1);

    if (settErr) {
      console.error('Error cargando settings:', settErr.message);
      return null;
    }

    const settings = settingsRows?.[0] || {
      biz_name: business.name,
      logo_letter: business.logoLetter,
      logo_color: business.logoColor,
      cover_url: business.defaultSettings.cover_url,
    };

    const { data: products, error: prodErr } = await supabase
      .from('recipes')
      .select('id, name, category, sale_price, image_url, description, related_ids')
      .eq('visible', true)
      .eq('is_archived', false)
      .order('category', { ascending: true });

    if (prodErr) {
      console.error('Error cargando productos:', prodErr.message);
      return null;
    }

    let serverNow = new Date().toISOString();
    try {
      const { data: timeData, error: timeErr } = await supabase.rpc('get_server_time');
      if (!timeErr && timeData) serverNow = timeData;
    } catch {
      console.warn('get_server_time RPC no disponible, usando hora local');
    }

    return { settings, products: products || [], serverNow };
  } catch (err) {
    console.error('Error inesperado en fetchCatalog:', err);
    return null;
  }
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
 *     coupon_code?, is_gift?, gift_note?, delivery_date?, user_id? }
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

    // Llamar a la Edge Function que calcula todo server-side
    const { data, error } = await supabase.functions.invoke('submit-order', {
      body: {
        customer: validated.customer,
        phone: validated.phone,
        email: validated.email,
        delivery: validated.delivery,
        payment: validated.payment,
        note: validated.note,
        items: validated.items.map(item => ({ recipeId: item.recipeId, qty: item.qty })),
        coupon_code: validated.coupon_code || null,
        is_gift: validated.is_gift || false,
        gift_note: validated.gift_note || '',
        delivery_date: validated.delivery_date || null,
        user_id: validated.user_id || null,
      },
    });

    if (error) {
      console.error('submitOrder edge function error:', error);
      return { ok: false, orderId: null };
    }

    if (!data?.ok) {
      console.error('submitOrder server error:', data?.error);
      return { ok: false, orderId: null };
    }

    // Sync backup de clientes — diferido 5s para no bloquear UI post-pedido
    setTimeout(() => syncCustomerBackup(), 5000);

    // Notificar cliente nuevo via Edge Function (silencioso, no bloquea)
    supabase.functions.invoke('notify-new-customer', {
      body: { orderId: data.orderId },
    }).catch(() => {}); // fire-and-forget

    return { ok: true, orderId: data.orderId };

  } catch (err) {
    console.error('Error inesperado en submitOrder:', err);
    return { ok: false, orderId: null };
  }
}

// ─── SYNC CUSTOMER BACKUP (automático, silencioso) ───
// Consolida clientes desde orders y sube CSV al bucket privado "backups"
// Se ejecuta después de cada pedido exitoso. Si falla, no bloquea nada.
async function syncCustomerBackup() {
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('customer, phone, email, total, status, created_at, delivery, payment, address')
      .order('created_at', { ascending: false });
    if (!orders || orders.length === 0) return;

    // Consolidar clientes únicos
    const map = {};
    orders.forEach(o => {
      const key = (o.phone || o.email || o.customer || '').toLowerCase();
      if (!key) return;
      if (!map[key]) map[key] = {
        nombre: '', telefono: '', email: '',
        pedidos: 0, total_gastado: 0, ultimo_pedido: '',
        direccion: '', metodo_pago: '', metodo_entrega: ''
      };
      const c = map[key];
      c.pedidos++;
      c.total_gastado += (o.total || 0);
      if (!c.nombre && o.customer) c.nombre = o.customer;
      if (!c.telefono && o.phone) c.telefono = o.phone;
      if (!c.email && o.email) c.email = o.email;
      if (!c.direccion && o.address) c.direccion = o.address;
      if (o.created_at > c.ultimo_pedido) {
        c.ultimo_pedido = o.created_at;
        c.metodo_pago = o.payment || '';
        c.metodo_entrega = o.delivery || '';
      }
    });

    const customers = Object.values(map).sort((a, b) => b.total_gastado - a.total_gastado);

    // Generar CSV con BOM para Excel
    const esc = (v) => {
      const s = String(v || '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const hdr = 'Nombre,Teléfono,Email,Pedidos,Total Gastado,Último Pedido,Dirección,Método Pago,Método Entrega';
    const rows = customers.map(c =>
      [esc(c.nombre), esc(c.telefono), esc(c.email), c.pedidos, c.total_gastado,
       esc(c.ultimo_pedido?.split('T')[0] || ''), esc(c.direccion), esc(c.metodo_pago), esc(c.metodo_entrega)].join(',')
    );
    const csv = '\uFEFF' + hdr + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    // Subir al bucket privado "backups" (sobreescribe el anterior)
    await supabase.storage
      .from('backups')
      .upload('clientes/clientes_export.csv', blob, { upsert: true, contentType: 'text/csv' });
  } catch (e) {
    // Silencioso — nunca debe bloquear el flujo del pedido
    console.warn('syncCustomerBackup (non-blocking):', e?.message || e);
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
  } catch { return null; }
}
