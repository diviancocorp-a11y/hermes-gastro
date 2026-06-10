// src/services/phoneAuth.js
//
// Phone-only login (sin Supabase Auth). El usuario ingresa SOLO su telefono
// y entra. La "sesion" vive en localStorage del dispositivo via guestUser
// extendido — NO hay sesion real de Supabase Auth.

import { supabase } from '../lib/supabase';
import { setGuestUser } from '../lib/guestUser.js';

export function cleanPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export async function lookupCustomerByPhone(phone) {
  const cleaned = cleanPhone(phone);
  if (cleaned.length < 10) return null;
  const { data, error } = await supabase
    .rpc('lookup_customer_by_phone', { phone_search: cleaned });
  if (error) {
    console.error('lookupCustomerByPhone:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.display_name) return null;
  return {
    displayName: row.display_name,
    fullName: row.full_name || row.display_name,
    nickname: row.nickname || "",
    email: row.email || "",
    hasEmail: !!row.has_email,
    orderCount: row.order_count || 0,
    lastOrderAt: row.last_order_at || null,
  };
}

export async function upsertCustomer({ phone, email, name, birth_date = null, nickname = null }) {
  const { data, error } = await supabase.rpc('upsert_customer', {
    p_phone: phone || null,
    p_email: email || null,
    p_name: name || null,
    p_birth_date: birth_date || null,
    p_nickname: nickname || null,
  });
  if (error) {
    console.error('upsertCustomer:', error.message);
    return null;
  }
  return data;
}

export async function phoneLogin({ phone, name, email = '', birth_date = null, nickname = '' }) {
  const customerId = await upsertCustomer({ phone, email, name, birth_date, nickname });
  if (!customerId) return { ok: false, error: 'no_customer' };

  const guest = setGuestUser({
    id: customerId,
    name: name || '',
    nickname: nickname || '',
    phone: cleanPhone(phone),
    email: (email || '').toLowerCase().trim(),
  });

  return { ok: true, guest };
}

// ─── Bloqueo de telefonos rechazados en este dispositivo ──────────
const BLOCK_KEY = "hermes_phone_blocks_v1";
const BLOCK_DURATION_MS = 10 * 60 * 1000;

function readBlocks() {
  try {
    const raw = localStorage.getItem(BLOCK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((b) => b && b.phone && b.expiresAt > now);
  } catch {
    return [];
  }
}

function writeBlocks(blocks) {
  try { localStorage.setItem(BLOCK_KEY, JSON.stringify(blocks)); } catch { /* ignore */ }
}

export function blockPhone(phone) {
  const cleaned = cleanPhone(phone);
  if (cleaned.length < 10) return;
  const blocks = readBlocks().filter((b) => b.phone !== cleaned);
  blocks.push({ phone: cleaned, expiresAt: Date.now() + BLOCK_DURATION_MS });
  writeBlocks(blocks);
}

export function isPhoneBlocked(phone) {
  const cleaned = cleanPhone(phone);
  if (cleaned.length < 10) return { blocked: false, minutesLeft: 0 };
  const blocks = readBlocks();
  const hit = blocks.find((b) => b.phone === cleaned);
  if (!hit) return { blocked: false, minutesLeft: 0 };
  const msLeft = hit.expiresAt - Date.now();
  return { blocked: true, minutesLeft: Math.max(1, Math.ceil(msLeft / 60000)) };
}
