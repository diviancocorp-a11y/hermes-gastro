// src/hooks/useFeature.js
// React hook for checking feature flags.
import { useState, useEffect } from 'react';
import { loadFlags, isEnabled } from '../services/featureFlags';

/**
 * Hook that returns whether a feature flag is enabled.
 * Loads flags from DB on first call, then uses cached values.
 *
 * @param {string} key — Feature flag key (e.g., 'GIFT_MODE')
 * @returns {boolean} — Whether the feature is enabled
 *
 * @example
 * const giftEnabled = useFeature('GIFT_MODE');
 * if (giftEnabled) { ... }
 */
export default function useFeature(key) {
  const [enabled, setEnabled] = useState(() => isEnabled(key));

  useEffect(() => {
    let cancelled = false;
    loadFlags().then(() => {
      if (!cancelled) setEnabled(isEnabled(key));
    });
    return () => { cancelled = true; };
  }, [key]);

  return enabled;
}

/**
 * Hook that loads all feature flags and returns them as an object.
 * Useful for admin panels.
 */
export function useAllFeatures() {
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadFlags().then(cache => {
      if (!cancelled) {
        const obj = {};
        cache.forEach((v, k) => { obj[k] = v; });
        setFlags(obj);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return { flags, loading };
}
