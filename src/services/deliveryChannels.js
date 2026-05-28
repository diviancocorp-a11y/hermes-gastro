// src/services/deliveryChannels.js
// CRUD de canales de venta (Rappi, PYa, UberEats, WA, etc.)
// La tabla tiene RLS: authenticated puede ALL, anon puede SELECT active.
//
// Defaults seedeados por la migration 20260527_usar_dark_kitchen.sql

import { supabase } from "../lib/supabase";

/**
 * Lista todos los canales activos. Ordenados por commission_pct ASC
 * (los gratis primero, los más caros al final).
 */
export async function fetchDeliveryChannels({ activeOnly = true } = {}) {
  let q = supabase
    .from("delivery_channels")
    .select("id, slug, label, commission_pct, is_active")
    .order("commission_pct", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) {
    console.error("fetchDeliveryChannels:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Crea o actualiza un canal. Solo authenticated.
 */
export async function upsertDeliveryChannel(channel) {
  const { data, error } = await supabase
    .from("delivery_channels")
    .upsert({
      ...channel,
      updated_at: new Date().toISOString(),
    }, { onConflict: "slug" })
    .select()
    .single();
  if (error) { console.error("upsertDeliveryChannel:", error.message); return null; }
  return data;
}

export async function deleteDeliveryChannel(id) {
  const { error } = await supabase
    .from("delivery_channels")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error("deleteDeliveryChannel:", error.message); return false; }
  return true;
}

/**
 * Calcula la comisión absoluta para un total dado.
 */
export function calcCommission(total, commission_pct) {
  const pct = Number(commission_pct) || 0;
  const amt = (Number(total) || 0) * (pct / 100);
  return Math.round(amt * 100) / 100;
}
