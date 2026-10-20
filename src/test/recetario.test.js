import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chain } from './_chain.js';
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));
import { fetchRecipeCards, saveRecipeCard, saveProductAllergens, scaleRecipeIngredients, SELECT_COLS } from '../services/recetario.js';
import { RecipeCardInputSchema } from '../lib/schemas/index.js';

const tenant = '11111111-1111-4111-8111-111111111111';
const product = '22222222-2222-4222-8222-222222222222';
const input = { yield_qty: 12, yield_unit: ' unidades ', time_minutes: 40,
  steps: [{ texto: ' Mezclar ' }], notes: ' Refrigerar ', visible_to: ['owner'], is_archived: true };
beforeEach(() => vi.resetAllMocks());

describe('recetario service', () => {
  it('fetch scopes tenant, selects stamps and includes archived cards', async () => {
    const rows = [{ product_id: product, is_archived: true }];
    const q = chain({ data: rows, error: null }); from.mockReturnValue(q);
    expect(await fetchRecipeCards(tenant)).toEqual(rows);
    expect(from).toHaveBeenCalledWith('recipe_cards');
    expect(q.select).toHaveBeenCalledWith(SELECT_COLS);
    expect(q.eq).toHaveBeenCalledExactlyOnceWith('tenant_id', tenant);
  });
  it('empty list is a valid result', async () => {
    from.mockReturnValue(chain({ data: [], error: null }));
    expect(await fetchRecipeCards(tenant)).toEqual([]);
  });
  it.each([fetchRecipeCards, id => saveRecipeCard(id, product, input)])('rejects invalid tenant before I/O', async fn => {
    await expect(fn('')).rejects.toThrow(); expect(from).not.toHaveBeenCalled();
  });
  it('requires product id before I/O', async () => {
    await expect(saveRecipeCard(tenant, undefined, input)).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
  it('upserts full card on product_id, keeps owner-only, trims text and omits server stamps', async () => {
    const q = chain({ data: { id: product }, error: null }); from.mockReturnValue(q);
    expect(await saveRecipeCard(tenant, product, input)).toEqual({ id: product });
    expect(q.upsert).toHaveBeenCalledWith({ ...input, yield_unit: 'unidades', steps: [{ texto: 'Mezclar' }],
      notes: 'Refrigerar', tenant_id: tenant, product_id: product }, { onConflict: 'product_id' });
    expect(q.single).toHaveBeenCalledOnce();
  });
  it.each([
    { yield_qty: 0 }, { yield_qty: Infinity }, { yield_qty: '12' }, { yield_qty: 1e10 },
    { yield_unit: ' ' }, { time_minutes: -1 }, { time_minutes: 1.5 },
    { steps: [{ texto: '' }] }, { steps: [{ texto: 'a', minutos: 2 }] },
    { visible_to: [] }, { visible_to: ['attendant'] }, { visible_to: ['manager', 'manager'] },
    { photo_path: 'private.webp' }, { tenant_id: tenant }, { updated_by: product },
  ])('rejects invalid/unknown fields before I/O: %j', async invalid => {
    await expect(saveRecipeCard(tenant, product, { ...input, ...invalid })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
  it('default complete input is usable and does not strip editable fields', () => {
    expect(RecipeCardInputSchema.parse({})).toEqual({ yield_qty: 1, yield_unit: 'unidad', time_minutes: null,
      steps: [], notes: null, visible_to: ['owner', 'manager', 'kitchen'], is_archived: false });
    const snap = JSON.parse(readFileSync(resolve(__dirname, '../../scripts/platform-schema.json'), 'utf8'));
    for (const col of SELECT_COLS.split(', ')) expect(snap.tables.recipe_cards).toContain(col);
    const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../scripts/db-columns-manifest.json'), 'utf8'));
    expect(Object.keys(RecipeCardInputSchema.parse({})).sort()).toEqual(manifest.tables.recipe_cards.columns.toSorted());
  });
  it.each([
    () => fetchRecipeCards(tenant), () => saveRecipeCard(tenant, product, input),
    () => saveProductAllergens(tenant, product, { allergens: [] }),
  ])('propagates database error code and cause', async call => {
    const error = { message: 'RLS denied', code: '42501' };
    from.mockReturnValue(chain({ data: null, error }));
    await expect(call()).rejects.toMatchObject({ code: '42501', cause: error });
  });
  it('missing save row never means success', async () => {
    from.mockReturnValue(chain());
    await expect(saveRecipeCard(tenant, product, input)).rejects.toThrow('sin datos');
  });
  it('allergens update only the matching tenant/product and persist [] clearing', async () => {
    const q = chain({ data: { id: product, allergens: [] }, error: null }); from.mockReturnValue(q);
    await saveProductAllergens(tenant, product, { allergens: [] });
    expect(from).toHaveBeenCalledWith('products');
    expect(q.update).toHaveBeenCalledWith({ allergens: [] });
    expect(q.eq.mock.calls).toEqual([['tenant_id', tenant], ['id', product]]);
  });
  it('rejects blank allergens and unknown product fields', async () => {
    await expect(saveProductAllergens(tenant, product, { allergens: [' '] })).rejects.toThrow();
    await expect(saveProductAllergens(tenant, product, { allergens: [], name: 'x' })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
});

describe('ingredient scaling', () => {
  it('scales fractional quantities without mutating lines or losing metadata', () => {
    const lines = Object.freeze([Object.freeze({ ingredient_id: product, qty: 0.75, unit: 'kg' })]);
    expect(scaleRecipeIngredients(lines, 12, 18)).toEqual([{ ingredient_id: product, qty: 1.125, unit: 'kg' }]);
    expect(lines[0].qty).toBe(0.75);
    expect(scaleRecipeIngredients(lines, 12, 0)[0].qty).toBe(0);
  });
  it.each([[0, 1], [-1, 1], [NaN, 1], [1, Infinity], [1, -1], ['2', 1]])('rejects invalid base/target %j %j', (base, target) => {
    expect(() => scaleRecipeIngredients([], base, target)).toThrow();
  });
  it.each([null, [{ qty: '2' }], [{ qty: -1 }], [{ qty: Infinity }], [{}]])('rejects malformed lines %j', lines => {
    expect(() => scaleRecipeIngredients(lines, 1, 2)).toThrow();
  });
  it('rejects overflow', () => {
    expect(() => scaleRecipeIngredients([{ qty: Number.MAX_VALUE }], 1, 2)).toThrow(RangeError);
  });
});
