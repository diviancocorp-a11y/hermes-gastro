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

    // 2. Traer recetas visibles
    const { data: products, error: prodErr } = await supabase
      .from('recipes')
      .select('id, name, category, sale_price, image_url, description, related_ids')
      .eq('visible', true)
      .order('category', { ascending: true });

    if (prodErr) {
      console.error('Error cargando productos:', prodErr.message);
      return null;
    }

    return { settings, products: products || [] };

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

    // 2. Insertar el pedido en la tabla orders
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        status: 'new',
        date: new Date().toISOString().split('T')[0],
        customer: orderData.customer,
        phone: orderData.phone,
        email: orderData.email || null,
        delivery: orderData.delivery,
        payment: orderData.payment,
        note: orderData.note || null,
        total: orderData.total,
        is_gift: orderData.is_gift || false,
        gift_note: orderData.gift_note || ''
      })
      .select('id')  // Necesitamos el ID para los items
      .single();

    if (orderErr) {
      console.error('Error creando pedido:', orderErr.message);
      return false;
    }

    // 3. Insertar los items del pedido
    const items = orderData.items.map(item => ({
      order_id: order.id,
      recipe_id: item.recipeId,
      qty: item.qty,
      unit_price: item.unitPrice,
      subtotal: item.qty * item.unitPrice
    }));

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(items);

    if (itemsErr) {
      console.error('Error creando items del pedido:', itemsErr.message);
      // El pedido ya se creó pero sin items - esto no debería pasar
      return false;
    }

    return true;

  } catch (err) {
    console.error('Error inesperado en submitOrder:', err);
    return false;
  }
}