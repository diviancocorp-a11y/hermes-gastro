// src/services/orderTracker.js
// El seguimiento de un pedido para el comprador (/order/:id, la vuelta de
// MercadoPago y la card "tu pedido" del catalogo).
//
// Va por el RPC publico get_order_tracker (0081): el comprador casi nunca tiene
// sesion, y la RLS de `orders` no le deja leer su propio pedido. El RPC acota
// al negocio del host y pide el uuid del pedido, que solo tiene quien lo hizo.
import { supabase } from '../lib/supabase';
import { resolveTenantSlug } from '../lib/activeTenant';

/** Estados en los que el pedido ya no cambia: no hace falta seguir mirando. */
export const ESTADOS_FINALES = Object.freeze(['completed', 'cancelled']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Trae el pedido. Devuelve `{ pedido, fallo }`:
 *   - pedido: el objeto del RPC, o null si no existe en este negocio.
 *   - fallo:  true si no se pudo preguntar (red, RPC caido). Distinto de "no
 *             existe": la card del catalogo se queda visible ante un fallo y
 *             solo se va cuando el pedido de verdad no esta.
 *
 * Un id que no es uuid (un codigo corto tipeado a mano) es "no existe": el
 * RPC no busca por codigo corto a proposito (ver 0081).
 */
export async function fetchOrderTracker(orderId) {
  const id = String(orderId || '').replace(/^#/, '').trim();
  if (!UUID.test(id)) return { pedido: null, fallo: false };

  const slug = await resolveTenantSlug();
  if (!slug) return { pedido: null, fallo: false };

  const { data, error } = await supabase.rpc('get_order_tracker', {
    p_tenant_slug: slug,
    p_order_id: id,
  });
  if (error) {
    console.error('get_order_tracker:', error.message);
    return { pedido: null, fallo: true };
  }
  return { pedido: data || null, fallo: false };
}
