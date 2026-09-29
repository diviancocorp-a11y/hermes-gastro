// src/test/featureFlags.test.jsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { isEnabled } from '../services/featureFlags';
import useFeature from '../hooks/useFeature';

describe('featureFlags', () => {
  it('los flags del catalogo estan prendidos y los que no se usan, apagados', () => {
    expect(isEnabled('GIFT_MODE')).toBe(true);
    expect(isEnabled('PUSH_NOTIFICATIONS')).toBe(true);
    expect(isEnabled('DAILY_DEALS')).toBe(true);
    expect(isEnabled('WHATSAPP')).toBe(true);
    expect(isEnabled('LOYALTY')).toBe(false);
  });

  it('un flag desconocido cuenta como apagado', () => {
    expect(isEnabled('UNKNOWN_FLAG')).toBe(false);
  });

  it('useFeature devuelve el valor desde el primer render', () => {
    const { result } = renderHook(() => useFeature('GIFT_MODE'));
    expect(result.current).toBe(true);
  });
});
