// src/services/inventory.js
import { supabase } from '../lib/supabase';
import {
  IngredientInputSchema, WasteInputSchema, validateInput,
} from '../lib/schemas/index.js';

const PAGE_SIZE = 50;

export async function fetchIngredients() {
  const { data, error } = await supabase.from('ingredients').select('*').order('name');
  if (error) { console.error('fetchIngredients:', error.message); return []; }
  return data || [];
}

export async function upsertIngredient(ingredient) {
  const validation = validateInput(IngredientInputSchema, ingredient, 'upsertIngredient');
  if (!validation.ok) return { __error: validation.errors.join(', ') };
  const validated = validation.data;
  const clean = { name: validated.name, unit: validated.unit, cost: validated.cost, stock: validated.stock, min_stock: validated.min_stock, category: validated.category };
  if (validated.id) clean.id = validated.id;
  const { data, error } = await supabase.from('ingredients').upsert(clean).select().single();
  if (error) { console.error('upsertIngredient:', error.message); return { __error: error.message }; }
  return data;
}

export async function deleteIngredient(id) {
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  return !error;
}

// ─── STOCK UPDATE (atómico — evita race conditions) ─────────────
export async function updateIngredientStock(ingredientId, deltaQty) {
  // Intentar usar RPC atómico primero
  const { error: rpcErr } = await supabase.rpc('adjust_stock', {
    p_ingredient_id: ingredientId,
    p_delta: deltaQty
  });
  if (!rpcErr) return;
  // Fallback: read-then-write (si la función RPC no existe aún)
  console.warn('adjust_stock RPC not available, using fallback:', rpcErr.message);
  const { data: ing } = await supabase.from('ingredients').select('stock').eq('id', ingredientId).single();
  if (ing) {
    const newStock = Math.max(0, (ing.stock || 0) + deltaQty);
    await supabase.from('ingredients').update({ stock: newStock }).eq('id', ingredientId);
  }
}

/**
 * Fetch waste log with cursor pagination.
 * Backward-compatible: no args → returns flat array (first 50).
 */
export async function fetchWasteLog({ before, limit = PAGE_SIZE } = {}) {
  const fetchLimit = before ? limit + 1 : limit;
  let query = supabase
    .from('waste_log')
    .select('*, ingredients(name, unit)')
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) { console.error('fetchWasteLog:', error.message); return before ? { data: [], nextCursor: null } : []; }

  const rows = data || [];

  // When called with pagination args, return paginated result
  if (before) {
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].created_at : null;
    return { data: page, nextCursor };
  }

  // Backward-compatible: return flat array
  return rows;
}

export async function registerWaste(ingredientId, qty, reason, note = '') {
  const validation = validateInput(WasteInputSchema, { ingredient_id: ingredientId, qty, reason, note }, 'registerWaste');
  if (!validation.ok) { console.error('registerWaste validation:', validation.errors); return false; }
  const v = validation.data;
  // 1. Registrar la merma
  const { error: logErr } = await supabase.from('waste_log').insert({
    ingredient_id: v.ingredient_id, qty: v.qty, reason: v.reason, note: v.note,
    date: new Date().toISOString().split('T')[0]
  });
  if (logErr) { console.error('registerWaste log:', logErr.message); return false; }
  // 2. Descontar del stock (atómico)
  await updateIngredientStock(ingredientId, -qty);
  return true;
}
