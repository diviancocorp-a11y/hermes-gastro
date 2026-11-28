// Vista previa de un tenant con ?tenant=<slug> (src/lib/vistaPrevia.js): solo en
// localhost y *.vercel.app, y sin escrituras.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke }, rpc: vi.fn() } }));
vi.mock('../services/telegramLink.js', () => ({ vincularTelegram: vi.fn() }));

import { tenantDeVistaPrevia, esVistaPrevia, conEjemplo, MENSAJE_VISTA_PREVIA } from '../lib/vistaPrevia';
import { getTenantSlugSync, resolveTenantSlug, _resetTenantCache } from '../lib/activeTenant';
import { submitOrder } from '../services/catalog';
import { cancelOwnOrder } from '../catalog-pro/regretOrder';
import { createBooking, cancelBooking } from '../services/publicBooking';

const loc = (hostname, search = '') => ({ hostname, search });
const irA = (url) => window.history.pushState({}, '', url);

beforeEach(() => { window.sessionStorage.clear(); irA('/'); invoke.mockReset(); _resetTenantCache(); });
afterEach(() => { vi.restoreAllMocks(); irA('/'); });

describe('tenantDeVistaPrevia', () => {
  it('en localhost, 127.0.0.1, [::1] y *.vercel.app toma ?tenant=', () => {
    for (const h of ['localhost', '127.0.0.1', '[::1]', 'hermes-platform-git-feat-x.vercel.app']) {
      window.sessionStorage.clear();
      expect(tenantDeVistaPrevia(loc(h, '?tenant=cochi'))).toBe('cochi');
    }
  });

  it('en un tenant de la plataforma o un dominio propio no hace nada', () => {
    expect(tenantDeVistaPrevia(loc('cochi.divianco.app', '?tenant=otro'))).toBeNull();
    expect(tenantDeVistaPrevia(loc('divianco.app', '?tenant=otro'))).toBeNull();
    expect(tenantDeVistaPrevia(loc('www.minegocio.com', '?tenant=otro'))).toBeNull();
    expect(tenantDeVistaPrevia(loc('vercel.app.evil.com', '?tenant=otro'))).toBeNull();
    expect(window.sessionStorage.getItem('dico_vista_previa_tenant')).toBeNull();
  });

  it('un slug invalido se ignora', () => {
    for (const s of ['Co chi', '-cochi', 'cochi-', '../x', 'a'.repeat(64)]) {
      expect(tenantDeVistaPrevia(loc('localhost', `?tenant=${encodeURIComponent(s)}`))).toBeNull();
    }
  });

  it('persiste en sessionStorage y ?tenant= vacio lo borra', () => {
    expect(tenantDeVistaPrevia(loc('localhost', '?tenant=cochi'))).toBe('cochi');
    expect(window.sessionStorage.getItem('dico_vista_previa_tenant')).toBe('cochi');
    expect(tenantDeVistaPrevia(loc('localhost', ''))).toBe('cochi');
    expect(tenantDeVistaPrevia(loc('localhost', '?tenant='))).toBeNull();
    expect(window.sessionStorage.getItem('dico_vista_previa_tenant')).toBeNull();
    expect(tenantDeVistaPrevia(loc('localhost', ''))).toBeNull();
  });

  it('un valor guardado no sirve en un host que no es de vista previa', () => {
    window.sessionStorage.setItem('dico_vista_previa_tenant', 'cochi');
    expect(tenantDeVistaPrevia(loc('cochi.divianco.app', ''))).toBeNull();
  });

  it('si sessionStorage tira, no rompe', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(tenantDeVistaPrevia(loc('localhost', '?tenant=cochi'))).toBe('cochi');
    expect(tenantDeVistaPrevia(loc('localhost', ''))).toBeNull();
    expect(tenantDeVistaPrevia(loc('localhost', '?tenant='))).toBeNull();
  });
});

describe('conEjemplo', () => {
  it('el dato real gana; el ejemplo solo aparece en vista previa', () => {
    expect(conEjemplo('real', 'ejemplo')).toBe('real');
    expect(conEjemplo(null, 'ejemplo')).toBeNull();
    irA('/?tenant=cochi');
    expect(esVistaPrevia()).toBe(true);
    expect(conEjemplo(undefined, 'ejemplo')).toBe('ejemplo');
    expect(conEjemplo('real', 'ejemplo')).toBe('real');
  });
});

describe('activeTenant con vista previa', () => {
  it('sin override sigue igual (slug del build)', async () => {
    expect(getTenantSlugSync()).not.toBe('cochi-de-prueba');
    const base = getTenantSlugSync();
    expect(await resolveTenantSlug()).toBe(base);
  });

  it('en localhost ?tenant= manda sobre el slug del build', async () => {
    irA('/?tenant=cochi');
    expect(getTenantSlugSync()).toBe('cochi');
    expect(await resolveTenantSlug()).toBe('cochi');
  });
});

describe('sin escrituras en vista previa', () => {
  const UUID = '00000000-0000-4000-8000-000000000001';
  const pedido = { customer: 'Ana', phone: '04141234567', delivery: 'retiro', payment: 'efectivo', items: [{ recipeId: UUID, qty: 1 }] };

  it('submitOrder no llama a la funcion y devuelve el aviso', async () => {
    irA('/?tenant=cochi');
    const r = await submitOrder(pedido);
    expect(invoke).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: false, orderId: null, error: MENSAJE_VISTA_PREVIA });
    expect(MENSAJE_VISTA_PREVIA).toBe('Esto es una vista previa: los pedidos no se envían.');
  });

  it('sin vista previa submitOrder sigue llamando a la funcion', async () => {
    invoke.mockResolvedValue({ data: { ok: true, orderId: 'o1' }, error: null });
    const r = await submitOrder(pedido);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
  });

  it('cancelar pedido y reservas tampoco escriben', async () => {
    irA('/?tenant=cochi');
    expect(await cancelOwnOrder('o1')).toBe(false);
    expect(await createBooking({ serviceId: 's', startsAt: 'x', nombre: 'A', telefono: '1' })).toMatchObject({ ok: false, error: MENSAJE_VISTA_PREVIA });
    expect(await cancelBooking('tok')).toMatchObject({ ok: false, error: MENSAJE_VISTA_PREVIA });
    expect(invoke).not.toHaveBeenCalled();
  });
});
