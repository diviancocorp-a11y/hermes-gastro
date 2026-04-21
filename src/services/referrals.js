// src/services/referrals.js
// Referral program service.
import { supabase } from '../lib/supabase';
import business from '../config/business';

// Generate a unique referral code from a phone number
export function generateReferralCode(phone) {
  const clean = (phone || '').replace(/\D/g, '').slice(-6);
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `REF${clean}${random}`;
}

// Create or get a referral code for a customer
export async function getOrCreateReferralCode(phone, name = '') {
  if (!phone) throw new Error('Phone required');

  // Check if they already have a code
  const { data: existing } = await supabase
    .from('referrals')
    .select('referral_code')
    .eq('referrer_phone', phone)
    .is('referee_phone', null)
    .limit(1);

  if (existing?.length > 0) return existing[0].referral_code;

  // Create new referral entry
  const code = generateReferralCode(phone);
  const { error } = await supabase.from('referrals').insert({
    referrer_phone: phone,
    referrer_name: name,
    referral_code: code,
  });

  if (error) throw error;
  return code;
}

// Validate a referral code (returns referral info or null)
export async function validateReferralCode(code) {
  if (!code) return null;
  const { data } = await supabase
    .from('referrals')
    .select('*')
    .eq('referral_code', code.toUpperCase().trim())
    .is('referee_phone', null) // not yet used
    .eq('status', 'pending')
    .limit(1);

  return data?.[0] || null;
}

// Apply referral: mark as completed when referee places first order
export async function completeReferral(code, refereePhone, refereeOrderId) {
  const { error } = await supabase
    .from('referrals')
    .update({
      referee_phone: refereePhone,
      referee_order_id: refereeOrderId,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('referral_code', code.toUpperCase().trim())
    .is('referee_phone', null);

  if (error) throw error;
}

// Get referral stats for a customer
export async function getReferralStats(phone) {
  if (!phone) return { total: 0, completed: 0, rewarded: 0, codes: [] };

  const { data } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_phone', phone)
    .order('created_at', { ascending: false });

  const referrals = data || [];
  return {
    total: referrals.length,
    completed: referrals.filter(r => r.status === 'completed' || r.status === 'rewarded').length,
    rewarded: referrals.filter(r => r.status === 'rewarded').length,
    codes: referrals,
  };
}

// Admin: list all referrals
export async function listAllReferrals({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Admin: mark referral as rewarded (discount given)
export async function markReferralRewarded(id) {
  const { error } = await supabase
    .from('referrals')
    .update({ status: 'rewarded', reward_claimed: true })
    .eq('id', id);

  if (error) throw error;
}

// Build share URL
export function buildShareUrl(code, baseUrl) {
  const base = baseUrl || window.location.origin;
  return `${base}/?ref=${code}`;
}

// Build WhatsApp share message
export function buildWhatsAppShareUrl(code, bizName = business.name) {
  const url = buildShareUrl(code);
  const text = `¡Pedí en ${bizName} con mi código ${code} y recibí un descuento en tu primer pedido! 🎉\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
