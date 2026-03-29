// src/lib/adminService.js
import { supabase } from './supabase';

// ─── AUTH ─────────────────────────────────────────────
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, msg: error.message };
  return { ok: true, user: data.user };
}
export async function logout() { await supabase.auth.signOut(); }
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── RECIPES ──────────────────────────────────────────
export async function fetchAllRecipes() {
  const { data, error } = await supabase.from('recipes').select('*').order('category');
  if (error) { console.error('fetchAllRecipes:', error.message); return []; }
  return data || [];
}
export async function upsertRecipe(recipe) {
  const { data, error } = await supabase.from('recipes').upsert(recipe).select().single();
  if (error) { console.error('upsertRecipe:', error.message); return null; }
  return data;
}
export async function deleteRecipe(id) {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  return !error;
}

// ─── ORDERS ───────────────────────────────────────────
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
  return !error;
}

// ─── SETTINGS ─────────────────────────────────────────
export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  if (error) { console.error('fetchSettings:', error.message); return null; }
  return data?.[0] || null;
}
export async function updateSettings(settings) {
  const { data, error } = await supabase.from('settings').upsert(settings).select().single();
  if (error) { console.error('updateSettings:', error.message); return null; }
  return data;
}

// ─── INGREDIENTS ──────────────────────────────────────
export async function fetchIngredients() {
  const { data, error } = await supabase.from('ingredients').select('*').order('name');
  if (error) { console.error('fetchIngredients:', error.message); return []; }
  return data || [];
}
export async function upsertIngredient(ingredient) {
  const { data, error } = await supabase.from('ingredients').upsert(ingredient).select().single();
  if (error) { console.error('upsertIngredient:', error.message); return null; }
  return data;
}
export async function deleteIngredient(id) {
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  return !error;
}

// ─── RECIPE INGREDIENTS ───────────────────────────────
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
    .filter(i => i.ingredient_id && i.quantity > 0)
    .map(i => ({ recipe_id: recipeId, ingredient_id: i.ingredient_id, quantity: Number(i.quantity) }));
  if (!rows.length) return true;
  const { error } = await supabase.from('recipe_ingredients').insert(rows);
  if (error) { console.error('saveRecipeIngredients:', error.message); return false; }
  return true;
}

// ─── PURCHASES (COMPRAS) ──────────────────────────────
export async function fetchPurchases() {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, purchase_items(*, ingredients(name, unit))')
    .order('date', { ascending: false });
  if (error) { console.error('fetchPurchases:', error.message); return []; }
  return data || [];
}
export async function createPurchase(purchase, items) {
  const { data, error } = await supabase.from('purchases').insert(purchase).select().single();
  if (error) { console.error('createPurchase:', error.message); return null; }
  if (items.length) {
    const rows = items.map(i => ({ ...i, purchase_id: data.id }));
    await supabase.from('purchase_items').insert(rows);
    // Update ingredient stock
    for (const item of items) {
      if (item.ingredient_id) {
        const { data: ing } = await supabase.from('ingredients').select('stock').eq('id', item.ingredient_id).single();
        if (ing) {
          await supabase.from('ingredients').update({ stock: (ing.stock || 0) + item.quantity, cost_per_unit: item.unit_price }).eq('id', item.ingredient_id);
        }
      }
    }
  }
  return data;
}

// ─── EXPENSES (GASTOS) ────────────────────────────────
export async function fetchExpenses() {
  const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
  if (error) { console.error('fetchExpenses:', error.message); return []; }
  return data || [];
}
export async function createExpense(expense) {
  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) { console.error('createExpense:', error.message); return null; }
  return data;
}
export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  return !error;
}

// ─── SALES (VENTAS) ──────────────────────────────────
export async function fetchSales() {
  const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
  if (error) { console.error('fetchSales:', error.message); return []; }
  return data || [];
}
export async function createSale(sale) {
  const { data, error } = await supabase.from('sales').insert(sale).select().single();
  if (error) { console.error('createSale:', error.message); return null; }
  return data;
}
export async function deleteSale(id) {
  const { error } = await supabase.from('sales').delete().eq('id', id);
  return !error;
}

