// src/services/platformPedidoManual.js
// Carga a mano de un pedido desde el panel. Va por submit-order, el mismo que
// usa el catalogo: precios, opciones, cupon y tasa congelada salen de un solo
// lugar. Lo distinto es `origen` + el token de la sesion del panel, que
// submit-order exige para aceptar un pedido que no viene del catalogo.
import { supabase } from '../lib/supabase';
import { claveDeIdempotencia, reiniciarClave } from '../lib/idempotencia';
import { firmaPedidoManual } from '../lib/pedidoManual';

const SCOPE = 'pedido-manual';

/**
 * @param {object} cuerpo  salida de cuerpoPedidoManual()
 * @returns {Promise<{ ok: true, orderId, total, fx?, warnings? } | { ok: false, error: string }>}
 */
export async function crearPedidoManual(cuerpo) {
  try {
    const { data: ses } = await supabase.auth.getSession();
    const token = ses?.session?.access_token;
    if (!token) return { ok: false, error: 'La sesión venció. Volvé a entrar al panel.' };

    const { data, error } = await supabase.functions.invoke('submit-order', {
      headers: { Authorization: `Bearer ${token}` },
      body: { ...cuerpo, client_request_id: claveDeIdempotencia(SCOPE, firmaPedidoManual(cuerpo)) },
    });

    if (error) {
      let msg = null;
      try {
        if (error.context && typeof error.context.json === 'function') msg = (await error.context.json())?.error || null;
      } catch { /* body no-json: mensaje generico */ }
      return { ok: false, error: msg || 'No se pudo cargar el pedido. Probá de nuevo.' };
    }
    if (!data?.ok) return { ok: false, error: data?.error || 'No se pudo cargar el pedido.' };

    // Entro: el proximo pedido es otro aunque repita los mismos productos.
    reiniciarClave(SCOPE);
    return {
      ok: true,
      orderId: data.orderId,
      total: data.total,
      ...(data.fx ? { fx: data.fx } : {}),
      ...(data.warnings ? { warnings: data.warnings } : {}),
    };
  } catch (err) {
    console.error('crearPedidoManual:', err);
    return { ok: false, error: 'No se pudo cargar el pedido. Revisá la conexión.' };
  }
}
