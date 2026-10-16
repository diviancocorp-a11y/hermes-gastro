// tenants-vivos: el control diario mira los negocios que dice la base.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { clasificar, deVariable, tenantsAMirar } from '../../scripts/tenants-vivos.mjs';

afterEach(() => vi.unstubAllGlobals());

describe('clasificar', () => {
  it('active se mira, trial queda en carga, el resto no', () => {
    const filas = [
      { slug: 'crazy-miga', status: 'active' },
      { slug: 'monare', status: 'trial' },
      { slug: 'cochi', status: 'active' },
      { slug: 'viejo', status: 'dormant' },
    ];
    expect(clasificar(filas)).toEqual({ activos: ['cochi', 'crazy-miga'], enCarga: ['monare'] });
  });
});

describe('tenantsAMirar', () => {
  const CRED = { PLATFORM_SUPABASE_URL: 'https://x.supabase.co/', PLATFORM_SUPABASE_SERVICE_ROLE_KEY: 'k', SMOKE_TENANTS: 'viejo' };

  it('con credenciales lee la base y no la variable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [{ slug: 'nuevo', status: 'active' }] })));
    expect(await tenantsAMirar(CRED)).toEqual({ fuente: 'base', activos: ['nuevo'], enCarga: [] });
    expect(fetch.mock.calls[0][0]).toBe('https://x.supabase.co/rest/v1/tenants?select=slug,status&status=in.(active,trial)');
  });

  it('sin credenciales cae a SMOKE_TENANTS', async () => {
    const t = await tenantsAMirar({ SMOKE_TENANTS: 'a, b,' });
    expect(t).toMatchObject({ fuente: 'variable', activos: ['a', 'b'] });
  });

  it('si la base falla cae a SMOKE_TENANTS y avisa', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    const t = await tenantsAMirar(CRED);
    expect(t).toMatchObject({ fuente: 'variable', activos: ['viejo'] });
    expect(t.aviso).toMatch(/HTTP 500/);
  });
});

it('deVariable ignora vacios y espacios', () => {
  expect(deVariable(' a ,,b ')).toEqual(['a', 'b']);
  expect(deVariable(undefined)).toEqual([]);
});
