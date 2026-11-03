// La entrada unica (/entrar): una sola puerta para todos los negocios.
//
// Lo que importa que sea cierto:
//   - con un negocio, entra directo a SU admin;
//   - con varios, pregunta a cual y entra al elegido;
//   - un error de credenciales se ve y no navega;
//   - el staff va a la consola (otro subdominio, con la sesion);
//   - la pantalla es de Dico: no pide ni muestra la marca de ningun tenant.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const iniciarSesion = vi.fn();
const resolverDestino = vi.fn();
const irAlAdmin = vi.fn();
const irALaConsola = vi.fn();
const fetchTenantBrand = vi.fn();
const signOut = vi.fn();

vi.mock('../services/signup', () => ({
  iniciarSesion: (...a) => iniciarSesion(...a),
  pedirResetPassword: vi.fn(),
  cambiarPassword: vi.fn(),
}));
vi.mock('../services/entradaUnica', () => ({
  resolverDestino: (...a) => resolverDestino(...a),
  irAlAdmin: (...a) => irAlAdmin(...a),
  irALaConsola: (...a) => irALaConsola(...a),
}));
vi.mock('../services/platformSettings', () => ({ fetchTenantBrand: (...a) => fetchTenantBrand(...a) }));
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: (...a) => signOut(...a),
    },
  },
}));
vi.mock('../components/admin/FlowFieldBackground', () => ({ default: () => null }));

const Login = (await import('../pages/Login')).default;

function completar() {
  fireEvent.change(screen.getByPlaceholderText('vos@ejemplo.com'), { target: { value: 'dueno@local.test' } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/entrar');
  iniciarSesion.mockResolvedValue({ ok: true });
  irAlAdmin.mockResolvedValue({ ok: true });
  irALaConsola.mockResolvedValue({ ok: true });
  signOut.mockResolvedValue({});
});

describe('/entrar — a donde va', () => {
  it('con un solo negocio entra directo a su admin', async () => {
    resolverDestino.mockResolvedValue({ ok: true, tipo: 'negocio', negocio: { slug: 'la-nona', name: 'La Nona' } });
    render(<Login />);
    completar();
    await waitFor(() => expect(irAlAdmin).toHaveBeenCalledWith('la-nona'));
    expect(iniciarSesion).toHaveBeenCalledWith({ email: 'dueno@local.test', password: 'secreta' });
  });

  it('con varios muestra el selector y entra al que se elige', async () => {
    resolverDestino.mockResolvedValue({
      ok: true, tipo: 'elegir',
      negocios: [{ slug: 'la-nona', name: 'La Nona' }, { slug: 'monare', name: 'Monare' }],
    });
    render(<Login />);
    completar();

    expect(await screen.findByText('¿A cuál querés entrar?')).toBeInTheDocument();
    expect(screen.getByText('monare.divianco.app')).toBeInTheDocument();
    expect(irAlAdmin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Monare/ }));
    await waitFor(() => expect(irAlAdmin).toHaveBeenCalledWith('monare'));
  });

  it('si es staff, el selector suma la consola y la abre sin tocar el negocio', async () => {
    resolverDestino.mockResolvedValue({
      ok: true, tipo: 'elegir', consola: true,
      negocios: [{ slug: 'mia-estudio', name: 'MiaEstudio' }],
    });
    render(<Login />);
    completar();
    expect(await screen.findByRole('button', { name: /MiaEstudio/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Consola de Divianco/ }));
    await waitFor(() => expect(irALaConsola).toHaveBeenCalledTimes(1));
    expect(irAlAdmin).not.toHaveBeenCalled();
  });

  it('si el salto a la consola falla, el error se ve y vuelve al selector', async () => {
    resolverDestino.mockResolvedValue({
      ok: true, tipo: 'elegir', consola: true, negocios: [{ slug: 'a', name: 'A' }],
    });
    irALaConsola.mockResolvedValue({ ok: false, error: 'Se cerró tu sesión. Volvé a entrar.' });
    render(<Login />);
    completar();
    fireEvent.click(await screen.findByRole('button', { name: /Consola de Divianco/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Se cerró tu sesión');
    expect(screen.getByRole('button', { name: /Consola de Divianco/ })).toBeInTheDocument();
  });

  it('sin permiso de staff el selector no ofrece la consola', async () => {
    resolverDestino.mockResolvedValue({
      ok: true, tipo: 'elegir',
      negocios: [{ slug: 'a', name: 'A' }, { slug: 'b', name: 'B' }],
    });
    render(<Login />);
    completar();
    await screen.findByText('¿A cuál querés entrar?');
    expect(screen.queryByRole('button', { name: /Consola de Divianco/ })).toBeNull();
  });

  it('"Entrar con otra cuenta" cierra la sesion y vuelve al form', async () => {
    resolverDestino.mockResolvedValue({
      ok: true, tipo: 'elegir',
      negocios: [{ slug: 'a', name: 'A' }, { slug: 'b', name: 'B' }],
    });
    render(<Login />);
    completar();
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar con otra cuenta' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(await screen.findByPlaceholderText('vos@ejemplo.com')).toBeInTheDocument();
  });

  it('si el salto falla, el error se ve', async () => {
    resolverDestino.mockResolvedValue({ ok: true, tipo: 'negocio', negocio: { slug: 'a', name: 'A' } });
    irAlAdmin.mockResolvedValue({ ok: false, error: 'Se cerró tu sesión. Volvé a entrar.' });
    render(<Login />);
    completar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Se cerró tu sesión');
  });

  it('el staff sin negocios va directo a la consola', async () => {
    resolverDestino.mockResolvedValue({ ok: true, tipo: 'staff' });
    render(<Login />);
    completar();
    await waitFor(() => expect(irALaConsola).toHaveBeenCalledTimes(1));
    expect(irAlAdmin).not.toHaveBeenCalled();
  });
});

describe('/entrar — credenciales y marca', () => {
  it('un error de credenciales se muestra y no navega', async () => {
    iniciarSesion.mockResolvedValue({ ok: false, error: 'Email o contraseña incorrectos.' });
    render(<Login />);
    completar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
    expect(resolverDestino).not.toHaveBeenCalled();
    expect(irAlAdmin).not.toHaveBeenCalled();
  });

  it('la marca es Dico y no se consulta ninguna de tenant', () => {
    const { container } = render(<Login />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dico');
    expect(container.querySelector('[data-dico-native]')).toBeInTheDocument();
    expect(fetchTenantBrand).not.toHaveBeenCalled();
  });
});
