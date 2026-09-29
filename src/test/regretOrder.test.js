// src/test/regretOrder.test.js
// El boton de arrepentimiento: va por la edge function cancel-order del
// edificio con el negocio del host. La regla (60s, status new) la valida el
// server (cancel_own_order, 0082); aca se prueba que el front pregunte bien y
// lea bien la respuesta.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invoke, slug, removeActiveOrder } = vi.hoisted(() => ({
  invoke: vi.fn(),
  slug: { valor: 'cochi' },
  removeActiveOrder: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke } } }));
vi.mock('../lib/activeTenant', () => ({ resolveTenantSlug: vi.fn(async () => slug.valor) }));
vi.mock('../lib/activeOrders', () => ({ removeActiveOrder }));

import { cancelOwnOrder } from '../catalog-pro/regretOrder';

const ID = '3f1c2b4a-1111-4222-8333-944455566677';

beforeEach(() => {
  invoke.mockReset();
  removeActiveOrder.mockReset();
  slug.valor = 'cochi';
});

describe('cancelOwnOrder', () => {
  it('manda el negocio del host y el pedido; si cancelo, lo saca de los activos', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    expect(await cancelOwnOrder(ID)).toBe(true);
    expect(invoke).toHaveBeenCalledWith('cancel-order', { body: { tenant_slug: 'cochi', order_id: ID } });
    expect(removeActiveOrder).toHaveBeenCalledWith(ID);
  });

  it('"ya no se puede" (paso el minuto, ya en cocina) es false y no toca los activos', async () => {
    invoke.mockResolvedValue({ data: { ok: false }, error: null });
    expect(await cancelOwnOrder(ID)).toBe(false);
    expect(removeActiveOrder).not.toHaveBeenCalled();
  });

  it('un error de la function es false', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: '429' } });
    expect(await cancelOwnOrder(ID)).toBe(false);
  });

  it('sin negocio no pregunta', async () => {
    slug.valor = null;
    expect(await cancelOwnOrder(ID)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
});
