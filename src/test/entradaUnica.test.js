// @vitest-environment jsdom
// Un solo login para todos los negocios: a donde manda a cada persona y como
// viaja la sesion hasta el subdominio.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const tenantsQuery = vi.fn();
const miembrosQuery = vi.fn();
const miembrosEq = vi.fn();
const tenantsIn = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn();
const stopAutoRefresh = vi.fn();
const setSession = vi.fn();
const destinoTrasLogin = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (tabla) => (tabla === 'tenant_members'
      ? { select: () => ({ eq: (...a) => { miembrosEq(...a); return miembrosQuery(); } }) }
      : { select: () => ({ in: (...a) => { tenantsIn(...a); return { order: () => tenantsQuery() }; } }) }),
    auth: {
      getSession: (...a) => getSession(...a),
      signOut: (...a) => signOut(...a),
      stopAutoRefresh: (...a) => stopAutoRefresh(...a),
      setSession: (...a) => setSession(...a),
    },
  },
}));
vi.mock('../services/signup', () => ({ destinoTrasLogin: (...a) => destinoTrasLogin(...a) }));
const soyStaffDivianco = vi.fn();
vi.mock('../services/platformPlanes', () => ({ soyStaffDivianco: (...a) => soyStaffDivianco(...a) }));

const {
  resolverDestino, negociosDelUsuario, armarUrlAdmin, irAlAdmin, tomarTraspaso, slugValido, CLAVE_TRASPASO,
  armarUrlConsola, irALaConsola, urlDeEntrar,
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
  getSession.mockResolvedValue({ data: { session: { access_token: 'AT', refresh_token: 'RT', user: { id: 'u1' } } } });
  signOut.mockResolvedValue({ error: null });
  miembrosQuery.mockResolvedValue({ data: [{ tenant_id: 't1' }], error: null });
  stopAutoRefresh.mockResolvedValue(undefined);
  window.localStorage.clear();
  setSession.mockResolvedValue({ error: null });
  soyStaffDivianco.mockResolvedValue(false);
});

describe('negociosDelUsuario — solo los propios', () => {
  it('filtra por la membresia del usuario y trae solo esos negocios (aunque la policy deje ver todos)', async () => {
    miembrosQuery.mockResolvedValue({ data: [{ tenant_id: 'tA' }, { tenant_id: 'tB' }, { tenant_id: 'tA' }], error: null });
    tenantsQuery.mockResolvedValue({ data: [{ slug: 'a', name: 'A' }, { slug: 'b', name: 'B' }], error: null });
    const r = await negociosDelUsuario();
    expect(miembrosEq).toHaveBeenCalledWith('user_id', 'u1');
    expect(tenantsIn).toHaveBeenCalledWith('id', ['tA', 'tB']);
    expect(r.negocios).toHaveLength(2);
  });

  it('un staff SIN membresias no es dueño de todo el edificio: lista vacia y ni consulta tenants', async () => {
    miembrosQuery.mockResolvedValue({ data: [], error: null });
    const r = await negociosDelUsuario();
    expect(r).toEqual({ ok: true, negocios: [] });
    expect(tenantsIn).not.toHaveBeenCalled();
  });

  it('sin sesion no consulta nada', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect((await negociosDelUsuario()).ok).toBe(false);
    expect(miembrosEq).not.toHaveBeenCalled();
  });

  it('si falla la lectura de membresias, no adivina', async () => {
    miembrosQuery.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await negociosDelUsuario()).ok).toBe(false);
  });
});

