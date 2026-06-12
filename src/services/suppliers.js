/**
 * services/suppliers.js — CRUD de proveedores.
 *
 * Migraciones asociadas:
 *   supabase/migrations/20260525_suppliers_and_receipts.sql
 *   supabase/migrations/20260612_suppliers_cuit_invoice_location.sql
 *
 * is_active es PAUSE/PLAY (12/jun): pausado no aparece en los selectores
 * de gastos/compras y va al fondo del gestor. Eliminar es DELETE real
 * (la FK de expenses suelta la referencia, el texto se preserva).
 */
import { supabase } from '../lib/supabase';

const TABLE = 'suppliers';

/**
 * Trae proveedores. Por default solo ACTIVOS (selectores de gastos/compras).
 * Con { activeOnly: false } trae todos (gestor): activos primero, pausados
 * al fondo, alfabetico dentro de cada grupo.
 */
export async function fetchSuppliers({ activeOnly = true } = {}) {
  let q = supabase.from(TABLE).select('*');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });
  if (error) {
    console.error('fetchSuppliers:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Crea o actualiza un proveedor. Si `supplier.id` existe, hace update; sino, insert.
 */
export async function upsertSupplier(supplier) {
  const payload = {
    ...supplier,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) {
    console.error('upsertSupplier:', error.message);
    return { __error: error.message };
  }
  return data;
}

/**
 * Pause/play: activa o pausa un proveedor.
 */
export async function toggleSupplierActive(id, isActive) {
  const { error } = await supabase
    .from(TABLE)
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('toggleSupplierActive:', error.message);
    return { __error: error.message };
  }
  return { ok: true };
}

/**
 * Eliminacion REAL de la fila. Los gastos historicos conservan el nombre
 * en texto (supplier) y sueltan la referencia (FK on delete set null).
 */
export async function deleteSupplier(id) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) {
    console.error('deleteSupplier:', error.message);
    return { __error: error.message };
  }
  return { ok: true };
}
