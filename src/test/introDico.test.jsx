// El intro de Dico y la regla de cuando aparece.
//
// Lo que importa que sea cierto:
//   - el intro dura el logo MAS dos latidos enteros, y el aro cae sobre el arte;
//   - con prefers-reduced-motion se salta;
//   - si el admin todavia no esta listo, espera en vez de irse;
//   - se enciende tras un login de verdad (doLogin) y tras un traspaso exitoso;
//   - NUNCA con una sesion que ya estaba abierta, y se apaga si el traspaso falla.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, waitFor, screen } from '@testing-library/react';
import IntroDico from '../components/admin/IntroDico';
import { TIEMPOS } from '../components/admin/tiemposDeEntrada';

const getSession = vi.fn();
const tomarTraspaso = vi.fn();
let authCallback = null;

vi.mock('../services/auth', () => ({
  getSession: (...a) => getSession(...a),
  logout: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/entradaUnica', () => ({
  tomarTraspaso: (...a) => tomarTraspaso(...a),
  CLAVE_TRASPASO: 'dico-sesion',
}));
vi.mock('../services/platformAdmin', () => ({
  fetchMyTenant: vi.fn().mockResolvedValue({ tenant: null, role: null, roles: [], branchIds: [], reason: 'no-slug' }),
}));
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));
vi.mock('../lib/observability.js', () => ({ captureException: vi.fn() }));

const usePlatformTenant = (await import('../hooks/usePlatformTenant')).default;

const SESION = { user: { id: 'u1', email: 'dueno@local.test' } };

function stubReducedMotion(reduce) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  authCallback = null;
  window.history.replaceState(null, '', '/admin');
  stubReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  delete window.matchMedia;
});

describe('IntroDico — el gesto', () => {
  it('es el logo DICO con el aro Volt encendido sobre el aro del arte', () => {
    const { container } = render(<IntroDico onTerminar={() => {}} />);
    const logo = container.querySelector('img[alt="DICO"]');
    expect(logo.getAttribute('src')).toBe('/brand/dico/logo/dico-oscuro.png');
    // Dimensiones declaradas: sin ellas el splash salta cuando carga el PNG.
    expect(logo.getAttribute('width')).toBe('1368');
    expect(logo.getAttribute('height')).toBe('452');

    const aro = container.querySelector('.hg-splash-aro');
    expect(aro.getAttribute('data-dico-pulso')).toBe('active');
    // r/R medido sobre el PNG: 0,675. Si cambia el logo y no se vuelve a medir, esto no cierra.
    const r = Number(aro.querySelector('circle').getAttribute('r'));
    expect(r / 50).toBeGreaterThan(0.64);
    expect(r / 50).toBeLessThan(0.70);
    // Caja cuadrada: el SVG no declara preserveAspectRatio.
    expect(aro.parentElement.style.aspectRatio.replace(/\s/g, '')).toBe('1/1');
  });

  it('dura el logo MAS dos latidos enteros, y el latido espera al logo', () => {
    expect(TIEMPOS.latidos).toBeGreaterThanOrEqual(2);
    expect(TIEMPOS.intro).toBe(TIEMPOS.entrada + TIEMPOS.latido * TIEMPOS.latidos);
    const { container } = render(<IntroDico onTerminar={() => {}} />);
    const css = container.querySelector('style').textContent;
    expect(css).toContain(`animation-duration: ${TIEMPOS.latido}ms`);
    expect(css).toContain(`animation-delay: ${TIEMPOS.entrada}ms`);
    expect(css).toContain(`animation-iteration-count: ${TIEMPOS.latidos}`);
  });

  it('avisa que termino despues de TIEMPOS.intro y el fade', async () => {
    vi.useFakeTimers();
    const onTerminar = vi.fn();
    render(<IntroDico onTerminar={onTerminar} />);

    await act(async () => { vi.advanceTimersByTime(TIEMPOS.intro - 100); });
    expect(onTerminar).not.toHaveBeenCalled();

    // Primero se cumple el minimo; el fade arma su propio timer despues.
    await act(async () => { vi.advanceTimersByTime(200); });
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(onTerminar).toHaveBeenCalledTimes(1);
  });

  it('si el admin no esta listo, espera (con el aro latiendo) y recien despues se va', async () => {
    vi.useFakeTimers();
    const onTerminar = vi.fn();
    const { rerender, container } = render(<IntroDico onTerminar={onTerminar} listo={false} />);

    await act(async () => { vi.advanceTimersByTime(TIEMPOS.intro + 5000); });
    expect(onTerminar).not.toHaveBeenCalled();
    expect(container.querySelector('[data-intro-dico]')).toBeInTheDocument();

    rerender(<IntroDico onTerminar={onTerminar} listo />);
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(onTerminar).toHaveBeenCalledTimes(1);
  });

  it('con prefers-reduced-motion se salta: avisa de inmediato y no pinta nada', () => {
    stubReducedMotion(true);
    const onTerminar = vi.fn();
    const { container } = render(<IntroDico onTerminar={onTerminar} />);
    expect(onTerminar).toHaveBeenCalledTimes(1);
    expect(container.querySelector('img[alt="DICO"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-intro-dico]')).not.toBeInTheDocument();
  });
});

