import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

import {
  fetchAllRecipes, upsertRecipe, toggleRecipeVisibility, deleteRecipe,
  archiveRecipe, unarchiveRecipe, fetchRecipeIngredients, saveRecipeIngredients,
  fetchComboItems, saveComboItems,
} from '@hermes/core/services/recipes';

import { chain } from './_chain.js';

beforeEach(() => vi.clearAllMocks());

describe('fetchAllRecipes', () => {
  it('returns recipes sorted by category', async () => {
    const recs = [{ id: 'r1', name: 'Alfajor', category: 'Dulce' }];
    mockFrom.mockReturnValue(chain({ data: recs, error: null }));
    expect(await fetchAllRecipes()).toEqual(recs);
  });

  it('returns [] on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'err' } }));
    expect(await fetchAllRecipes()).toEqual([]);
  });
});

describe('upsertRecipe', () => {
  const validRecipe = { name: 'Alfajor', category: 'Dulce', sale_price: 500, visible: true };

  it('upserts valid recipe', async () => {
    const returned = { id: 'r1', ...validRecipe };
    mockFrom.mockReturnValue(chain({ data: returned, error: null }));
    expect(await upsertRecipe(validRecipe)).toEqual(returned);
  });

  it('returns validation error for invalid recipe', async () => {
    const result = await upsertRecipe({ name: '', category: '', sale_price: -1 });
    expect(result).toHaveProperty('__error', 'validation');
  });

  it('returns duplicate error for unique constraint violation', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'duplicate key', code: '23505' } }));
    const result = await upsertRecipe(validRecipe);
    expect(result).toHaveProperty('__error', 'duplicate');
  });
});

describe('toggleRecipeVisibility', () => {
  it('returns true on success', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await toggleRecipeVisibility('r1', false)).toBe(true);
  });

  it('returns false on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'fail' } }));
    expect(await toggleRecipeVisibility('r1', true)).toBe(false);
  });
});

describe('deleteRecipe', () => {
  it('returns true on success', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await deleteRecipe('r1')).toBe(true);
  });
});

describe('archiveRecipe / unarchiveRecipe', () => {
  it('archiveRecipe returns true', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await archiveRecipe('r1')).toBe(true);
  });

  it('unarchiveRecipe returns true', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await unarchiveRecipe('r1')).toBe(true);
  });
});

describe('fetchRecipeIngredients', () => {
  it('returns ingredients for recipe', async () => {
    const ris = [{ recipe_id: 'r1', ingredient_id: 'i1', qty: 2 }];
    mockFrom.mockReturnValue(chain({ data: ris, error: null }));
    expect(await fetchRecipeIngredients('r1')).toEqual(ris);
  });
});

describe('saveRecipeIngredients', () => {
  it('deletes old and inserts new ingredients', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    const ings = [{ ingredient_id: 'i1', qty: 3 }];
    expect(await saveRecipeIngredients('r1', ings)).toBe(true);
  });

  it('returns true for empty ingredient list', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await saveRecipeIngredients('r1', [])).toBe(true);
  });
});

describe('fetchComboItems', () => {
  it('returns combo items', async () => {
    const items = [{ recipe_id: 'r1', sub_recipe_id: 'r2', qty: 1 }];
    mockFrom.mockReturnValue(chain({ data: items, error: null }));
    expect(await fetchComboItems('r1')).toEqual(items);
  });
});

describe('saveComboItems', () => {
  it('saves valid combo items', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    const items = [{ sub_recipe_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', qty: 2 }];
    expect(await saveComboItems('r1', items)).toBe(true);
  });

  it('returns true for empty items list', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await saveComboItems('r1', [])).toBe(true);
  });
});
