import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

import {
  fetchIngredients, upsertIngredient, deleteIngredient,
  updateIngredientStock, fetchWasteLog, registerWaste,
} from '../services/inventory';

import { chain } from './_chain.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('fetchIngredients', () => {
  it('returns ingredients sorted by name', async () => {
    const ings = [{ id: '1', name: 'Harina' }, { id: '2', name: 'Azucar' }];
    mockFrom.mockReturnValue(chain({ data: ings, error: null }));
    const result = await fetchIngredients();
    expect(result).toEqual(ings);
    expect(mockFrom).toHaveBeenCalledWith('ingredients');
  });

  it('returns empty array on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'fail' } }));
    const result = await fetchIngredients();
    expect(result).toEqual([]);
  });
});

describe('upsertIngredient', () => {
  const validIng = { name: 'Harina', unit: 'kg', cost: 100, stock: 10, min_stock: 2, category: 'Secos' };

  it('upserts valid ingredient', async () => {
    const returned = { id: '1', ...validIng };
    mockFrom.mockReturnValue(chain({ data: returned, error: null }));
    const result = await upsertIngredient(validIng);
    expect(result).toEqual(returned);
  });

  it('returns error for invalid input (missing name)', async () => {
    const result = await upsertIngredient({ unit: 'kg', cost: 100, stock: 0, min_stock: 0, category: 'X' });
    expect(result).toHaveProperty('__error');
  });

  it('returns error on db failure', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'db fail' } }));
    const result = await upsertIngredient(validIng);
    expect(result).toHaveProperty('__error');
  });
});

describe('deleteIngredient', () => {
  it('returns true on success', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await deleteIngredient('1')).toBe(true);
  });

  it('returns false on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'fail' } }));
    expect(await deleteIngredient('1')).toBe(false);
  });
});

describe('updateIngredientStock', () => {
  it('uses RPC when available', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await updateIngredientStock('ing1', 5);
    expect(mockRpc).toHaveBeenCalledWith('adjust_stock', { p_ingredient_id: 'ing1', p_delta: 5 });
  });

  it('falls back to read-then-write when RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'function not found' } });
    const qb = chain({ data: { stock: 10 }, error: null });
    mockFrom.mockReturnValue(qb);
    await updateIngredientStock('ing1', -3);
    expect(mockFrom).toHaveBeenCalledWith('ingredients');
  });
});

describe('fetchWasteLog', () => {
  it('returns waste entries', async () => {
    const waste = [{ id: 'w1', ingredient_id: 'i1', qty: 2 }];
    mockFrom.mockReturnValue(chain({ data: waste, error: null }));
    expect(await fetchWasteLog()).toEqual(waste);
  });

  it('returns empty on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'fail' } }));
    expect(await fetchWasteLog()).toEqual([]);
  });
});

describe('registerWaste', () => {
  const ING_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  it('registers waste and deducts stock', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    mockRpc.mockResolvedValue({ error: null });
    const result = await registerWaste(ING_UUID, 3, 'rotura', 'se cayo');
    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('waste_log');
    expect(mockRpc).toHaveBeenCalledWith('adjust_stock', { p_ingredient_id: ING_UUID, p_delta: -3 });
  });

  it('returns false on invalid input', async () => {
    const result = await registerWaste('', -1, 'invalid_reason');
    expect(result).toBe(false);
  });
});
