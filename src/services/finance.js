// src/services/finance.js
import { supabase } from '../lib/supabase';
import {
  SaleInputSchema, ExpenseInputSchema, PurchaseInputSchema, PurchaseItemSchema,
  validateInput,
} from '../lib/schemas/index.js';
import { updateIngredientStock } from './inventory.js';

const PAGE_SIZE = 50;

// ─── Pagination helper ──────────────────────────────────
function paginatedQuery(table, { before, limit = PAGE_SIZE, select = '*', orderCol = 'date' } = {}) {
  let query = supabase
    .from(table)
    .select(select)
    .order(orderCol, { ascending: false })
    .limit(limit + 1);

  if (before) query = query.lt(orderCol, before);
  return query;
}

async function paginate(table, opts = {}) {
  const limit = opts.limit || PAGE_SIZE;
  const { data, error } = await paginatedQuery(table, opts);
  if (error) { console.error(`fetch ${table}:`, error.message); return { data: [], nextCursor: null }; }
  const rows = data || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const orderCol = opts.orderCol || 'date';
  const nextCursor = hasMore ? page[page.length - 1][orderCol] : null;
  return { data: page, nextCursor };
}

// ─── SALES (VENTAS) ──────────────────────────────────
export async function fetchSales({ before, limit } = {}) {
  if (!before && !limit) {
    // Backward-compatible: no pagination args → return flat array
    const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
    if (error) { console.error('fetchSales:', error.message); return []; }
    return data || [];
  }
  return paginate('sales', { before, limit });
}

export async function createSale(sale) {
  const validation = validateInput(SaleInputSchema, sale, 'createSale');
  if (!validation.ok) { console.error('createSale validation:', validation.errors); return null; }
  const { data, error } = await supabase.from('sales').insert(validation.data).select().single();
  if (error) { console.error('createSale:', error.message); return null; }
  return data;
}

export async function deleteSale(id) {
  const { error } = await supabase.from('sales').delete().eq('id', id);
  return !error;
}

// ─── EXPENSES (GASTOS) ────────────────────────────────
export async function fetchExpenses({ before, limit } = {}) {
  if (!before && !limit) {
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (error) { console.error('fetchExpenses:', error.message); return []; }
    return data || [];
  }
  return paginate('expenses', { before, limit });
}

export async function createExpense(expense) {
  const validation = validateInput(ExpenseInputSchema, expense, 'createExpense');
  if (!validation.ok) { console.error('createExpense validation:', validation.errors); return null; }
  const { data, error } = await supabase.from('expenses').insert(validation.data).select().single();
  if (error) { console.error('createExpense:', error.message); return null; }
  return data;
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  return !error;
}

// ─── PURCHASES (COMPRAS) ──────────────────────────────
export async function fetchPurchases({ before, limit } = {}) {
  if (!before && !limit) {
    const { data, error } = await supabase
      .from('purchases')
      .select('*, purchase_items(*, ingredients(name, unit))')
      .order('date', { ascending: false });
    if (error) { console.error('fetchPurchases:', error.message); return []; }
    return data || [];
  }
  return paginate('purchases', { before, limit, select: '*, purchase_items(*, ingredients(name, unit))' });
}

export async function createPurchase(purchase, items) {
  const pValidation = validateInput(PurchaseInputSchema, purchase, 'createPurchase');
  if (!pValidation.ok) { console.error('createPurchase validation:', pValidation.errors); return null; }
  // Validar cada item individualmente
  for (const item of items) {
    const iValid = validateInput(PurchaseItemSchema, item, 'createPurchase.item');
    if (!iValid.ok) { console.error('createPurchase item validation:', iValid.errors); return null; }
  }
  const { data, error } = await supabase.from('purchases').insert(pValidation.data).select().single();
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


/**
 * Anula un gasto creando una fila de reversion (reverse entry) en vez de borrarlo.
 * El amount de la reversion es el negativo del original. El original se marca
 * con voided_at/voided_by. Audit trail completo.
 */
export async function voidExpense({ id, reason, user }) {
  if (!id || !user?.email) return { ok: false, errors: ['missing id or user'] };

  const { data: orig, error: rErr } = await supabase
    .from('expenses').select('*').eq('id', id).single();
  if (rErr || !orig) return { ok: false, errors: ['original_not_found'] };
  if (orig.voided_at) return { ok: false, errors: ['already_voided'] };
  if (orig.voids_expense_id) return { ok: false, errors: ['is_a_reversal'] };

  const today = new Date();
  const ym = today.toISOString().slice(0, 7);
  if (!String(orig.date || '').startsWith(ym)) {
    return { ok: false, errors: ['outside_current_month'] };
  }

  const nowIso = new Date().toISOString();
  const todayDate = today.toISOString().split('T')[0];
  const cleanReason = String(reason || '').trim().slice(0, 500) || null;

  const reversalRow = {
    date: todayDate,
    description: `Anulacion de: ${orig.description || '(sin descripcion)'}`,
    amount: -Math.abs(Number(orig.amount) || 0),
    category: orig.category,
    supplier: orig.supplier || null,
    expense_type: orig.expense_type || 'variable',
    payment_method: orig.payment_method || null,
    voids_expense_id: orig.id,
    voided_by: user.email,
    voided_reason: cleanReason,
    created_by: user.id || null,
  };
  const { data: reversal, error: iErr } = await supabase
    .from('expenses').insert(reversalRow).select().single();
  if (iErr) {
    console.error('voidExpense insert:', iErr.message);
    return { ok: false, errors: [iErr.message] };
  }

  const { data: updatedOrig, error: uErr } = await supabase
    .from('expenses')
    .update({ voided_at: nowIso, voided_by: user.email, voided_reason: cleanReason })
    .eq('id', orig.id)
    .select().single();
  if (uErr) {
    await supabase.from('expenses').delete().eq('id', reversal.id);
    console.error('voidExpense update:', uErr.message);
    return { ok: false, errors: [uErr.message] };
  }

  return { ok: true, original: updatedOrig, reversal };
}
