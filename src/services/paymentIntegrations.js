// src/services/paymentIntegrations.js
// Mercado Pago desde el CATALOGO: si el negocio cobra online y la preferencia
// de pago de un pedido. Conectar la cuenta es cosa del panel
// (services/platformPagos.js -> mp-connect).
//
// El edificio tiene una cuenta de MP POR negocio, asi que las functions
// necesitan saber de quien es el cobro (tenant_slug). La de la preferencia
// ademas verifica que el pedido pertenezca a ese negocio.
//
// Hasta el 29/sep este archivo tambien tenia la conexion del ERP legacy
// (mp-connect-manual, OAuth con mp-oauth-callback y lectura directa de
// payment_integrations): ninguna de esas functions existe en el edificio.

import { supabase } from "../lib/supabase";
import { captureException } from "../lib/observability.js";
import { getTenantSlugSync } from "../lib/activeTenant";

/**
 * Si el negocio tiene MP conectado. Usable sin sesion: la edge function
 * mp-status devuelve solo campos seguros (NUNCA access_token). Si MP no esta
 * conectado, devuelve { active: false }.
 */
export async function fetchMpStatusPublic() {
  try {
    const body = { tenant_slug: getTenantSlugSync() };
    const { data, error } = await supabase.functions.invoke("mp-status", { body });
    if (error) {
      console.warn("fetchMpStatusPublic:", error.message);
      return { active: false };
    }
    // La function contesta `conectado`; el catalogo lee `active`.
    return { active: !!data?.conectado, ...(data || {}) };
  } catch (e) {
    console.warn("fetchMpStatusPublic exception:", e);
    // Reporte a Sentry: si MP API falla, queremos saber cuántas veces y por qué
    captureException(e, { tags: { source: 'fetchMpStatusPublic' } });
    return { active: false };
  }
}

/**
 * Crea una preference MP para una orden y devuelve init_point.
 * Llamar desde el Catalog público cuando el cliente eligió pagar con MP.
 */
export async function createMpPreference(orderId) {
  // El importe NO viaja: lo saca la function de la base. Si viniera de aca,
  // cualquiera pagaria $1 un pedido de $20.000.
  const body = { tenant_slug: getTenantSlugSync(), order_id: orderId };
  const { data, error } = await supabase.functions.invoke("mp-preference", { body });
  if (error) { console.error("createMpPreference:", error.message); return null; }
  return data;
}
