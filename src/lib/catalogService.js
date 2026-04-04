// src/lib/catalogService.js
// ─────────────────────────────────────────────────────────
// Este archivo conecta el catálogo público con Supabase.
// Solo tiene 2 funciones:
//   1. fetchCatalog()  → trae los productos visibles + settings
//   2. submitOrder()   → envía un pedido nuevo a la base de datos
// ─────────────────────────────────────────────────────────

import { supabase } from './supabase';

/**
 * Trae los datos que necesita el catálogo público:
 * - La configuración del negocio (nombre, logo, color)
 * - Los productos/recetas que tienen visible = true
 * 
 * Retorna: { settings: {...}, products: [...] }
 * Si hay error, retorna null
 */
export async function fetchCatalog() {
  try {
    // 1. Traer settings (solo hay una fila)
    const { data: settingsRows, error: settErr } = await supabase
      .from('settings')
      .select('*')
      .limit(1);

    if (settErr) {
      console.error('Error cargando settings:', settErr.message);
      return null;
    }

    // Si no hay settings, usamos valores por defecto
    const settings = settingsRows?.[0] || {
      biz_name: 'La Nona Pato',
      logo_letter: 'N',
      logo_color: '#C45D3E',
      cover_url: ''
    };

    // 2. Traer recetas visibles y no archivadas
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

    // 3. Traer hora del servidor (evita manipulación de reloj del cliente)
    let serverNow = new Date().toISOString(); // fallback al cliente
    try {
      const { data: timeData, error: timeErr } = await supabase
        .rpc('get_server_time');
      if (!timeErr && timeData) serverNow = timeData;
    } catch {
      // Si la función RPC no existe, usar hora del cliente como fallback
      console.warn('get_server_time RPC no disponible, usando hora local');
    }

    return { settings, products: products || [], serverNow };

  } catch (err) {
    console.error('Error inesperado en fetchCatalog:', err);
    return null;
  }
}

/**
 * Envía un pedido nuevo a Supabase.
 * Crea una fila en `orders` y varias filas en `order_items`.
 * También guarda/actualiza el cliente en `customers` para el CRM.
 * 
 * @param {Object} orderData - Los datos del pedido:
 *   { customer, phone, email, delivery, payment, address, note, items, total }
 *   donde items = [{ recipeId, qty, unitPrice }, ...]
 * 
 * Retorna: true si salió bien, false si hubo error
 */
