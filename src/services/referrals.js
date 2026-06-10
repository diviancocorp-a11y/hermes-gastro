// src/services/referrals.js
// Referral program service.
import { supabase } from '../lib/supabase';
import business from '@business';

// Generate a unique referral code from a phone number
function generateReferralCode(phone) {
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
