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
  if (error) {
    console.error('upsertRecipe:', error.message);
    if (error.message?.includes('unique') || error.message?.includes('duplicate') || error.code === '23505') {
      return { __error: 'duplicate', message: 'Ya existe una receta activa con ese nombre' };
    }
    return null;
  }
  return data;
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
  // Only send relevant fields to avoid conflicts with auto-generated columns
  const clean = { name: ingredient.name, unit: ingredient.unit, cost: ingredient.cost, stock: ingredient.stock, min_stock: ingredient.min_stock, category: ingredient.category };
  if (ingredient.id) clean.id = ingredient.id;
  const { data, error } = await supabase.from('ingredients').upsert(clean).select().single();
  if (error) { console.error('upsertIngredient:', error.message); return { __error: error.message }; }
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
    .filter(i => i.ingredient_id && (i.qty > 0 || i.quantity > 0))
    .map(i => ({ recipe_id: recipeId, ingredient_id: i.ingredient_id, qty: Number(i.qty || i.quantity) }));
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
    // Update ingredient stock (atómico) + actualizar costo
    for (const item of items) {
      if (item.ingredient_id) {
        await updateIngredientStock(item.ingredient_id, item.quantity);
        if (item.unit_price > 0) {
          await supabase.from('ingredients').update({ cost: item.unit_price }).eq('id', item.ingredient_id);
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
          if (ing) recipeCost += Number(ri.quantity) * Number(ing.cost);
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
          if (ing) unitCost += Number(ri.quantity) * Number(ing.cost);
        });
        const prodMargin = d.revenue > 0 ? ((d.revenue - unitCost * d.qty) / d.revenue * 100) : 0;
        return { name, qty: d.qty, revenue: d.revenue, margin: Math.round(prodMargin) };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Inventory value
    const inventoryValue = (ingredients || []).reduce((s, i) => s + (i.stock || 0) * (i.cost || 0), 0);

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

// ─── STORAGE: IMAGE UPLOAD (con validación) ──────────
const ALLOWED_IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const MAX_IMG_SIZE = 5 * 1024 * 1024; // 5MB

function validateImageFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_IMG_EXTS.includes(ext)) return 'Extensión no permitida. Usá JPG, PNG o WebP.';
  if (!ALLOWED_IMG_TYPES.includes(file.type)) return 'Tipo de archivo no permitido.';
  if (file.size > MAX_IMG_SIZE) return `Archivo muy grande (${(file.size/1024/1024).toFixed(1)}MB). Máximo 5MB.`;
  return null;
}

