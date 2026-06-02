// src/services/phoneAuth.js
//
// Phone-only login (sin Supabase Auth). El usuario ingresa SOLO su teléfono
// y entra. La "sesión" vive en localStorage del dispositivo via guestUser
// extendido — NO hay sesión real de Supabase Auth, por lo tanto:
//   - No tiene acceso a tablas con RLS auth.uid()
//   - No sincroniza entre dispositivos
//   - Tampoco tiene los riesgos de compartir password
//
// Para cosas sensibles (cupones, perfiles persistentes cloud), el cliente
// hace magic link aparte ("upgrade" voluntario).

import { supabase } from '../lib/supabase';
import { setGuestUser, clearGuestUser } from '../lib/guestUser.js';

/** Limpia un teléfono a solo dígitos. */
export function cleanPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Busca si ya hay un cliente con este teléfono.
 * RPC SECURITY DEFINER que solo devuelve el nombre anonimizado y has_email.
 * Si no hay match, retorna null.
 */
export async function lookupCustomerByPhone(phone) {
  const cleaned = cleanPhone(phone);
  if (cleaned.length < 10) return null;
  const { data, error } = await supabase
    .rpc('lookup_customer_by_phone', { phone_search: cleaned });
  if (error) {
    console.error('lookupCustomerByPhone:', error.message);
    return null;
  }
  // RPC retorna array (TABLE) — tomamos el primero o null
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.display_name) return null;
  return {
    displayName: row.display_name,
    hasEmail: !!row.has_email,
    orderCount: row.order_count || 0,
    lastOrderAt: row.last_order_at || null,
  };
}

/**
 * Upsert dedup-aware del customer (busca por phone primero, después por email).
 * Retorna el customer_id (uuid). Usado tanto en signup phone-only como en
 * el guest order.
 */
export async function upsertCustomer({ phone, email, name, birth_date = null }) {
  const { data, error } = await supabase.rpc('upsert_customer', {
    p_phone: phone || null,
    p_email: email || null,
    p_name: name || null,
    p_birth_date: birth_date || null,
  });
  if (error) {
    console.error('upsertCustomer:', error.message);
    return null;
  }
  return data; // uuid del customer
}

/**
 * "Login" phone-only:
 * - Hace upsert del customer (crea o reusa).
 * - Persiste en localStorage como guestUser extendido con customer_id.
 * - Retorna el guest object para que el AuthContext sepa actualizarse.
 */
export async function phoneLogin({ phone, name, email = '', birth_date = null }) {
  const customerId = await upsertCustomer({ phone, email, name, birth_date });
  if (!customerId) return { ok: false, error: 'no_customer' };

  const guest = setGuestUser({
    id: customerId,
    name: name || '',
    phone: cleanPhone(phone),
    email: (email || '').toLowerCase().trim(),
  });

  return { ok: true, guest };
}

/** Cierra la sesión phone-only (limpia localStorage). */
export function phoneLogout() {
  clearGuestUser();
}