describe('usePlatformTenant — cuando se enciende el intro', () => {
  it('una sesion que ya estaba abierta NO lo enciende', async () => {
    tomarTraspaso.mockResolvedValue(false);
    getSession.mockResolvedValue(SESION);
    const { result } = renderHook(() => usePlatformTenant());
    expect(result.current.intro).toBe(false);

    await waitFor(() => expect(result.current.session).toBe(SESION));
    // El evento INITIAL_SESSION de Supabase tampoco.
    act(() => { authCallback('INITIAL_SESSION', SESION); });
    expect(result.current.intro).toBe(false);
  });

  it('sin sesion (login) no hay intro; tras doLogin se enciende', async () => {
    tomarTraspaso.mockResolvedValue(false);
    getSession.mockResolvedValue(null);
    const { result } = renderHook(() => usePlatformTenant());
    await waitFor(() => expect(result.current.status).toBe('anon'));
    expect(result.current.intro).toBe(false);

    getSession.mockResolvedValue(SESION);
    await act(async () => { await result.current.doLogin(); });
    expect(result.current.intro).toBe(true);

    act(() => { result.current.terminarIntro(); });
    expect(result.current.intro).toBe(false);
  });

  it('el traspaso exitoso lo enciende desde el primer render (sin parpadeo)', async () => {
    window.history.replaceState(null, '', '/admin#dico-sesion=%7B%7D');
    tomarTraspaso.mockResolvedValue(true);
    getSession.mockResolvedValue(SESION);
    const { result } = renderHook(() => usePlatformTenant());
    expect(result.current.intro).toBe(true);
    expect(result.current.status).toBe('checking');

    await waitFor(() => expect(result.current.session).toBe(SESION));
    expect(result.current.intro).toBe(true);
  });

  it('si el traspaso falla (token invalido) se apaga', async () => {
    window.history.replaceState(null, '', '/admin#dico-sesion=basura');
    tomarTraspaso.mockResolvedValue(false);
    getSession.mockResolvedValue(null);
    const { result } = renderHook(() => usePlatformTenant());
    expect(result.current.intro).toBe(true);

    await waitFor(() => expect(result.current.status).toBe('anon'));
    expect(result.current.intro).toBe(false);
  });
});

// REGRESION (auditor, P1): cada estado del panel armaba su propio arbol y React
// desmontaba el overlay al pasar de "Cargando..." al panel: el intro arrancaba
// de nuevo. ConIntro es la raiz comun; el nodo del overlay tiene que ser el MISMO.
describe('ConIntro — el overlay sobrevive al cambio de estado', () => {
  it('es el mismo nodo al pasar de checking a ok', async () => {
    const { ConIntro } = await import('../components/admin/IntroDico');
    const props = { intro: true, onTerminar: () => {} };
    const { container, rerender } = render(
      <ConIntro {...props} status="checking"><p>Cargando...</p></ConIntro>,
    );
    const antes = container.querySelector('[data-intro-dico]');
    expect(antes).not.toBeNull();

    rerender(<ConIntro {...props} status="ok"><section>Panel</section></ConIntro>);
    expect(container.querySelector('[data-intro-dico]')).toBe(antes);
    expect(screen.getByText('Panel')).toBeInTheDocument();
  });

  it('en anon no hay overlay', async () => {
    const { ConIntro } = await import('../components/admin/IntroDico');
    const { container } = render(<ConIntro intro status="anon" onTerminar={() => {}}><p>Login</p></ConIntro>);
    expect(container.querySelector('[data-intro-dico]')).toBeNull();
  });
});
