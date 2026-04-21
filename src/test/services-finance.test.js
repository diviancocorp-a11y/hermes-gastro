import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

import { fetchSales, createSale, deleteSale, fetchExpenses, createExpense, deleteExpense } from '../services/finance';

import { chain } from './_chain.js';

beforeEach(() => vi.clearAllMocks());

describe('fetchSales', () => {
  it('returns sales data', async () => {
    const sales = [{ id: 's1', total: 1000, date: '2026-04-01' }];
    mockFrom.mockReturnValue(chain({ data: sales, error: null }));
    expect(await fetchSales()).toEqual(sales);
    expect(mockFrom).toHaveBeenCalledWith('sales');
  });

  it('returns [] on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'err' } }));
    expect(await fetchSales()).toEqual([]);
  });
});

describe('createSale', () => {
  const validSale = { date: '2026-04-15', recipe_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', qty: 2, unit_price: 500, total: 1000 };

  it('creates a valid sale', async () => {
    const returned = { id: 's1', ...validSale };
    mockFrom.mockReturnValue(chain({ data: returned, error: null }));
    expect(await createSale(validSale)).toEqual(returned);
  });

  it('returns null for invalid sale (missing date)', async () => {
    expect(await createSale({ qty: 1, unit_price: 100, total: 100 })).toBeNull();
  });

  it('returns null on db error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'fail' } }));
    expect(await createSale(validSale)).toBeNull();
  });
});

describe('deleteSale', () => {
  it('returns true on success', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await deleteSale('s1')).toBe(true);
  });

  it('returns false on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'fail' } }));
    expect(await deleteSale('s1')).toBe(false);
  });
});

describe('fetchExpenses', () => {
  it('returns expenses', async () => {
    const exps = [{ id: 'e1', amount: 500 }];
    mockFrom.mockReturnValue(chain({ data: exps, error: null }));
    expect(await fetchExpenses()).toEqual(exps);
  });

  it('returns [] on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'err' } }));
    expect(await fetchExpenses()).toEqual([]);
  });
});

describe('createExpense', () => {
  const validExp = { date: '2026-04-15', description: 'Gas', amount: 800, category: 'Servicios' };

  it('creates a valid expense', async () => {
    const returned = { id: 'e1', ...validExp };
    mockFrom.mockReturnValue(chain({ data: returned, error: null }));
    expect(await createExpense(validExp)).toEqual(returned);
  });

  it('returns null for invalid expense', async () => {
    expect(await createExpense({ amount: -5 })).toBeNull();
  });
});

describe('deleteExpense', () => {
  it('returns true on success', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await deleteExpense('e1')).toBe(true);
  });
});
