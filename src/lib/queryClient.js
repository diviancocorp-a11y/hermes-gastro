// src/lib/queryClient.js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Sensible defaults: retry once, show stale data while refetching
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 30_000, // 30s default, overridden per-query
    },
    mutations: {
      retry: 0,
    },
  },
});

// ─── Stale time presets ─────────────────────────────────
export const STALE_TIMES = {
  settings: 5 * 60_000,    // 5 min — rarely changes
  products: 60_000,         // 1 min — changes occasionally
  orders: 10_000,           // 10 sec — changes frequently
  ingredients: 60_000,      // 1 min
  finance: 2 * 60_000,     // 2 min
  coupons: 2 * 60_000,     // 2 min
};

// ─── Query key factories ────────────────────────────────
export const queryKeys = {
  orders: {
    all: ['orders'],
    active: () => ['orders', 'active'],
    history: (cursor) => ['orders', 'history', { cursor }],
    list: () => ['orders', 'list'],
  },
  recipes: {
    all: ['recipes'],
    ingredients: (id) => ['recipes', id, 'ingredients'],
    combo: (id) => ['recipes', id, 'combo'],
  },
  ingredients: {
    all: ['ingredients'],
    waste: (cursor) => ['ingredients', 'waste', { cursor }],
  },
  sales: {
    all: ['sales'],
  },
  expenses: {
    all: ['expenses'],
  },
  purchases: {
    all: ['purchases'],
  },
  coupons: {
    all: ['coupons'],
  },
  settings: {
    all: ['settings'],
  },
  dashboard: {
    stats: ['dashboard', 'stats'],
  },
};
