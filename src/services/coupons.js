// src/services/coupons.js
import { supabase } from '../lib/supabase';
import { CouponCreateSchema, validateInput } from '../lib/schemas/index.js';

const PAGE_SIZE = 50;

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

/**
 * Fetch coupons with optional cursor pagination.
 * No args → backward-compatible flat array (first 100).
 */
export async function fetchCoupons({ before, limit = PAGE_SIZE } = {}) {
  if (!before && !limit) {
    // Legacy call
    const { data, error } = await supabase
      .from('coupons').select('*')
      .order('created_at', { ascending: false }).limit(100);
    if (error) { console.error('fetchCoupons:', error.message); return []; }
    return data || [];
  }

  const fetchLimit = before ? limit + 1 : limit;
  let query = supabase
    .from('coupons').select('*')
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) { console.error('fetchCoupons:', error.message); return before ? { data: [], nextCursor: null } : []; }

  const rows = data || [];

  if (before) {
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].created_at : null;
    return { data: page, nextCursor };
  }

  return rows;
}
