// src/services/orders.js
import { supabase } from '../lib/supabase';

const ACTIVE_STATUSES = ['new', 'prep', 'active'];
const PAGE_SIZE = 50;

/**
 * Fetch active orders (new, prep, active) — always loaded in full.
 */
export async function fetchActiveOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, recipes(name))')
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchActiveOrders:', error.message); return []; }
  return data || [];
}

/**
 * Fetch order history with cursor pagination.
 * @param {Object} opts
 * @param {string} [opts.before] - ISO timestamp cursor (fetch orders older than this)
 * @param {number} [opts.limit]  - Page size (default 50)
 * @returns {{ data: Array, nextCursor: string|null }}
 */
export async function fetchOrderHistory({ before, limit = PAGE_SIZE } = {}) {
  let query = supabase
    .from('orders')
    .select('*, order_items(*, recipes(name))')
    .not('status', 'in', `(${ACTIVE_STATUSES.join(',')})`)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // fetch one extra to detect if there's a next page

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) { console.error('fetchOrderHistory:', error.message); return { data: [], nextCursor: null }; }

  const rows = data || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].created_at : null;

  return { data: page, nextCursor };
}

/**
 * Backward-compatible: fetches active + first page of history.
 */
export async function fetchOrders() {
  const [active, history] = await Promise.all([
    fetchActiveOrders(),
    fetchOrderHistory(),
  ]);
  return [...active, ...history.data];
}

export async function updateOrderStatus(id, status) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  return !error;
}

export async function verifyReceipt(id) {
  const { error } = await supabase.from('orders').update({ receipt_verified: true }).eq('id', id);
  return !error;
}

export function getReceiptUrl(receiptPath) {
  if (!receiptPath) return null;
  const { data } = supabase.storage.from('receipts').getPublicUrl(receiptPath);
  return data?.publicUrl || null;
}
