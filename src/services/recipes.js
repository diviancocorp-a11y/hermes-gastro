// src/services/recipes.js
import { supabase } from '../lib/supabase';
import {
  RecipeInputSchema, ComboItemSchema, validateInput,
} from '../lib/schemas/index.js';
import { updateIngredientStock } from './inventory.js';

export async function fetchAllRecipes() {
  const { data, error } = await supabase.from('recipes').select('*').order('category');
  if (error) { console.error('fetchAllRecipes:', error.message); return []; }
  return data || [];
}

export async function upsertRecipe(recipe) {
  const validation = validateInput(RecipeInputSchema, recipe, 'upsertRecipe');
  if (!validation.ok) return { __error: 'validation', message: validation.errors.join(', ') };
  const { data, error } = await supabase.from('recipes').upsert(validation.data).select().single();
  if (error) {
    console.error('upsertRecipe:', error.message);
    if (error.message?.includes('unique') || error.message?.includes('duplicate') || error.code === '23505') {
      return { __error: 'duplicate', message: 'Ya existe una receta activa con ese nombre' };
    }
    return null;
  }
  return data;
}

// Toggle de visibilidad rápido (usa update, no upsert, para evitar conflictos con NOT NULL)
export async function toggleRecipeVisibility(id, visible) {
  const { error } = await supabase.from('recipes').update({ visible }).eq('id', id);
  if (error) { console.error('toggleRecipeVisibility:', error.message); return false; }
  return true;
}

// Override manual de disponibilidad en catalogo (play/pause).
//   null  = auto (respeta la regla de stock)
//   true  = forzar disponible (se vende aunque falte materia prima)
//   false = forzar agotado (visible pero no se puede pedir)
// Usa update (no upsert) para no chocar con columnas NOT NULL.
export async function setRecipeOverride(id, value) {
  const { error } = await supabase.from('recipes').update({ sold_out_override: value }).eq('id', id);
  if (error) { console.error('setRecipeOverride:', error.message); return false; }
  return true;
}

export async function deleteRecipe(id) {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  return !error;
}

// Soft delete — marca como archivada sin borrar el historial
export async function archiveRecipe(id) {
  const { error } = await supabase.from('recipes').update({ is_archived: true }).eq('id', id);
  return !error;
}

export async function unarchiveRecipe(id) {
  const { error } = await supabase.from('recipes').update({ is_archived: false }).eq('id', id);
  return !error;
}

export async function fetchRecipeIngredients(recipeId) {
  const { data, error } = await supabase.from('recipe_ingredients').select('*').eq('recipe_id', recipeId);
  if (error) { console.error('fetchRecipeIngredients:', error.message); return []; }
  return data || [];
}

export async function fetchAllRecipeIngredients() {
  const { data, error } = await supabase.from('recipe_ingredients').select('*');
  if (error) { console.error('fetchAllRecipeIngredients:', error.message); return []; }
  return data || [];
}

export async function saveRecipeIngredients(recipeId, ingredients) {
  const { error: delErr } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
  if (delErr) { console.error('deleteRecipeIngredients:', delErr.message); return false; }
  if (!ingredients.length) return true;
  const rows = ingredients
    .filter(i => i.ingredient_id && (i.qty > 0 || i.quantity > 0))
    .map(i => ({ recipe_id: recipeId, ingredient_id: i.ingredient_id, qty: Number(i.qty || i.quantity) }));
  if (!rows.length) return true;
  const { error } = await supabase.from('recipe_ingredients').insert(rows);
  if (error) { console.error('saveRecipeIngredients:', error.message); return false; }
  return true;
}

export async function fetchComboItems(recipeId) {
  const { data, error } = await supabase
    .from('combo_items')
    .select('*, recipes!combo_items_sub_recipe_id_fkey(id, name, sale_price)')
    .eq('recipe_id', recipeId);
  if (error) { console.error('fetchComboItems:', error.message); return []; }
  return data || [];
}

// Todos los combo_items de todos los combos — para costeo/disponibilidad global.
// Espejo de fetchAllRecipeIngredients: el admin y el catalogo necesitan los
// items de todos los combos sin abrir cada receta.
export async function fetchAllComboItems() {
  const { data, error } = await supabase.from('combo_items').select('recipe_id, sub_recipe_id, qty');
  if (error) { console.error('fetchAllComboItems:', error.message); return []; }
  return data || [];
}

export async function saveComboItems(recipeId, items) {
  await supabase.from('combo_items').delete().eq('recipe_id', recipeId);
  if (!items.length) return true;
  const validItems = items.filter(i => i.sub_recipe_id && i.qty > 0);
  for (const item of validItems) {
    const v = validateInput(ComboItemSchema, item, 'saveComboItems');
    if (!v.ok) { console.error('saveComboItems validation:', v.errors); return false; }
  }
  const rows = validItems.map(i => ({ recipe_id: recipeId, sub_recipe_id: i.sub_recipe_id, qty: Number(i.qty) }));
  if (!rows.length) return true;
  const { error } = await supabase.from('combo_items').insert(rows);
  if (error) { console.error('saveComboItems:', error.message); return false; }
  return true;
}

// Deducción recursiva de stock para combos
export async function deductComboStock(recipeId, orderQty, ingMap, riMap) {
  const { data: comboItems } = await supabase
    .from('combo_items')
    .select('sub_recipe_id, qty')
    .eq('recipe_id', recipeId);
  if (!comboItems || !comboItems.length) return;
  for (const ci of comboItems) {
    const totalSubQty = ci.qty * orderQty;
    // Descontar ingredientes de la sub-receta
    const subRIs = riMap[ci.sub_recipe_id] || [];
    for (const ri of subRIs) {
      await updateIngredientStock(ri.ingredient_id, -(ri.quantity * totalSubQty));
    }
    // Recursión: si la sub-receta también es combo
    await deductComboStock(ci.sub_recipe_id, totalSubQty, ingMap, riMap);
  }
}
