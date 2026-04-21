import { describe, it, expect } from 'vitest';
import { queryClient, queryKeys, STALE_TIMES } from '../lib/queryClient';

describe('queryClient', () => {
  it('exports a QueryClient instance', () => {
    expect(queryClient).toBeDefined();
    expect(typeof queryClient.invalidateQueries).toBe('function');
    expect(typeof queryClient.getQueryData).toBe('function');
  });

  it('has retry: 1 default for queries', () => {
    const opts = queryClient.getDefaultOptions();
    expect(opts.queries.retry).toBe(1);
  });
});

describe('queryKeys', () => {
  it('orders.active returns stable key', () => {
    expect(queryKeys.orders.active()).toEqual(['orders', 'active']);
  });

  it('orders.history includes cursor', () => {
    expect(queryKeys.orders.history('2026-01-01')).toEqual(['orders', 'history', { cursor: '2026-01-01' }]);
  });

  it('recipes.ingredients includes id', () => {
    expect(queryKeys.recipes.ingredients('r1')).toEqual(['recipes', 'r1', 'ingredients']);
  });
});

describe('STALE_TIMES', () => {
  it('settings has longest stale time', () => {
    expect(STALE_TIMES.settings).toBeGreaterThan(STALE_TIMES.orders);
  });

  it('orders has shortest stale time', () => {
    expect(STALE_TIMES.orders).toBeLessThanOrEqual(STALE_TIMES.products);
  });
});
