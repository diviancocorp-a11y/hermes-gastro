// src/lib/adminService.js
// Funciones para el panel de administración (requieren sesión auth)

import { supabase } from './supabase';

// ─── AUTH ─────────────────────────────────────────────
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, msg: error.message };
  return { ok: true, user: data.user };
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── PRODUCTOS (RECIPES) ─────────────────────────────
export async function fetchAllRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('category', { ascending: true });
  if (error) { console.error('fetchAllRecipes:', error.message); return []; }
  return data || [];
}

export async function upsertRecipe(recipe) {
  const { data, error } = await supabase
    .from('recipes')
    .upsert(recipe)
    .select()
    .single();
  if (error) { console.error('upsertRecipe:', error.message); return null; }
  return data;
}

export async function deleteRecipe(id) {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) { console.error('deleteRecipe:', error.message); return false; }
  return true;
}

// ─── PEDIDOS (ORDERS) ─────────────────────────────────
export async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, recipes(name))')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchOrders:', error.message); return []; }
  return data || [];
}

export async function updateOrderStatus(id, status) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) { console.error('updateOrderStatus:', error.message); return false; }
  return true;
}

// ─── SETTINGS ─────────────────────────────────────────
export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  if (error) { console.error('fetchSettings:', error.message); return null; }
  return data?.[0] || null;
}

export async function updateSettings(settings) {
  const { data, error } = await supabase
    .from('settings')
    .upsert(settings)
    .select()
    .single();
  if (error) { console.error('updateSettings:', error.message); return null; }
  return data;
}

// ─── INGREDIENTES (STOCK) ──────────────────────────────
export async function fetchIngredients() {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .order('name', { ascending: true });
  if (error) { console.error('fetchIngredients:', error.message); return []; }
  return data || [];
}

export async function upsertIngredient(ingredient) {
  const { data, error } = await supabase
    .from('ingredients')
    .upsert(ingredient)
    .select()
    .single();
  if (error) { console.error('upsertIngredient:', error.message); return null; }
  return data;
}

export async function deleteIngredient(id) {
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  if (error) { console.error('deleteIngredient:', error.message); return false; }
  return true;
}

// ─── COMPOSICIÓN DE RECETAS ───────────────────────────
export async function fetchRecipeIngredients(recipeId) {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_id', recipeId);
  if (error) { console.error('fetchRecipeIngredients:', error.message); return []; }
  return data || [];
}

export async function saveRecipeIngredients(recipeId, ingredients) {
  // Borra los anteriores y vuelve a insertar
  const { error: delErr } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId);
  if (delErr) { console.error('deleteRecipeIngredients:', delErr.message); return false; }

  if (!ingredients.length) return true;

  const rows = ingredients
    .filter(i => i.ingredient_id && i.quantity > 0)
    .map(i => ({
      recipe_id: recipeId,
      ingredient_id: i.ingredient_id,
      quantity: Number(i.quantity)
    }));

  if (!rows.length) return true;

  const { error } = await supabase.from('recipe_ingredients').insert(rows);
  if (error) { console.error('saveRecipeIngredients:', error.message); return false; }
  return true;
}

// ─── ESTADÍSTICAS DASHBOARD ──────────────────────────
export async function fetchDashboardStats() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, status, total, date, order_items(quantity, recipes(name))')
      .neq('status', 'cancelled');

    if (error) { console.error('fetchDashboardStats:', error.message); return null; }

    const all = orders || [];
    const todayOrders = all.filter(o => o.date === today);
    const monthOrders = all.filter(o => o.date >= monthStart);

    // Pedidos por estado (incluye todos los estados)
    const byStatus = {};
    all.forEach(o => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });

    // Top productos
    const productCounts = {};
    all.forEach(o => {
      (o.order_items || []).forEach(item => {
        const name = item.recipes?.name || 'Desconocido';
        productCounts[name] = (productCounts[name] || 0) + (item.quantity || 1);
      });
    });
    const topProducts = Object.entries(productCounts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      todayOrders: todayOrders.length,
      todayRevenue: todayOrders.reduce((s, o) => s + (o.total || 0), 0),
      monthOrders: monthOrders.length,
      monthRevenue: monthOrders.reduce((s, o) => s + (o.total || 0), 0),
      byStatus,
      topProducts
    };
  } catch (err) {
    console.error('fetchDashboardStats:', err);
    return null;
  }
}
