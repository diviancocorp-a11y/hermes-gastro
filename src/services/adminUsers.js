// src/services/adminUsers.js
// Gestion de usuarios del admin via edge function admin-users (Sprint 1).
// Solo owners pueden operar (la function valida el JWT contra admin_users).
import { supabase } from '../lib/supabase';

async function call(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload },
  });
  if (error) {
    // FunctionsHttpError: el body real viene en error.context
    let message = error.message || 'Error de conexion';
    try {
      if (error.context && typeof error.context.json === 'function') {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      }
    } catch { /* empty */ }
    return { ok: false, error: message };
  }
  if (!data?.ok) return { ok: false, error: data?.error || 'Error desconocido' };
  return data;
}

/** Lista los usuarios con acceso al admin. */
export async function listAdminUsers() {
  return call('list');
}

/** Crea (o reusa) un usuario y le da acceso al admin con el rol indicado. */
export async function createAdminUser(email, password, role = 'staff') {
  return call('create', { email, password, role });
}

/** Cambia el rol owner/staff. */
export async function setAdminRole(userId, role) {
  return call('set_role', { user_id: userId, role });
}

/** Quita el acceso al admin (no borra la cuenta). */
export async function removeAdminUser(userId) {
  return call('remove', { user_id: userId });
}
