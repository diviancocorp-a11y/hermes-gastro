// src/services/platformTasas.js
// Tasas de cambio del negocio (tabla `exchange_rates`, migracion 0126).
//
// Solo se agrega: no hay update ni delete. Corregir una tasa es cargar otra
// manual el mismo dia, y esa le gana a la automatica (misma regla que la RPC
// get_exchange_rate y que el sync). RLS deja insertar solo `source = 'manual'`
// con `created_by = auth.uid()`; el filtro por tenant_id decide QUE miramos.
//
// Esta en PLATFORM_PATHS (scripts/check-supabase-columns.mjs).

import { supabase } from '../lib/supabase';

const COLS = 'id, tenant_id, base_currency, quote_currency, rate, effective_date, source, created_by, created_at';

export const UMBRAL_VARIACION_PCT = 20;

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' para mostrar. */
export function fechaLegible(ymd) {
  const [y, m, d] = String(ymd || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

/** 'YYYY-MM-DD' de hoy en la zona del negocio. */
export function hoyEnZona(zona = 'America/Caracas', ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
}

/**
 * La vigente: el dia mas nuevo; dentro del dia la manual le gana a la
 * automatica y despues la mas reciente. Igual que get_exchange_rate.
 */
export function elegirVigente(filas) {
  const lista = (filas || []).filter(f => f && Number(f.rate) > 0);
  if (!lista.length) return null;
  return [...lista].sort((a, b) => {
    if (a.effective_date !== b.effective_date) return a.effective_date < b.effective_date ? 1 : -1;
    const ma = a.source === 'manual' ? 1 : 0;
    const mb = b.source === 'manual' ? 1 : 0;
    if (ma !== mb) return mb - ma;
    return String(a.created_at || '') < String(b.created_at || '') ? 1 : -1;
  })[0];
}

/** Variacion en % de `nueva` contra `vigente`; null si no hay con que comparar. */
export function variacionPct(nueva, vigente) {
  const n = Number(nueva);
  const v = Number(vigente);
  if (!(n > 0) || !(v > 0)) return null;
  return ((n - v) / v) * 100;
}

/** Las ultimas `limite` tasas del par, de la mas nueva a la mas vieja. */
export async function fetchTasas(tenantId, base, quote, limite = 8) {
  if (!tenantId || !base || !quote) return [];
  const { data, error } = await supabase
    .from('exchange_rates')
    .select(COLS)
    .eq('tenant_id', tenantId)
    .eq('base_currency', base)
    .eq('quote_currency', quote)
    .order('effective_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) { console.error('fetchTasas:', error.message); return []; }
  return data || [];
}

/** La tasa vigente del par, o null. Mira varias filas porque la manual del dia le gana. */
export async function fetchTasaVigente(tenantId, base, quote) {
  return elegirVigente(await fetchTasas(tenantId, base, quote, 10));
}

/**
 * Carga una tasa manual con fecha de hoy en la zona del negocio.
 * @returns {Promise<{ok: boolean, tasa?: object, error?: string}>}
 */
export async function cargarTasaManual(tenantId, { base, quote, rate, zona, ahora = new Date() }) {
  const n = Number(rate);
  if (!tenantId) return { ok: false, error: 'Falta el negocio' };
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'La tasa tiene que ser un número mayor que cero' };
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion?.user?.id;
  if (!uid) return { ok: false, error: 'No hay sesión abierta' };
  const { data, error } = await supabase
    .from('exchange_rates')
    .insert({
      tenant_id: tenantId,
      base_currency: base,
      quote_currency: quote,
      rate: n,
      effective_date: hoyEnZona(zona, ahora),
      source: 'manual',
      created_by: uid,
    })
    .select(COLS)
    .single();
  if (error) { console.error('cargarTasaManual:', error.message); return { ok: false, error: 'No se pudo guardar la tasa' }; }
  return { ok: true, tasa: data };
}
