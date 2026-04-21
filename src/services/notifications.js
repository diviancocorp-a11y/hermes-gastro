// src/services/notifications.js
import { supabase } from '../lib/supabase';
import { NotifyWhatsAppSchema, validateInput } from '../lib/schemas/index.js';

/**
 * Notifica al cliente por WhatsApp cuando cambia el estado de su pedido.
 * La Edge Function lee los datos del pedido de la DB y usa credenciales
 * Twilio almacenadas en secrets del servidor (no en el bundle del cliente).
 *
 * @param {string} orderId - UUID del pedido
 * @param {string} status - Nuevo estado: 'prep' | 'active' | 'done' | 'cancel'
 * @returns {Promise<boolean>} true si se envió correctamente
 */
export async function notifyWhatsApp(orderId, status) {
  const validation = validateInput(NotifyWhatsAppSchema, { orderId, status }, 'notifyWhatsApp');
  if (!validation.ok) return false;
  try {
    const { data, error } = await supabase.functions.invoke('notify-whatsapp', {
      body: validation.data,
    });
    if (error) {
      console.error('notifyWhatsApp edge function error:', error);
      return false;
    }
    return data?.ok === true;
  } catch (err) {
    console.error('notifyWhatsApp:', err);
    return false;
  }
}