// ─── STOCK UPDATE (for order operations) ─────────────
export async function updateIngredientStock(ingredientId, deltaQty) {
  const { data: ing } = await supabase.from('ingredients').select('stock').eq('id', ingredientId).single();
  if (ing) {
    const newStock = Math.max(0, (ing.stock || 0) + deltaQty);
    await supabase.from('ingredients').update({ stock: newStock }).eq('id', ingredientId);
  }
}

// ─── DASHBOARD STATS ──────────────────────────────────
export async function fetchDashboardStats() {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    // Fetch all non-cancelled orders for the month
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, status, total, date, order_items(*, recipes(name, sale_price))')
      .gte('date', monthStart)
      .neq('status', 'cancelled');
    if (error) { console.error('fetchDashboardStats orders:', error.message); return null; }

    // Fetch ingredients for cost calc
    const { data: ingredients } = await supabase.from('ingredients').select('*');
    const { data: recipeIngs } = await supabase.from('recipe_ingredients').select('*');

    // Fetch expenses for the month
    let monthExpenses = 0;
    const { data: expenses } = await supabase.from('expenses').select('amount, date').gte('date', monthStart);
    if (expenses) monthExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    const all = orders || [];
    const completedOrders = all.filter(o => o.status === 'completed');
    const newOrders = all.filter(o => o.status === 'new');

    // Revenue from completed orders
    const monthRevenue = completedOrders.reduce((s, o) => s + (o.total || 0), 0);

    // Calculate cost of goods sold
    let costOfGoods = 0;
    const ingMap = {};
    (ingredients || []).forEach(i => { ingMap[i.id] = i; });
    const riMap = {};
    (recipeIngs || []).forEach(ri => {
      if (!riMap[ri.recipe_id]) riMap[ri.recipe_id] = [];
      riMap[ri.recipe_id].push(ri);
    });

    completedOrders.forEach(o => {
      (o.order_items || []).forEach(item => {
        const recId = item.recipe_id;
        const qty = item.quantity || item.qty || 1;
        const ris = riMap[recId] || [];
        let recipeCost = 0;
        ris.forEach(ri => {
          const ing = ingMap[ri.ingredient_id];
          if (ing) recipeCost += Number(ri.quantity) * Number(ing.cost_per_unit);
        });
        costOfGoods += recipeCost * qty;
      });
    });

    const profit = monthRevenue - costOfGoods;
    const margin = monthRevenue > 0 ? (profit / monthRevenue * 100) : 0;

    // Top products from completed orders
    const productData = {};
    completedOrders.forEach(o => {
      (o.order_items || []).forEach(item => {
        const name = item.recipes?.name || 'Desconocido';
        const qty = item.quantity || item.qty || 1;
        const revenue = item.subtotal || (item.unit_price || 0) * qty;
        if (!productData[name]) productData[name] = { qty: 0, revenue: 0, recipeId: item.recipe_id };
        productData[name].qty += qty;
        productData[name].revenue += revenue;
      });
    });

    const topProducts = Object.entries(productData)
      .map(([name, d]) => {
        const ris = riMap[d.recipeId] || [];
        let unitCost = 0;
        ris.forEach(ri => {
          const ing = ingMap[ri.ingredient_id];
          if (ing) unitCost += Number(ri.quantity) * Number(ing.cost_per_unit);
        });
        const prodMargin = d.revenue > 0 ? ((d.revenue - unitCost * d.qty) / d.revenue * 100) : 0;
        return { name, qty: d.qty, revenue: d.revenue, margin: Math.round(prodMargin) };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Inventory value
    const inventoryValue = (ingredients || []).reduce((s, i) => s + (i.stock || 0) * (i.cost_per_unit || 0), 0);

    return {
      newOrders: newOrders.length,
      monthRevenue,
      profit,
      margin: Math.round(margin * 10) / 10,
      costOfGoods,
      monthExpenses,
      topProducts,
      inventoryValue,
      allOrders: all
    };
  } catch (err) {
    console.error('fetchDashboardStats:', err);
    return null;
  }
}
