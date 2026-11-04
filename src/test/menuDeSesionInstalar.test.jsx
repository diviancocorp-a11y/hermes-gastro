// "Instalar app" en el menu de la cuenta: con el aviso de Chrome/Edge va
// directo al dialogo del sistema; sin el, abre los pasos a mano para la
// plataforma detectada. Si el panel ya corre como app, no se ofrece.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MenuDeSesion } from '../components/admin/platform/ControlesDeSesion';

const estadoDeInstalacion = vi.fn();
const pedirInstalacion = vi.fn();

vi.mock('../lib/instalarApp', () => ({
  estadoDeInstalacion: (...a) => estadoDeInstalacion(...a),
  pedirInstalacion: (...a) => pedirInstalacion(...a),
  suscribirInstalacion: () => () => {},
}));
vi.mock('../services/entradaUnica', () => ({
  negociosDelUsuario: () => Promise.resolve({ ok: true, negocios: [] }),
  irAlAdmin: vi.fn(),
  irALaConsola: vi.fn(),
}));
vi.mock('../services/platformPlanes', () => ({ soyStaffDivianco: () => Promise.resolve(false) }));
vi.mock('../lib/activeTenant', () => ({ getTenantSlugSync: () => 'panaderia' }));

const controles = [
  { id: 'tema', label: 'Tema oscuro', Icono: () => null, onClick: vi.fn() },
  { id: 'salir', label: 'Salir', Icono: () => null, onClick: vi.fn() },
];
const session = { user: { email: 'ana@x.com', user_metadata: { full_name: 'Ana Perez' } } };
const estado = (e) => estadoDeInstalacion.mockReturnValue({
  instalada: false, puedePedir: false, plataforma: 'escritorio', ...e,
});

function abrirCuenta() {
  render(<MenuDeSesion controles={controles} session={session} nombreNegocio="La Panaderia" />);
  const cuenta = screen.getByRole('button', { name: 'Cuenta de Ana Perez' });
  fireEvent.click(cuenta);
  return cuenta;
}

beforeEach(() => {
  vi.clearAllMocks();
  pedirInstalacion.mockResolvedValue('accepted');
  estado({});
});

describe('MenuDeSesion: Instalar app', () => {
  it('aparece en la cuenta debajo de Ver catalogo y antes de Salir', () => {
    abrirCuenta();
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    const catalogo = items.findIndex((t) => /Ver cat/.test(t));
    expect(items[catalogo + 1]).toBe('Instalar app');
    expect(items[catalogo + 2]).toBe('Salir');
  });

  it('no aparece si el panel ya corre como app', () => {
    estado({ instalada: true });
    abrirCuenta();
    expect(screen.queryByRole('menuitem', { name: 'Instalar app' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Salir' })).toBeInTheDocument();
  });

  it('con el aviso del navegador pide la instalacion y no abre la guia', () => {
    estado({ puedePedir: true });
    abrirCuenta();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Instalar app' }));
    expect(pedirInstalacion).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sin el aviso abre los pasos de la plataforma y Escape devuelve el foco', () => {
    estado({ plataforma: 'ios' });
    const cuenta = abrirCuenta();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Instalar app' }));
    expect(pedirInstalacion).not.toHaveBeenCalled();

    const dialogo = screen.getByRole('dialog', { name: 'Instalar el panel de La Panaderia' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo.contains(document.activeElement)).toBe(true);
    expect(within(dialogo).getByRole('button', { name: 'iPhone' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialogo).getByText(/Agregar a inicio/)).toBeInTheDocument();

    // Las otras plataformas quedan a un toque.
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Android' }));
    expect(within(dialogo).getByText(/Agregar a la pantalla principal/)).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(cuenta);
  });

  it('el boton Cerrar tambien cierra y devuelve el foco', () => {
    const cuenta = abrirCuenta();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Instalar app' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Compu' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(cuenta);
  });
});
