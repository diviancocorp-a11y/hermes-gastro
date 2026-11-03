// La puerta de la consola (consola.divianco.app).
//
// La consola ya no tiene login propio: se entra por /entrar, que traspasa la
// sesion en el hash. Lo que importa que sea cierto:
//   - el traspaso se toma ANTES de preguntar si la persona es staff, o se veria
//     un instante "sin sesion" y se la mandaria a /entrar de vuelta;
//   - sin sesion se va a /entrar (no se muestra un formulario propio);
//   - con sesion pero sin permiso se avisa, y se puede cambiar de cuenta.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const soyStaffDivianco = vi.fn();
const salirDeConsola = vi.fn();
const tomarTraspaso = vi.fn();
const getSession = vi.fn();

vi.mock('../services/platformPlanes', () => ({
  fetchPlanes: vi.fn(async () => []), guardarPlan: vi.fn(), fetchNegocios: vi.fn(async () => []),
  actualizarSuscripcion: vi.fn(), fetchStaff: vi.fn(async () => []), sumarStaff: vi.fn(),
  quitarStaff: vi.fn(), soyDuenioDivianco: vi.fn(async () => false),
  fijarPasswordConsola: vi.fn(), resetearClaveDeStaff: vi.fn(),
  soyStaffDivianco: (...a) => soyStaffDivianco(...a),
  salirDeConsola: (...a) => salirDeConsola(...a),
}));
vi.mock('../services/entradaUnica', () => ({
  tomarTraspaso: (...a) => tomarTraspaso(...a),
  urlDeEntrar: () => 'https://divianco.app/entrar',
}));
vi.mock('../services/platformStaff', () => ({ fetchMiLegajo: vi.fn(async () => null), cambiarPuesto: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a) => getSession(...a),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('../components/admin/platform/LegajoDeStaff', () => ({ default: () => null }));
vi.mock('../components/admin/platform/FichaDeStaff', () => ({ default: () => null }));
vi.mock('../components/admin/platform/PanelDeHoy', () => ({ default: () => null }));

const Consola = (await import('../pages/Consola')).default;

const replace = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { hostname: 'consola.divianco.app', origin: 'https://consola.divianco.app', pathname: '/', search: '', hash: '', replace },
  });
  tomarTraspaso.mockResolvedValue(false);
  salirDeConsola.mockResolvedValue(undefined);
  soyStaffDivianco.mockResolvedValue(false);
  getSession.mockResolvedValue({ data: { session: null } });
});

describe('consola — la puerta', () => {
  it('sin sesion manda al login unico, sin formulario propio', async () => {
    render(<Consola />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('https://divianco.app/entrar'));
    expect(screen.queryByPlaceholderText('vos@divianco.com')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull();
  });

  it('con sesion pero sin permiso avisa y no redirige', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    render(<Consola />);
    expect(await screen.findByRole('alert')).toHaveTextContent('no tiene acceso a la consola');
    expect(replace).not.toHaveBeenCalled();
  });

  it('"Entrar con otra cuenta" cierra la sesion y lleva a /entrar', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    render(<Consola />);
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar con otra cuenta' }));
    await waitFor(() => expect(salirDeConsola).toHaveBeenCalled());
    await waitFor(() => expect(replace).toHaveBeenCalledWith('https://divianco.app/entrar'));
  });

  it('el traspaso de sesion se toma antes de preguntar si es staff', async () => {
    render(<Consola />);
    await waitFor(() => expect(soyStaffDivianco).toHaveBeenCalled());
    expect(tomarTraspaso).toHaveBeenCalled();
    expect(tomarTraspaso.mock.invocationCallOrder[0]).toBeLessThan(soyStaffDivianco.mock.invocationCallOrder[0]);
  });

  it('la consola nunca se indexa', async () => {
    render(<Consola />);
    await waitFor(() => expect(document.head.querySelector('meta[name="robots"]')).not.toBeNull());
    expect(document.head.querySelector('meta[name="robots"]').content).toContain('noindex');
  });
});
