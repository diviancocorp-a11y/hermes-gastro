// src/services/telegramLink.js
// Vincula el Telegram del cliente con el telefono de su pedido.
//
// Telegram solo deja que un bot le escriba a quien lo autorizo, y entrega un
// chat_id que no tiene nada que ver con el telefono. Despues de un pedido hecho
// desde la mini app, se manda el `initData` firmado (el servidor lo valida con
// el token del bot) junto con el telefono, y asi el aviso de "tu pedido esta
// listo" sabe a que chat ir.
//
// Fuera de Telegram no hay initData y esto no hace nada. Nunca rompe un pedido:
// corre despues de que el pedido ya entro y traga cualquier error.

import { supabase } from '../lib/supabase';
import { resolveTenantSlug } from '../lib/activeTenant.js';

/** Pide permiso para que el bot le escriba. Si no responde, sigue igual. */
function pedirPermiso(tg, esperaMs = 1500) {
  return new Promise((resolve) => {
    let listo = false;
    const fin = () => { if (!listo) { listo = true; resolve(); } };
    try { tg.requestWriteAccess(fin); } catch { fin(); }
    setTimeout(fin, esperaMs);
  });
}

/**
 * @param {string} phone  el telefono del pedido
 * @returns {Promise<boolean>} true si el servidor registro el vinculo
 */
export async function vincularTelegram(phone) {
  try {
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
    const initData = tg?.initData;
    if (!initData || !phone) return false;

    const slug = await resolveTenantSlug();
    if (!slug) return false;

    await pedirPermiso(tg);

    const { data, error } = await supabase.functions.invoke('tg-vincular', {
      body: { tenant_slug: slug, init_data: initData, phone },
    });
    if (error) {
      console.warn('vincularTelegram (non-blocking):', error.message);
      return false;
    }
    return data?.ok === true;
  } catch (e) {
    console.warn('vincularTelegram (non-blocking):', e?.message);
    return false;
  }
}
