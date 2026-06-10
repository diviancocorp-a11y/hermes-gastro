// src/services/featureFlags.js
// Feature flag system backed by Supabase.
// Flags are loaded once at app startup and cached in memory.
import { supabase } from '../lib/supabase';

/** @type {Map<string, boolean>} */
let flagCache = new Map();
let loaded = false;
let loadPromise = null;

// Default values when DB is unavailable (all on for backwards compat)
const DEFAULTS = {
  RECIPES_WITH_INGREDIENTS: true,
  DELIVERY_ENABLED: true,
  SCHEDULING_ENABLED: true,
  GIFT_MODE: true,
  COUPONS: true,
  WHATSAPP: true,
  LOYALTY: false,
  REFERRAL: true,
  E_INVOICE: false,
  PUSH_NOTIFICATIONS: true,
  DAILY_DEALS: true,
};

/**
 * Load all feature flags from DB. Called once, results are cached.
 */
export async function loadFlags() {
  if (loaded) return flagCache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('key, enabled');

      if (error || !data?.length) {
        // Use defaults
        Object.entries(DEFAULTS).forEach(([k, v]) => flagCache.set(k, v));
      } else {
        data.forEach(f => flagCache.set(f.key, f.enabled));
        // Fill in any missing defaults
        Object.entries(DEFAULTS).forEach(([k, v]) => {
          if (!flagCache.has(k)) flagCache.set(k, v);
        });
      }
    } catch {
      Object.entries(DEFAULTS).forEach(([k, v]) => flagCache.set(k, v));
    }
    loaded = true;
    loadPromise = null;
    return flagCache;
  })();

  return loadPromise;
}

/**
 * Check if a feature flag is enabled.
 * If flags haven't been loaded yet, returns the default value synchronously.
 */
export function isEnabled(key) {
  if (flagCache.has(key)) return flagCache.get(key);
  return DEFAULTS[key] ?? false;
}

/**
 * Get all flags as a plain object.
 */
export function getAllFlags() {
  const result = { ...DEFAULTS };
  flagCache.forEach((v, k) => { result[k] = v; });
  return result;
}

/**
 * Force-refresh flags from DB.
 */
export async function refreshFlags() {
  loaded = false;
  flagCache = new Map();
  return loadFlags();
}
