// src/test/featureFlags.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { supabase } from '../lib/supabase';

// El build por defecto de los tests es el edificio (platform: true), que no
// tiene feature_flags. Estos tests cubren el camino legacy salvo que digan otra cosa.
const biz = vi.hoisted(() => ({ platform: false }));
vi.mock('@business', () => ({ default: biz }));

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({
        data: [
          { key: 'GIFT_MODE', enabled: true },
          { key: 'LOYALTY', enabled: false },
        ],
        error: null,
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      order: vi.fn(() => Promise.resolve({
        data: [
          { key: 'GIFT_MODE', enabled: true, description: 'Gift mode', updated_at: '2026-01-01' },
          { key: 'LOYALTY', enabled: false, description: 'Loyalty', updated_at: '2026-01-01' },
        ],
        error: null,
      })),
    })),
  },
}));

describe('featureFlags service', () => {
  let service;

  beforeEach(async () => {
    biz.platform = false;
    supabase.from.mockClear();
    vi.resetModules();
    service = await import('../services/featureFlags');
  });

  it('loadFlags en el edificio no consulta feature_flags y usa los defaults', async () => {
    biz.platform = true;
    const cache = await service.loadFlags();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(cache.get('GIFT_MODE')).toBe(true);
    expect(cache.get('LOYALTY')).toBe(false);
    expect(cache.get('DAILY_DEALS')).toBe(true);
  });

  it('isEnabled returns default when flags not loaded', () => {
    // Before loading, should return DEFAULTS
    expect(service.isEnabled('GIFT_MODE')).toBe(true);
    expect(service.isEnabled('LOYALTY')).toBe(false);
    expect(service.isEnabled('UNKNOWN_FLAG')).toBe(false);
  });

  it('loadFlags fetches from DB and caches', async () => {
    const cache = await service.loadFlags();
    expect(supabase.from).toHaveBeenCalledWith('feature_flags');
    expect(cache).toBeInstanceOf(Map);
    expect(cache.get('GIFT_MODE')).toBe(true);
    expect(cache.get('LOYALTY')).toBe(false);
  });

  it('loadFlags returns cached on subsequent calls', async () => {
    const first = await service.loadFlags();
    const second = await service.loadFlags();
    expect(first).toBe(second);
  });

  it('getAllFlags returns plain object with all flags', async () => {
    await service.loadFlags();
    const all = service.getAllFlags();
    expect(typeof all).toBe('object');
    expect(all.GIFT_MODE).toBe(true);
    expect(all.LOYALTY).toBe(false);
    // Defaults filled in
    expect(all.DELIVERY_ENABLED).toBe(true);
  });

  it('refreshFlags resets cache and reloads', async () => {
    await service.loadFlags();
    const fresh = await service.refreshFlags();
    expect(fresh).toBeInstanceOf(Map);
  });
});

describe('useFeature hook', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns boolean for a flag key', async () => {
    const { default: useFeature } = await import('../hooks/useFeature');
    const { result } = renderHook(() => useFeature('GIFT_MODE'));
    // Initially returns default (true)
    expect(typeof result.current).toBe('boolean');
    expect(result.current).toBe(true);
  });

  it('useAllFeatures returns flags object and loading state', async () => {
    const { useAllFeatures } = await import('../hooks/useFeature');
    const { result } = renderHook(() => useAllFeatures());
    expect(result.current).toHaveProperty('flags');
    expect(result.current).toHaveProperty('loading');
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
