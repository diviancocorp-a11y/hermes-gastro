import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useFinancials from '../hooks/useFinancials';

// Mock todayISO to return a fixed date
vi.mock('../lib/utils', async () => {
  const actual = await vi.importActual('../lib/utils');
  return {
    ...actual,
    todayISO: () => '2026-04-15',
  };
});

const baseIngredients = [
  { id: 'i1', name: 'Harina', cost: 100, stock: 50, min_stock: 10, unit: 'kg' },
  { id: 'i2', name: 'Azúcar', cost: 80, stock: 5, min_stock: 10, unit: 'kg' },  // low stock
  { id: 'i3', name: 'Huevos', cost: 50, stock: 20, min_stock: 5, unit: 'un' },
];

const baseRecipes = [
  {
    id: 'r1', name: 'Torta', category: 'Dulce', sale_price: 1000,
    ingredients: [
      { ingredient_id: 'i1', quantity: 2 },  // 2kg harina = 200
      { ingredient_id: 'i2', quantity: 1 },  // 1kg azúcar = 80
    ],
  },
  {
    id: 'r2', name: 'Pan', category: 'Salado', sale_price: 500,
    ingredients: [
      { ingredient_id: 'i1', quantity: 1 },  // 1kg harina = 100
    ],
  },
];

const monthSales = [
  { id: 's1', date: '2026-04-10', recipe_id: 'r1', qty: 2, unit_price: 1000, total: 2000, unit_cost: null },
  { id: 's2', date: '2026-04-12', recipe_id: 'r2', qty: 3, unit_price: 500, total: 1500, unit_cost: 100 },
  { id: 's3', date: '2026-03-15', recipe_id: 'r1', qty: 1, unit_price: 1000, total: 1000 }, // prev month
];

const monthExpenses = [
  { id: 'e1', date: '2026-04-05', amount: 500, description: 'Gas' },
  { id: 'e2', date: '2026-04-08', amount: 300, description: 'Luz' },
  { id: 'e3', date: '2026-03-20', amount: 1000, description: 'Old' }, // prev month
];

const baseOrders = [
  { id: 'o1', status: 'new', total: 1000 },
  { id: 'o2', status: 'preparing', total: 2000 },
  { id: 'o3', status: 'completed', total: 500 },
  { id: 'o4', status: 'cancelled', total: 300 },
  { id: 'o5', status: 'active', total: 1500 },
];

const baseWaste = [
  { id: 'w1', date: '2026-04-10', ingredient_id: 'i1', qty: 3 },  // 3 * 100 = 300
  { id: 'w2', date: '2026-04-12', ingredient_id: 'i2', qty: 1 },  // 1 * 80 = 80
  { id: 'w3', date: '2026-03-01', ingredient_id: 'i1', qty: 5 },  // prev month
];

function renderFinancials(overrides = {}) {
  return renderHook(() => useFinancials({
    ings: baseIngredients,
    recs: baseRecipes,
    sales: monthSales,
    exps: monthExpenses,
    orders: baseOrders,
    waste: baseWaste,
    ...overrides,
  }));
}

describe('useFinancials', () => {
  describe('calculateRecipeCost', () => {
    it('calculates cost from ingredients', () => {
      const { result } = renderFinancials();
      // r1: 2*100 + 1*80 = 280
      expect(result.current.calculateRecipeCost(baseRecipes[0])).toBe(280);
    });

    it('calculates cost for simpler recipe', () => {
      const { result } = renderFinancials();
      // r2: 1*100 = 100
      expect(result.current.calculateRecipeCost(baseRecipes[1])).toBe(100);
    });

    it('returns 0 for recipe without ingredients', () => {
      const { result } = renderFinancials();
      expect(result.current.calculateRecipeCost({ id: 'r3' })).toBe(0);
      expect(result.current.calculateRecipeCost(null)).toBe(0);
    });
  });

  describe('lowStockIngredients', () => {
    it('identifies ingredients below min_stock', () => {
      const { result } = renderFinancials();
      const low = result.current.lowStockIngredients;
      expect(low).toHaveLength(1);
      expect(low[0].name).toBe('Azúcar');
    });

    it('returns empty when all stock is adequate', () => {
      const healthyIngs = baseIngredients.map(i => ({ ...i, stock: 100 }));
      const { result } = renderFinancials({ ings: healthyIngs });
      expect(result.current.lowStockIngredients).toHaveLength(0);
    });
  });

  describe('activeOrders', () => {
    it('includes new, preparing, and active orders', () => {
      const { result } = renderFinancials();
      const active = result.current.activeOrders;
      expect(active).toHaveLength(3);
      expect(active.map(o => o.id)).toEqual(['o1', 'o2', 'o5']);
    });
  });

  describe('monthSales', () => {
    it('sums only current month sales', () => {
      const { result } = renderFinancials();
      // s1: 2000 + s2: 1500 = 3500 (s3 is March)
      expect(result.current.monthSales).toBe(3500);
    });
  });

  describe('monthExpenses', () => {
    it('sums only current month expenses', () => {
      const { result } = renderFinancials();
      // e1: 500 + e2: 300 = 800 (e3 is March)
      expect(result.current.monthExpenses).toBe(800);
    });
  });

  describe('monthProductionCost', () => {
    it('uses unit_cost when available, otherwise calculates', () => {
      const { result } = renderFinancials();
      // s1: no unit_cost → calculateRecipeCost(r1)*2 = 280*2 = 560
      // s2: unit_cost=100 → 100*3 = 300
      expect(result.current.monthProductionCost).toBe(860);
    });
  });

  describe('monthWasteCost', () => {
    it('sums waste cost for current month only', () => {
      const { result } = renderFinancials();
      // w1: 3 * 100 = 300, w2: 1 * 80 = 80 → total 380
      expect(result.current.monthWasteCost).toBe(380);
    });
  });

  describe('monthProfit', () => {
    it('equals sales minus expenses', () => {
      const { result } = renderFinancials();
      // 3500 - 800 = 2700
      expect(result.current.monthProfit).toBe(2700);
    });
  });

  describe('profitMargin', () => {
    it('calculates margin including waste', () => {
      const { result } = renderFinancials();
      // (3500 - 800 - 380) / 3500 * 100 = 66.28...%
      expect(result.current.profitMargin).toBeCloseTo(66.29, 0);
    });

    it('returns 0 when no sales', () => {
      const { result } = renderFinancials({ sales: [] });
      expect(result.current.profitMargin).toBe(0);
    });
  });
});
