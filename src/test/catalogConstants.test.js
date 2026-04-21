import { describe, it, expect } from 'vitest';
import {
  avatarColors, CAT_GROUPS, SUB_TO_PARENT, DAILY_DEALS, DEAL_PCT,
  fallbackSettings, fallbackProducts, STORE_LAT, STORE_LNG,
  haversine, calcDeliveryCost, CHECKOUT_STEPS, DEFAULT_FORM
} from '../constants/catalogConstants';

describe('catalogConstants', () => {
  it('avatarColors has 10 colors', () => {
    expect(avatarColors).toHaveLength(10);
    avatarColors.forEach(c => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/));
  });

  it('CAT_GROUPS has correct structure', () => {
    expect(CAT_GROUPS.length).toBeGreaterThan(0);
    CAT_GROUPS.forEach(g => {
      expect(g).toHaveProperty('name');
      expect(g).toHaveProperty('icon');
      expect(g).toHaveProperty('subs');
      expect(Array.isArray(g.subs)).toBe(true);
    });
  });

  it('SUB_TO_PARENT maps every sub to its parent', () => {
    CAT_GROUPS.forEach(g => {
      g.subs.forEach(s => {
        expect(SUB_TO_PARENT[s]).toBe(g.name);
      });
    });
  });

  it('DEAL_PCT is a positive number', () => {
    expect(DEAL_PCT).toBe(15);
  });

  it('DAILY_DEALS keys are valid weekdays (1-4)', () => {
    Object.keys(DAILY_DEALS).forEach(k => {
      expect(Number(k)).toBeGreaterThanOrEqual(1);
      expect(Number(k)).toBeLessThanOrEqual(7);
    });
  });

  it('fallbackSettings has required fields', () => {
    expect(fallbackSettings.biz_name).toBeTruthy();
    expect(fallbackSettings.logo_color).toMatch(/^#/);
  });

  it('fallbackProducts have id, name, sale_price', () => {
    fallbackProducts.forEach(p => {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.sale_price).toBeGreaterThan(0);
    });
  });

  it('STORE coordinates are in Buenos Aires area', () => {
    expect(STORE_LAT).toBeCloseTo(-34.43, 1);
    expect(STORE_LNG).toBeCloseTo(-58.73, 1);
  });
});

describe('haversine', () => {
  it('returns 0 for same point', () => {
    expect(haversine(0, 0, 0, 0)).toBe(0);
  });

  it('calculates known distance approximately', () => {
    // Buenos Aires to Rosario ~300km
    const d = haversine(-34.6, -58.38, -32.95, -60.65);
    expect(d).toBeGreaterThan(250);
    expect(d).toBeLessThan(350);
  });

  it('is symmetric', () => {
    const d1 = haversine(-34.43, -58.73, -34.60, -58.38);
    const d2 = haversine(-34.60, -58.38, -34.43, -58.73);
    expect(d1).toBeCloseTo(d2, 5);
  });
});

describe('calcDeliveryCost', () => {
  it('returns cheapest for <=2km', () => {
    expect(calcDeliveryCost(1)).toBe(500);
    expect(calcDeliveryCost(2)).toBe(500);
  });

  it('scales with distance', () => {
    expect(calcDeliveryCost(3)).toBe(1000);
    expect(calcDeliveryCost(7)).toBe(1800);
    expect(calcDeliveryCost(12)).toBe(2500);
    expect(calcDeliveryCost(20)).toBe(3500);
    expect(calcDeliveryCost(30)).toBe(5000);
  });

  it('cost is monotonically increasing', () => {
    const distances = [1, 3, 6, 11, 16, 26];
    const costs = distances.map(calcDeliveryCost);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThanOrEqual(costs[i - 1]);
    }
  });
});

describe('CHECKOUT_STEPS', () => {
  it('has 4 steps in order', () => {
    expect(CHECKOUT_STEPS).toEqual(["Datos", "Entrega", "Pago", "Resumen"]);
  });
});

describe('DEFAULT_FORM', () => {
  it('has all required fields', () => {
    const keys = ['name', 'phone', 'email', 'delivery', 'payment', 'address', 'note', 'change_amount'];
    keys.forEach(k => expect(DEFAULT_FORM).toHaveProperty(k));
  });

  it('defaults to retiro + efectivo + pago justo', () => {
    expect(DEFAULT_FORM.delivery).toBe('retiro');
    expect(DEFAULT_FORM.payment).toBe('efectivo');
    expect(DEFAULT_FORM.change_amount).toBe('justo');
  });
});