describe('resolverDestino', () => {
  it('staff con UN negocio: elige entre el negocio y la consola (no lo manda directo)', async () => {
    soyStaffDivianco.mockResolvedValue(true);
    tenantsQuery.mockResolvedValue({ data: [{ slug: 'mia-estudio', name: 'MiaEstudio' }], error: null });
    const r = await resolverDestino();
    expect(r.tipo).toBe('elegir');
    expect(r.negocios).toEqual([{ slug: 'mia-estudio', name: 'MiaEstudio' }]);
    expect(r.consola).toBe(true);
  });

  it('staff con varios negocios: los negocios y ademas la consola', async () => {
    soyStaffDivianco.mockResolvedValue(true);
    tenantsQuery.mockResolvedValue({ data: [{ slug: 'a', name: 'A' }, { slug: 'b', name: 'B' }], error: null });
    const r = await resolverDestino();
    expect(r.tipo).toBe('elegir');
    expect(r.negocios).toHaveLength(2);
    expect(r.consola).toBeTruthy();
  });

  it('quien NO es staff nunca ve la consola', async () => {
    tenantsQuery.mockResolvedValue({ data: [{ slug: 'a', name: 'A' }, { slug: 'b', name: 'B' }], error: null });
    const r = await resolverDestino();
    expect(r.tipo).toBe('elegir');
    expect(r.consola).toBeUndefined();
  });

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
    expect(await resolverDestino()).toEqual({ ok: true, tipo: 'staff' });
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

  // REGRESION (3/nov/2026): signOut() —incluso con scope 'local'— hace POST
  // /logout y revoca la sesion en el servidor. La que viaja en el hash llegaba
  // muerta y todos volvian a /entrar. Lo que cuenta es que NUNCA se llame.
  it('al salir NUNCA revoca la sesion que viaja: no llama a signOut', async () => {
    window.localStorage.setItem('hermes-auth', '{"access_token":"AT"}');
    window.localStorage.setItem('hermes-auth-code-verifier', 'x');
    window.localStorage.setItem('otra-cosa', 'queda');
    await irAlAdmin('mia-estudio');
    expect(signOut).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('hermes-auth')).toBeNull();
    expect(window.localStorage.getItem('hermes-auth-code-verifier')).toBeNull();
    expect(window.localStorage.getItem('otra-cosa')).toBe('queda');
  });

  it('frena el auto-refresh y borra la sesion local ANTES de navegar', async () => {
    window.localStorage.setItem('hermes-auth', '{"access_token":"AT"}');
    let enNavegar = 'no se llamo';
    window.location.assign = vi.fn(() => { enNavegar = window.localStorage.getItem('hermes-auth'); });
    await irAlAdmin('mia-estudio');
    expect(stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(stopAutoRefresh.mock.invocationCallOrder[0]).toBeLessThan(window.location.assign.mock.invocationCallOrder[0]);
    expect(enNavegar).toBeNull();
  });

  it('en local no toca la sesion: es la misma', async () => {
    ubicar('localhost');
    window.localStorage.setItem('hermes-auth', '{"access_token":"AT"}');
    await irAlAdmin('mia-estudio');
    expect(signOut).not.toHaveBeenCalled();
    expect(stopAutoRefresh).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('hermes-auth')).not.toBeNull();
    expect(window.location.assign).toHaveBeenCalledWith('https://localhost/admin');
  });
});

describe('cambiar de negocio desde otro negocio', () => {
  it('desde el subdominio de un negocio a otro: cruza de origen con la sesion en el hash', async () => {
    ubicar('mia-estudio.divianco.app', '/admin');
    const r = await armarUrlAdmin('monare');
    expect(r.traspasa).toBe(true);
    expect(r.url.startsWith('https://monare.divianco.app/admin#')).toBe(true);
  });

  it('al cambiar olvida la sesion LOCAL de este negocio y NO la revoca', async () => {
    ubicar('mia-estudio.divianco.app', '/admin');
    window.localStorage.setItem('hermes-auth', '{"access_token":"AT"}');
    await irAlAdmin('monare');
    expect(signOut).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('hermes-auth')).toBeNull();
    expect(window.location.assign).toHaveBeenCalledTimes(1);
  });

  it('desde un negocio tambien se llega a la consola', async () => {
    ubicar('mia-estudio.divianco.app', '/admin');
    const r = await armarUrlConsola();
    expect(r.traspasa).toBe(true);
    expect(r.url.startsWith('https://consola.divianco.app/#')).toBe(true);
  });

  it('desde la consola se va al admin de un negocio', async () => {
    ubicar('consola.divianco.app', '/');
    const r = await armarUrlAdmin('monare');
    expect(r.traspasa).toBe(true);
    expect(r.url.startsWith('https://monare.divianco.app/admin#')).toBe(true);
  });

  it('en un preview *.vercel.app sigue sin cruzar: mismo origen', async () => {
    ubicar('hermes-platform-xyz.vercel.app', '/admin');
    expect(await armarUrlAdmin('monare')).toEqual({
      ok: true, traspasa: false, url: 'https://hermes-platform-xyz.vercel.app/admin',
    });
  });
});

describe('la consola (consola.divianco.app)', () => {
  it('desde la raiz cruza a consola.divianco.app, en la raiz, con la sesion en el hash', async () => {
    const r = await armarUrlConsola();
    expect(r.traspasa).toBe(true);
    expect(r.url.startsWith('https://consola.divianco.app/#')).toBe(true);
    const carga = JSON.parse(decodeURIComponent(r.url.split(`#${CLAVE_TRASPASO}=`)[1]));
    expect(carga).toEqual({ a: 'AT', r: 'RT' });
  });

  it('en local o preview la consola es /consola en el mismo origen, sin tokens en la URL', async () => {
    ubicar('localhost');
    expect(await armarUrlConsola()).toEqual({ ok: true, traspasa: false, url: 'https://localhost/consola' });
  });

  it('irALaConsola tampoco revoca la sesion: olvida la local y navega', async () => {
    window.localStorage.setItem('hermes-auth', '{"access_token":"AT"}');
    await irALaConsola();
    expect(signOut).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('hermes-auth')).toBeNull();
    expect(window.location.assign).toHaveBeenCalledTimes(1);
  });

  it('sin sesion no navega', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect((await irALaConsola()).ok).toBe(false);
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('desde la consola, "entrar" es el login unico de la raiz', () => {
    ubicar('consola.divianco.app', '/');
    expect(urlDeEntrar()).toBe('https://divianco.app/entrar');
  });

  it('en local, "entrar" es /entrar del mismo origen', () => {
    ubicar('localhost', '/consola');
    expect(urlDeEntrar()).toBe('https://localhost/entrar');
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