export async function submitOrder(orderData) {
  try {
    // 1. Guardar/actualizar cliente para CRM futuro
    if (orderData.email) {
      await supabase
        .from('customers')
        .upsert({
          email: orderData.email,
          name: orderData.customer,
          phone: orderData.phone,
          last_order_at: new Date().toISOString()
        }, { onConflict: 'email' });
      // Si falla el upsert de cliente, no bloqueamos el pedido
    }

    // 2. Validar items y recalcular total server-side (prevenir manipulación)
    if (!orderData.items || orderData.items.length === 0) {
      console.error('submitOrder: no items');
      return { ok: false, orderId: null };
    }

    // Obtener precios reales de la DB para recalcular
    const recipeIds = [...new Set(orderData.items.map(i => i.recipeId))];
    const { data: dbRecipes } = await supabase
      .from('recipes')
      .select('id, sale_price')
      .in('id', recipeIds);
    const priceMap = {};
    (dbRecipes || []).forEach(r => { priceMap[r.id] = r.sale_price; });

    // Recalcular total validando precios (acepta descuentos del día hasta 15%)
    const MAX_DEAL_PCT = 15;
    let serverTotal = 0;
    const validatedItems = orderData.items.map(item => {
      const basePrice = priceMap[item.recipeId] || 0;
      const minAllowed = Math.round(basePrice * (1 - MAX_DEAL_PCT / 100));
      // Aceptar precio del frontend si está dentro del rango válido (deal o normal)
      let unitPrice = basePrice;
      if (item.unitPrice && item.unitPrice >= minAllowed && item.unitPrice <= basePrice) {
        unitPrice = item.unitPrice;
      }
      const qty = Math.max(1, Math.round(item.qty || 1));
      const subtotal = qty * unitPrice;
      serverTotal += subtotal;
      return { recipeId: item.recipeId, qty, unitPrice, subtotal };
    });

    // Aplicar descuento solo si hay cupón válido
    let validDiscount = 0;
    let validCouponId = null;
    if (orderData.coupon_id && orderData.discount > 0) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('id, discount_pct, used, expires_at, email')
        .eq('id', orderData.coupon_id)
        .eq('used', false)
        .single();
      if (coupon && (!coupon.expires_at || new Date(coupon.expires_at) >= new Date())) {
        if (!coupon.email || !orderData.email || coupon.email.toLowerCase() === orderData.email.toLowerCase()) {
          validDiscount = Math.round(serverTotal * (coupon.discount_pct / 100));
          validCouponId = coupon.id;
        }
      }
    }
    const finalTotal = Math.max(0, serverTotal - validDiscount);

    // 3. Insertar el pedido con total recalculado
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        status: 'new',
        date: new Date().toISOString().split('T')[0],
        customer: (orderData.customer || '').trim().slice(0, 200),
        phone: (orderData.phone || '').replace(/\D/g, '').slice(0, 20),
        email: orderData.email ? orderData.email.trim().toLowerCase().slice(0, 200) : null,
        delivery: ['retiro', 'envio'].includes(orderData.delivery) ? orderData.delivery : 'retiro',
        payment: ['efectivo', 'transferencia', 'mercadopago'].includes(orderData.payment) ? orderData.payment : 'efectivo',
        note: orderData.note ? orderData.note.trim().slice(0, 500) : null,
        total: finalTotal,
        is_gift: orderData.is_gift || false,
        gift_note: orderData.gift_note ? orderData.gift_note.trim().slice(0, 300) : '',
        coupon_id: validCouponId,
        discount: validDiscount,
        delivery_date: orderData.delivery_date || null
      })
      .select('id')
      .single();

    if (orderErr) {
      console.error('Error creando pedido:', orderErr.message);
      return { ok: false, orderId: null };
    }

    // 4. Marcar cupón como usado (Fix: antes no se hacía)
    if (validCouponId) {
      await supabase.from('coupons').update({ used: true }).eq('id', validCouponId);
    }

    // 5. Calcular unit_cost por receta (snapshot financiero)
    const costMap = {};
    for (const rid of recipeIds) {
      const { data: ris } = await supabase
        .from('recipe_ingredients')
        .select('qty, ingredients(cost)')
        .eq('recipe_id', rid);
      costMap[rid] = (ris || []).reduce((s, ri) => s + (ri.ingredients?.cost || 0) * (ri.qty || ri.quantity || 0), 0);
    }

    // 6. Insertar items con precios verificados
    const items = validatedItems.map(item => ({
      order_id: order.id,
      recipe_id: item.recipeId,
      qty: item.qty,
      unit_price: item.unitPrice,
      unit_cost: costMap[item.recipeId] || 0,
      subtotal: item.subtotal
    }));

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(items);

    if (itemsErr) {
      console.error('Error creando items del pedido:', itemsErr.message);
      // Limpiar la orden huérfana
      await supabase.from('orders').delete().eq('id', order.id);
      return { ok: false, orderId: null };
    }

    // 7. Sync backup de clientes (silencioso, no bloquea)
    syncCustomerBackup();

    // 8. Notificar cliente nuevo al webhook privado (silencioso)
    notifyNewCustomer(orderData);

    return { ok: true, orderId: order.id };

  } catch (err) {
    console.error('Error inesperado en submitOrder:', err);
    return { ok: false, orderId: null };
  }
}
/**
 * Valida un cupón de descuento para un cliente en el catálogo público.
 * Retorna { discount_pct, id } si es válido, null si no.
 */
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
      .upload('clientes/clientes_la_nona_pato.csv', blob, { upsert: true, contentType: 'text/csv' });
  } catch (e) {
    // Silencioso — nunca debe bloquear el flujo del pedido
    console.warn('syncCustomerBackup (non-blocking):', e?.message || e);
  }
}

// ─── NOTIFY NEW CUSTOMER (webhook privado) ───────────
// Si el cliente es nuevo (primera compra), envía sus datos a un
// webhook externo. Completamente silencioso, no bloquea nada.
async function notifyNewCustomer(orderData) {
  try {
    const webhookUrl = import.meta.env.VITE_CUSTOMER_WEBHOOK;
    if (!webhookUrl) return; // No configurado = no hace nada

    // Verificar si es cliente nuevo (sin pedidos previos)
    const key = orderData.phone || orderData.email;
    if (!key) return;

    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .or(`phone.eq.${orderData.phone || '---'},email.eq.${orderData.email || '---'}`)
      .neq('status', 'cancelled');

    // Si tiene más de 1 pedido (el actual), no es nuevo
    if (count && count > 1) return;

    // Cliente nuevo → notificar
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store: 'La Nona Pato',
        name: orderData.customer || '',
        phone: orderData.phone || '',
        email: orderData.email || '',
        address: orderData.address || '',
        payment: orderData.payment || ''
      })
    }).catch(() => {}); // Silencioso total
  } catch {
    // Nunca debe fallar el pedido por esto
  }
}

export async function validateCouponPublic(code, email) {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('id, code, discount_pct, email, used, expires_at')
      .eq('code', code.toUpperCase().trim())
      .eq('used', false)
      .single();
    if (error || !data) return null;
    if (data.email && email && data.email.toLowerCase() !== email.toLowerCase()) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    return { id: data.id, discount_pct: data.discount_pct };
  } catch { return null; }
}
