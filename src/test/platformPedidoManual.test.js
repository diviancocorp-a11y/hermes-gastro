// crearPedidoManual: con la red colgada no deja la pantalla enviando para
// siempre, y el reintento despues de un corte usa la MISMA clave (submit-order
// no duplica el pedido si el primero si entro).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const invoke = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) },
    functions: { invoke: (...a) => invoke(...a) },
  },
}));

import { crearPedidoManual, LIMITE_MS, ERROR_SIN_RESPUESTA } from '../services/platformPedidoManual';

const CUERPO = {
  tenant_slug: 'cochi', origen: 'whatsapp', customer: 'María', phone: '04141234567', delivery: 'retiro',
  address: null, payment: 'efectivo', payment_account_id: null, note: null, items: [{ recipeId: 'ma', qty: 1 }],
};

describe('crearPedidoManual', () => {
  beforeEach(() => { invoke.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sin respuesta en el limite devuelve "no sabemos si entró" y aborta el pedido', async () => {
    vi.useFakeTimers();
    let signal;
    invoke.mockImplementation((_n, opts) => { signal = opts.signal; return new Promise(() => {}); });
    const p = crearPedidoManual(CUERPO);
    await vi.advanceTimersByTimeAsync(LIMITE_MS - 1);
    let listo = false;
    p.then(() => { listo = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(listo).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ ok: false, error: ERROR_SIN_RESPUESTA });
    expect(signal?.aborted).toBe(true);
  });

  it('el reintento despues del corte usa la misma clave; despues de entrar, una nueva', async () => {
    vi.useFakeTimers();
    invoke.mockImplementationOnce(() => new Promise(() => {}));
    const primero = crearPedidoManual(CUERPO);
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
    await primero;
    vi.useRealTimers();

    invoke.mockResolvedValue({ data: { ok: true, orderId: 'n1', total: 1.5 }, error: null });
    expect(await crearPedidoManual(CUERPO)).toEqual({ ok: true, orderId: 'n1', total: 1.5 });
    await crearPedidoManual(CUERPO);

    const claves = invoke.mock.calls.map((c) => c[1].body.client_request_id);
    expect(claves[0]).toBeTruthy();
    expect(claves[1]).toBe(claves[0]);
    expect(claves[2]).not.toBe(claves[0]);
  });

  it('una respuesta a tiempo pasa como siempre', async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: 'La Malta está agotada' }, error: null });
    expect(await crearPedidoManual(CUERPO)).toEqual({ ok: false, error: 'La Malta está agotada' });
  });
});
