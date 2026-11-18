// src/services/coupons.js
import { supabase } from '../lib/supabase';
import business from '@business';
import { resolveTenantId } from '../lib/activeTenant.js';
import { CouponCreateSchema, validateInput } from '../lib/schemas/index.js';

const PAGE_SIZE = 50;

// Prefix dinámico del business — primeras 4 letras del slug en mayúsculas.
// Fallback: 'CRM'. Útil para multi-tenant (LNP / COCHI / MM / ...).
function couponPrefix() {
  const slug = (business?.slug || business?.name || 'crm')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return slug || 'CRM';
}

function generateCouponCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const p = prefix || couponPrefix();
  return `${p}-` + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
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

// Crea un cupón targeted a un cliente específico (no atado a un pedido).
// kind: 'percent' (usa discountPct), 'twoxone' (label describe), 'other' (label libre).
// expiresDays default 30. codeOverride opcional.
export async function createCustomerCoupon({ email, kind = 'percent', discountPct, label = null, expiresDays = 30, codeOverride = null }) {
  if (!email) return null;
  // Validaciones por tipo
  if (kind === 'percent' && (!discountPct || discountPct < 1 || discountPct > 100)) return null;
  if ((kind === 'twoxone' || kind === 'other') && !label?.trim()) return null;

  const code = (codeOverride || generateCouponCode()).toUpperCase();
  const expires = new Date();
  expires.setDate(expires.getDate() + (Number(expiresDays) || 30));
  const { data, error } = await supabase.from('coupons').insert({
    code,
    kind,
    label: label?.trim() || null,
    discount_pct: kind === 'percent' ? Math.round(discountPct) : 0,
    email,
    expires_at: expires.toISOString()
  }).select().single();
  if (error) { console.error('createCustomerCoupon:', error.message); return null; }
  return data;
}

// Devuelve una descripción humana del cupón (para mostrar en el dropdown).
export function describeCoupon(coupon) {
  if (!coupon) return '';
  if (coupon.kind === 'twoxone') return coupon.label || '2x1';
  if (coupon.kind === 'other')   return coupon.label || 'Promo';
  return `${coupon.discount_pct}% OFF`; // default: percent
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

// ── Panel: cupones ampliados (0144) ─────────────────────────────────
// Tipo pct | fixed (monto en la moneda principal), minimo de compra, usos
// totales y por telefono, vigencia desde/hasta. Lo valida CouponCreateSchema;
// el tenant sale de resolveTenantId (la RLS igual lo exige).

const COLUMNAS_CUPON = 'id, code, discount_type, discount_pct, discount_amount, min_subtotal, max_uses, max_uses_per_phone, uses_count, starts_at, expires_at, email, used, created_at';

export async function listarCupones() {
  const tenantId = await resolveTenantId();
  if (!tenantId) return [];
  const { data, error } = await supabase.from('coupons').select(COLUMNAS_CUPON)
    .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200);
  if (error) { console.error('listarCupones:', error.message); throw error; }
  return data || [];
}

/** Crea (sin id) o edita (con id). Devuelve { ok, cupon } o { ok: false, error }. */
export async function guardarCupon(input) {
  const v = validateInput(CouponCreateSchema, input, 'guardarCupon');
  if (!v.ok) return { ok: false, error: String(v.errors?.[0] || '').split(': ').slice(1).join(': ') || 'Revisá los datos del cupón' };
  const fila = { ...v.data, code: v.data.code.toUpperCase().trim() };
  delete fila.order_id;
  if (fila.discount_type === 'fixed') fila.discount_pct = 0;
  else fila.discount_amount = 0;
  const tenantId = await resolveTenantId();
  if (!tenantId) return { ok: false, error: 'No encontramos el negocio activo' };
  const q = input.id
    ? supabase.from('coupons').update(fila).eq('id', input.id).eq('tenant_id', tenantId)
    : supabase.from('coupons').insert({ ...fila, tenant_id: tenantId });
  const { data, error } = await q.select(COLUMNAS_CUPON).single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya hay un cupón con ese código' };
    console.error('guardarCupon:', error.message);
    return { ok: false, error: 'No se pudo guardar el cupón' };
  }
  return { ok: true, cupon: data };
}

/** Moneda principal del negocio activo (tenants.currency). ARS si no se puede leer. */
export async function monedaDelNegocio() {
  const tenantId = await resolveTenantId();
  if (!tenantId) return 'ARS';
  const { data } = await supabase.from('tenants').select('currency').eq('id', tenantId).maybeSingle();
  return data?.currency || 'ARS';
}