export async function uploadCoverImage(file) {
  const err = validateImageFile(file);
  if (err) { console.error('uploadCoverImage:', err); return { __error: err }; }
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `cover-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('recipe-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('uploadCoverImage:', error.message); return null; }
  const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function uploadLogoImage(file) {
  const err = validateImageFile(file);
  if (err) { console.error('uploadLogoImage:', err); return { __error: err }; }
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `logo-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('recipe-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('uploadLogoImage:', error.message); return null; }
  const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function uploadCatImage(file, catName) {
  const err = validateImageFile(file);
  if (err) { console.error('uploadCatImage:', err); return { __error: err }; }
  const ext = file.name.split('.').pop().toLowerCase();
  const slug = catName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const path = `cat-${slug}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('recipe-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('uploadCatImage:', error.message); return null; }
  const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function uploadRecipeImage(file) {
  const err = validateImageFile(file);
  if (err) { console.error('uploadRecipeImage:', err); return { __error: err }; }
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage
    .from('recipe-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('uploadRecipeImage:', error.message); return null; }
  const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ─── WASTE LOG (MERMAS) ───────────────────────────────
export async function fetchWasteLog() {
  const { data, error } = await supabase
    .from('waste_log')
    .select('*, ingredients(name, unit)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.error('fetchWasteLog:', error.message); return []; }
  return data || [];
}
export async function registerWaste(ingredientId, qty, reason, note = '') {
  // 1. Registrar la merma
  const { error: logErr } = await supabase.from('waste_log').insert({
    ingredient_id: ingredientId, qty, reason, note,
    date: new Date().toISOString().split('T')[0]
  });
  if (logErr) { console.error('registerWaste log:', logErr.message); return false; }
  // 2. Descontar del stock (atómico)
  await updateIngredientStock(ingredientId, -qty);
  return true;
}

// ─── COMBO ITEMS ──────────────────────────────────────
export async function fetchComboItems(recipeId) {
  const { data, error } = await supabase
    .from('combo_items')
    .select('*, recipes!combo_items_sub_recipe_id_fkey(id, name, sale_price)')
    .eq('recipe_id', recipeId);
  if (error) { console.error('fetchComboItems:', error.message); return []; }
  return data || [];
}
export async function saveComboItems(recipeId, items) {
  await supabase.from('combo_items').delete().eq('recipe_id', recipeId);
  if (!items.length) return true;
  const rows = items.filter(i => i.sub_recipe_id && i.qty > 0)
    .map(i => ({ recipe_id: recipeId, sub_recipe_id: i.sub_recipe_id, qty: Number(i.qty) }));
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

// ─── COUPONS ──────────────────────────────────────────
function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'NONA-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
export async function createCouponForOrder(orderId, email, discountPct = 10) {
  if (!email) return null;
  const code = generateCouponCode();
  const expires = new Date();
  expires.setDate(expires.getDate() + 30); // válido 30 días
  const { data, error } = await supabase.from('coupons').insert({
    code, discount_pct: discountPct, email, order_id: orderId,
    expires_at: expires.toISOString()
  }).select().single();
  if (error) { console.error('createCouponForOrder:', error.message); return null; }
  return data;
}
export async function validateCoupon(code, email) {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('used', false)
    .single();
  if (error || !data) return null;
  if (data.email && data.email.toLowerCase() !== email.toLowerCase()) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
}
export async function redeemCoupon(couponId) {
  const { error } = await supabase.from('coupons').update({
    used: true, used_at: new Date().toISOString()
  }).eq('id', couponId);
  return !error;
}
export async function fetchCoupons() {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { console.error('fetchCoupons:', error.message); return []; }
  return data || [];
}

// ─── WHATSAPP NOTIFICATIONS ───────────────────────────
export async function notifyWhatsApp(phone, customerName, status, orderId) {
  if (!phone) return false;
  // En desarrollo (localhost) usar URL absoluta de producción; en producción usar relativa
  const apiBase = import.meta.env.DEV ? 'https://la-nona-pato.vercel.app' : '';
  try {
    const res = await fetch(`${apiBase}/api/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-nona-secret': import.meta.env.VITE_NONA_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({ phone, customerName, status, orderId }),
    });
    if (!res.ok) { const d = await res.json(); console.error('WhatsApp error:', d); return false; }
    return true;
  } catch (err) {
    console.error('notifyWhatsApp:', err);
    return false;
  }
}

// ─── CRM / CUSTOMERS ─────────────────────────────────
export async function fetchCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('last_order_at', { ascending: false });
  if (error) { console.error('fetchCustomers:', error.message); return []; }
  return data || [];
}

export async function fetchCustomerStats() {
  // Build CRM from orders data (more reliable than customers table)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('customer, phone, email, total, status, created_at')
    .neq('status', 'cancelled');
  if (error || !orders) return [];
  const map = {};
  orders.forEach(o => {
    const key = o.phone || o.email || o.customer;
    if (!key) return;
    if (!map[key]) map[key] = { name: o.customer, phone: o.phone || '', email: o.email || '', orders: 0, total: 0, last_order: '' };
    map[key].orders++;
    map[key].total += (o.total || 0);
    if (!map[key].name && o.customer) map[key].name = o.customer;
    if (!map[key].phone && o.phone) map[key].phone = o.phone;
    if (!map[key].email && o.email) map[key].email = o.email;
    if (o.created_at > map[key].last_order) map[key].last_order = o.created_at;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}
   