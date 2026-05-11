// src/services/categories.js
// Dynamic category groups fetched from DB with local fallback.
import { supabase } from '../lib/supabase';
import business from '@business';

// Fallback from per-client business config (empty array for new clients)
const FALLBACK_GROUPS = business.fallbackCategoryGroups || [];

/**
 * Fetch category groups from the database.
 * Returns array of { name, icon, subcategories, sort_order }.
 * Falls back to hardcoded defaults if the table doesn't exist or is empty.
 */
export async function fetchCategoryGroups() {
  try {
    const { data, error } = await supabase
      .from('category_groups')
      .select('id, name, icon, subcategories, sort_order, visible')
      .eq('visible', true)
      .order('sort_order', { ascending: true });

    if (error || !data?.length) return FALLBACK_GROUPS;

    return data.map(g => ({
      ...g,
      // Normalize: DB stores as text[], ensure it's a JS array
      subcategories: Array.isArray(g.subcategories) ? g.subcategories : [],
    }));
  } catch {
    return FALLBACK_GROUPS;
  }
}

/**
 * Build a sub-to-parent map from category groups.
 */
export function buildSubToParent(groups) {
  const map = {};
  groups.forEach(g => (g.subcategories || g.subs || []).forEach(s => { map[s] = g.name; }));
  return map;
}

/**
 * Convert DB format to the CAT_GROUPS format used by the catalog.
 */
export function toClientFormat(groups) {
  return groups.map(g => ({
    name: g.name,
    icon: g.icon,
    subs: g.subcategories || [],
  }));
}

// ─── Admin operations ─────────────────────────────────────────

export async function fetchAllCategoryGroups() {
  const { data, error } = await supabase
    .from('category_groups')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) { console.error('fetchAllCategoryGroups:', error.message); return []; }
  return data || [];
}

export async function upsertCategoryGroup(group) {
  const { data, error } = await supabase
    .from('category_groups')
    .upsert(group, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategoryGroup(id) {
  const { error } = await supabase
    .from('category_groups')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderCategoryGroups(orderedIds) {
  // Update sort_order for each id
  const updates = orderedIds.map((id, i) =>
    supabase.from('category_groups').update({ sort_order: i }).eq('id', id)
  );
  await Promise.all(updates);
}
