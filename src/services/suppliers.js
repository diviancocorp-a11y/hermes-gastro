/**
 * services/suppliers.js — CRUD de proveedores.
 *
 * Migración asociada: supabase/migrations/20260525_suppliers_and_receipts.sql
 */
import { supabase } from '../lib/supabase';

const TABLE = 'suppliers';

/**
 * Trae todos los proveedores activos (orden alfabético por nombre).
 */
export async function fetchSuppliers() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('is_active', true)
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
 * Soft-delete: marca como inactivo (preserva historial de gastos vinculados).
 */
export async function deleteSupplier(id) {
  const { error } = await supabase
    .from(TABLE)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('deleteSupplier:', error.message);
    return { __error: error.message };
  }
  return { ok: true };
}
