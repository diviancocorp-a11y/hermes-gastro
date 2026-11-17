// submitOrder del front: lo que sale hacia submit-order y lo que vuelve.
// Regresion del patron Zod-strip: opciones, nota y sugerencia (fase 4) se
// descartaban en la validacion y nunca llegaban al servidor.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke }, rpc: vi.fn() } }));
vi.mock('../lib/activeTenant.js', () => ({ resolveTenantSlug: async () => 'cochi' }));
vi.mock('../services/telegramLink.js', () => ({ vincularTelegram: vi.fn() }));

import { submitOrder } from '../services/catalog';

const UUID = '00000000-0000-4000-8000-000000000001';
const SUG = '00000000-0000-4000-8000-000000000009';
const base = { customer: 'Ana', phone: '04141234567', delivery: 'retiro', payment: 'efectivo' };

beforeEach(() => { invoke.mockReset(); });

describe('submitOrder', () => {
  it('manda seleccion, nota y sugerencia de cada item, y la tasa vista', async () => {
    invoke.mockResolvedValue({ data: { ok: true, orderId: 'o1', total: 18.5 }, error: null });
    await submitOrder({
      ...base, fx_visto: 798.57,
      items: [{ recipeId: UUID, qty: 1, selection: [{ groupId: 'proteina', choiceId: 'alitas', qty: 1 }], note: 'sin sal', suggestionId: SUG }],
    });
    const body = invoke.mock.calls[0][1].body;
    expect(body.items[0]).toEqual({
      recipeId: UUID, qty: 1, selection: [{ groupId: 'proteina', choiceId: 'alitas', qty: 1 }], note: 'sin sal', suggestionId: SUG,
    });
    expect(body.fx_visto).toBe(798.57);
  });

  it('un item de siempre sale exactamente igual, sin claves nuevas', async () => {
    invoke.mockResolvedValue({ data: { ok: true, orderId: 'o1' }, error: null });
    await submitOrder({ ...base, items: [{ recipeId: UUID, qty: 2 }] });
    const body = invoke.mock.calls[0][1].body;
    expect(body.items).toEqual([{ recipeId: UUID, qty: 2 }]);
    expect(Object.keys(body)).not.toContain('fx_visto');
  });

  it('devuelve lo que calculo el servidor; una respuesta vieja devuelve lo de siempre', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, orderId: 'o1', total: 17, delivery_pending: true, fx: { rate: 800, currency: 'VES', total_secondary: 13600, status: 'ok' }, warnings: [{ code: 'tasa_cambio' }] }, error: null });
    expect(await submitOrder({ ...base, items: [{ recipeId: UUID, qty: 1 }] })).toEqual({
      ok: true, orderId: 'o1', total: 17, delivery_pending: true,
      fx: { rate: 800, currency: 'VES', total_secondary: 13600, status: 'ok' }, warnings: [{ code: 'tasa_cambio' }],
    });
    invoke.mockResolvedValueOnce({ data: { ok: true, orderId: 'o2' }, error: null });
    expect(await submitOrder({ ...base, items: [{ recipeId: UUID, qty: 1 }] })).toEqual({ ok: true, orderId: 'o2' });
  });

  it('una seleccion mal formada no pasa la validacion', async () => {
    const r = await submitOrder({ ...base, items: [{ recipeId: UUID, qty: 1, selection: [{ groupId: '', choiceId: 'x' }] }] });
    expect(r.ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
});
