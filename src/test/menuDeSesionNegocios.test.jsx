// El selector de cuentas del menu de sesion: saltar entre negocios (y a la
// consola) sin pasar por /entrar.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MenuDeSesion } from '../components/admin/platform/ControlesDeSesion';

const negociosDelUsuario = vi.fn();
const irAlAdmin = vi.fn();
const irALaConsola = vi.fn();
const soyStaffDivianco = vi.fn();
const getTenantSlugSync = vi.fn();

vi.mock('../services/entradaUnica', () => ({
  negociosDelUsuario: (...a) => negociosDelUsuario(...a),
  irAlAdmin: (...a) => irAlAdmin(...a),
  irALaConsola: (...a) => irALaConsola(...a),
}));
vi.mock('../services/platformPlanes', () => ({ soyStaffDivianco: (...a) => soyStaffDivianco(...a) }));
vi.mock('../lib/activeTenant', () => ({ getTenantSlugSync: (...a) => getTenantSlugSync(...a) }));

const DOS = [{ slug: 'panaderia', name: 'La Panaderia' }, { slug: 'bar', name: 'El Bar' }];
const controles = [{ id: 'tema', label: 'Tema oscuro', Icono: () => null, onClick: vi.fn() }];
const session = { user: { email: 'ana@x.com', user_metadata: { full_name: 'Ana Perez' } } };

async function abrir() {
  render(<MenuDeSesion controles={controles} session={session} />);
  fireEvent.click(screen.getByRole('button', { name: /Cuenta de/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  negociosDelUsuario.mockResolvedValue({ ok: true, negocios: DOS });
  soyStaffDivianco.mockResolvedValue(false);
  getTenantSlugSync.mockReturnValue('panaderia');
  irAlAdmin.mockResolvedValue({ ok: true });
  irALaConsola.mockResolvedValue({ ok: true });
});

describe('MenuDeSesion: Tus negocios', () => {
  it('no consulta nada hasta abrir el desplegable', async () => {
    render(<MenuDeSesion controles={controles} session={session} />);
    expect(negociosDelUsuario).not.toHaveBeenCalled();
    expect(soyStaffDivianco).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Cuenta de/ }));
    await screen.findByText('El Bar');
    expect(negociosDelUsuario).toHaveBeenCalledTimes(1);
  });

  it('lista los negocios, marca el actual y salta al otro con su slug', async () => {
    await abrir();
    const actual = await screen.findByRole('menuitem', { name: /La Panaderia/ });
    expect(actual).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('bar.divianco.app')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /El Bar/ }));
    await waitFor(() => expect(irAlAdmin).toHaveBeenCalledWith('bar'));
  });

  it('el negocio actual no navega', async () => {
    await abrir();
    fireEvent.click(await screen.findByRole('menuitem', { name: /La Panaderia/ }));
    expect(irAlAdmin).not.toHaveBeenCalled();
    expect(irALaConsola).not.toHaveBeenCalled();
  });

  it('el staff ve la consola y va a ella; el que no es staff no la ve', async () => {
    soyStaffDivianco.mockResolvedValue(true);
    await abrir();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Consola de Divianco/ }));
    await waitFor(() => expect(irALaConsola).toHaveBeenCalledTimes(1));
  });

  it('sin staff no hay consola', async () => {
    await abrir();
    await screen.findByText('El Bar');
    expect(screen.queryByText('Consola de Divianco')).toBeNull();
  });

  it('un solo negocio y sin staff: no hay seccion', async () => {
    negociosDelUsuario.mockResolvedValue({ ok: true, negocios: [DOS[0]] });
    await abrir();
    await waitFor(() => expect(negociosDelUsuario).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Buscando tus negocios/)).toBeNull());
    expect(screen.queryByRole('group', { name: 'Tus negocios' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Tema oscuro/ })).toBeInTheDocument();
  });

  it('si la consulta falla, la seccion no aparece', async () => {
    negociosDelUsuario.mockResolvedValue({ ok: false, error: 'x' });
    await abrir();
    await waitFor(() => expect(screen.queryByText(/Buscando tus negocios/)).toBeNull());
    expect(screen.queryByRole('group', { name: 'Tus negocios' })).toBeNull();
  });

  it('un error del salto se ve en un alert y se puede reintentar', async () => {
    irAlAdmin.mockResolvedValue({ ok: false, error: 'No pudimos llevarte.' });
    await abrir();
    fireEvent.click(await screen.findByRole('menuitem', { name: /El Bar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos llevarte.');
    fireEvent.click(screen.getByRole('menuitem', { name: /El Bar/ }));
    await waitFor(() => expect(irAlAdmin).toHaveBeenCalledTimes(2));
  });

  it('mientras salta muestra Abriendo y no deja un segundo toque', async () => {
    irAlAdmin.mockReturnValue(new Promise(() => {}));
    await abrir();
    fireEvent.click(await screen.findByRole('menuitem', { name: /El Bar/ }));
    expect(await screen.findByText('Abriendo…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /El Bar/ }));
    expect(irAlAdmin).toHaveBeenCalledTimes(1);
  });

  it('las flechas recorren negocios y controles', async () => {
    await abrir();
    await screen.findByText('El Bar');
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining('La Panaderia'), expect.stringContaining('El Bar'), 'Tema oscuro',
    ]);
    items[0].focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[2]);
  });

  it('Escape cierra el desplegable', async () => {
    await abrir();
    await screen.findByText('El Bar');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
