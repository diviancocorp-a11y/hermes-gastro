import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const invoke = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }));
vi.mock('../lib/activeTenant.js', () => ({ resolveTenantSlug: vi.fn(async () => 'crazy-miga') }));

import { vincularTelegram } from '../services/telegramLink';

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { ok: true }, error: null });
});
afterEach(() => { delete window.Telegram; });

describe('vincularTelegram', () => {
  it('fuera de Telegram no hace nada', async () => {
    expect(await vincularTelegram('3515551234')).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('sin telefono no hace nada', async () => {
    window.Telegram = { WebApp: { initData: 'x=1&hash=abc', requestWriteAccess: (cb) => cb() } };
    expect(await vincularTelegram('')).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('manda el initData firmado, el telefono y el negocio', async () => {
    window.Telegram = { WebApp: { initData: 'user=%7B%7D&hash=abc', requestWriteAccess: (cb) => cb(true) } };
    expect(await vincularTelegram('3515551234')).toBe(true);
    expect(invoke).toHaveBeenCalledWith('tg-vincular', {
      body: { tenant_slug: 'crazy-miga', init_data: 'user=%7B%7D&hash=abc', phone: '3515551234' },
    });
  });

  it('si Telegram no responde al permiso, igual vincula', async () => {
    vi.useFakeTimers();
    window.Telegram = { WebApp: { initData: 'a=1&hash=b', requestWriteAccess: () => {} } };
    const p = vincularTelegram('3515551234');
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toBe(true);
    vi.useRealTimers();
  });

  it('un error del servidor no tira el pedido: devuelve false', async () => {
    window.Telegram = { WebApp: { initData: 'a=1&hash=b', requestWriteAccess: (cb) => cb() } };
    invoke.mockResolvedValue({ data: null, error: new Error('boom') });
    expect(await vincularTelegram('3515551234')).toBe(false);
    invoke.mockRejectedValue(new Error('red caida'));
    await expect(vincularTelegram('3515551234')).resolves.toBe(false);
  });
});
