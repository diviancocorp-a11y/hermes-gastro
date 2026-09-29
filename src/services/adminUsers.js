// src/services/adminUsers.js
// Gestion del equipo que entra al panel.
//
// Los permisos viven en `tenant_members`: una fila por persona POR NEGOCIO.
// La misma persona puede ser duena de un local y staff de otro. (El legacy
// usaba `admin_users` y la function admin-users; se borro el 29/sep.)
import { supabase } from '../lib/supabase';
import { resolveTenantSlug } from '../lib/activeTenant';

async function call(action, payload = {}) {
  const slug = await resolveTenantSlug();
  if (!slug) return { ok: false, error: 'No se pudo identificar el negocio' };
  const cuerpo = { action, ...payload, tenant_slug: slug };
  const { data, error } = await supabase.functions.invoke('tenant-users', { body: cuerpo });
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

/* Una persona tiene VARIOS roles y puede tenerlos acotados a una sucursal. */

/**
 * Suma a alguien al equipo con nombre y roles. `branchId` null = todas.
 * Si el email YA tiene cuenta en la plataforma se lo suma SIN tocarle la
 * contrasena: la respuesta trae `reused: true` y un mensaje para avisarlo.
 */
export async function addMember(name, email, password, roles, branchId = null) {
  return call('create', { name, email, password, roles, branch_id: branchId });
}

/** Cambia los roles de un miembro. */
export async function setMemberRoles(userId, roles) {
  return call('set_role', { user_id: userId, roles });
}

/** Quita el acceso al admin (no borra la cuenta). */
export async function removeAdminUser(userId) {
  return call('remove', { user_id: userId });
}
