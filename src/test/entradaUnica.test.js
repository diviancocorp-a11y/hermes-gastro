// @vitest-environment jsdom
// Un solo login para todos los negocios: a donde manda a cada persona y como
// viaja la sesion hasta el subdominio.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const tenantsQuery = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn();
const setSession = vi.fn();
const destinoTrasLogin = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => tenantsQuery() }) }),
    auth: {
      getSession: (...a) => getSession(...a),
      signOut: (...a) => signOut(...a),
      setSession: (...a) => setSession(...a),
    },
  },
}));
vi.mock('../services/signup', () => ({ destinoTrasLogin: (...a) => destinoTrasLogin(...a) }));

const {
  resolverDestino, armarUrlAdmin, irAlAdmin, tomarTraspaso, slugValido, CLAVE_TRASPASO,
} = await import('../services/entradaUnica');

function ubicar(host, ruta = '/entrar', hash = '') {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      hostname: host, origin: `https://${host}`, pathname: ruta, search: '', hash,
      assign: vi.fn(),
    },
  });
  window.history.replaceState = vi.fn();
}

beforeEach(() => {
  vi.clearAllMocks();
  ubicar('divianco.app');
  getSession.mockResolvedValue({ data: { session: { access_token: 'AT', refresh_token: 'RT' } } });
  signOut.mockResolvedValue({ error: null });
  setSession.mockResolvedValue({ error: null });
});

describe('resolverDestino', () => {
  it('un solo negocio: directo', async () => {
    tenantsQuery.mockResolvedValue({ data: [{ slug: 'mia-estudio', name: 'MiaEstudio' }], error: null });
    const r = await resolverDestino();
    expect(r).toEqual({ ok: true, tipo: 'negocio', negocio: { slug: 'mia-estudio', name: 'MiaEstudio' } });
    expect(destinoTrasLogin).not.toHaveBeenCalled();
  });

  it('varios negocios: la persona elige', async () => {
    const lista = [{ slug: 'a', name: 'A' }, { slug: 'b', name: 'B' }];
    tenantsQuery.mockResolvedValue({ data: lista, error: null });
    const r = await resolverDestino();
    expect(r.tipo).toBe('elegir');
    expect(r.negocios).toEqual(lista);
  });

  it('descarta slugs con forma rara en vez de armar una URL con ellos', async () => {
    tenantsQuery.mockResolvedValue({
      data: [{ slug: 'ok', name: 'Ok' }, { slug: 'evil.com/x', name: 'Mal' }, { slug: null, name: 'Nada' }],
      error: null,
    });
    const r = await resolverDestino();
    expect(r.tipo).toBe('negocio');
    expect(r.negocio.slug).toBe('ok');
  });

  it('sin negocios cae a signup_tenant: crea el pendiente', async () => {
    tenantsQuery.mockResolvedValue({ data: [], error: null });
    destinoTrasLogin.mockResolvedValue({ ok: true, slug: 'nuevo', url: 'https://nuevo.divianco.app/' });
    const r = await resolverDestino();
    expect(r).toEqual({ ok: true, tipo: 'negocio', negocio: { slug: 'nuevo', name: 'nuevo' } });
  });

  it('sin negocios y siendo staff de Divianco: a la consola', async () => {
    tenantsQuery.mockResolvedValue({ data: [], error: null });
    destinoTrasLogin.mockResolvedValue({ ok: true, slug: null, url: 'https://divianco.app/consola' });
    expect(await resolverDestino()).toEqual({ ok: true, tipo: 'staff', url: 'https://divianco.app/consola' });
  });

  it('si no se puede leer la lista, no adivina', async () => {
    tenantsQuery.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const r = await resolverDestino();
    expect(r.ok).toBe(false);
    expect(destinoTrasLogin).not.toHaveBeenCalled();
  });
});

describe('armarUrlAdmin / irAlAdmin', () => {
  it('desde la raiz cruza al subdominio, siempre al /admin, con la sesion en el hash', async () => {
    const r = await armarUrlAdmin('mia-estudio');
    expect(r.traspasa).toBe(true);
    expect(r.url.startsWith('https://mia-estudio.divianco.app/admin#')).toBe(true);
    const carga = JSON.parse(decodeURIComponent(r.url.split(`#${CLAVE_TRASPASO}=`)[1]));
    expect(carga).toEqual({ a: 'AT', r: 'RT' });
  });

  it('en local o preview no cruza de origen: /admin y sin tokens en la URL', async () => {
    ubicar('localhost');
    const r = await armarUrlAdmin('mia-estudio');
    expect(r).toEqual({ ok: true, traspasa: false, url: 'https://localhost/admin' });
  });

  it('un slug que no es slug no arma URL', async () => {
    expect((await armarUrlAdmin('a.evil.com')).ok).toBe(false);
    expect((await armarUrlAdmin('../x')).ok).toBe(false);
    expect(slugValido('mia-estudio')).toBe(true);
    expect(slugValido('-x')).toBe(false);
  });

  it('sin sesion no manda a nadie con la URL vacia', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect((await armarUrlAdmin('mia-estudio')).ok).toBe(false);
  });

  it('al salir cierra la sesion SOLO local y despues navega', async () => {
    await irAlAdmin('mia-estudio');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(window.location.assign.mock.invocationCallOrder[0]);
  });

  it('en local no cierra la sesion: es la misma', async () => {
    ubicar('localhost');
    await irAlAdmin('mia-estudio');
    expect(signOut).not.toHaveBeenCalled();
    expect(window.location.assign).toHaveBeenCalledWith('https://localhost/admin');
  });
});

describe('tomarTraspaso', () => {
  const hashCon = (a, r) => `#${CLAVE_TRASPASO}=${encodeURIComponent(JSON.stringify({ a, r }))}`;

  it('toma la sesion y limpia la barra antes de llamar a Supabase', async () => {
    ubicar('mia-estudio.divianco.app', '/admin', hashCon('AT', 'RT'));
    expect(await tomarTraspaso()).toBe(true);
    expect(setSession).toHaveBeenCalledWith({ access_token: 'AT', refresh_token: 'RT' });
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/admin');
    expect(window.history.replaceState.mock.invocationCallOrder[0])
      .toBeLessThan(setSession.mock.invocationCallOrder[0]);
  });

  it('sin hash de traspaso no hace nada', async () => {
    ubicar('mia-estudio.divianco.app', '/admin', '');
    expect(await tomarTraspaso()).toBe(false);
    expect(setSession).not.toHaveBeenCalled();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('un hash roto se limpia y no abre nada', async () => {
    ubicar('mia-estudio.divianco.app', '/admin', `#${CLAVE_TRASPASO}=%7Bno-es-json`);
    expect(await tomarTraspaso()).toBe(false);
    expect(setSession).not.toHaveBeenCalled();
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('tokens vacios o de otro tipo no se aceptan', async () => {
    ubicar('x.divianco.app', '/admin', `#${CLAVE_TRASPASO}=${encodeURIComponent(JSON.stringify({ a: 1, r: '' }))}`);
    expect(await tomarTraspaso()).toBe(false);
    expect(setSession).not.toHaveBeenCalled();
  });

  it('si Supabase rechaza la sesion devuelve false', async () => {
    setSession.mockResolvedValue({ error: { message: 'invalid' } });
    ubicar('x.divianco.app', '/admin', hashCon('AT', 'RT'));
    expect(await tomarTraspaso()).toBe(false);
  });
});
