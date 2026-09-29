// src/hooks/useFeature.js
// React hook for checking feature flags.
import { isEnabled } from '../services/featureFlags';

/**
 * Whether a feature flag is enabled. The flags are constants (see
 * services/featureFlags.js), so there is nothing to load or subscribe to.
 *
 * @param {string} key — Feature flag key (e.g., 'GIFT_MODE')
 * @returns {boolean}
 *
 * @example
 * const giftEnabled = useFeature('GIFT_MODE');
 */
export default function useFeature(key) {
  return isEnabled(key);
}
