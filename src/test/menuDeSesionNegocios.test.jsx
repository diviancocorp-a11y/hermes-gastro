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
const PERFIL = { name: /Cuenta de/ };

function montar() {
  render(<MenuDeSesion controles={controles} session={session} />);
  return screen.getByRole('button', PERFIL);
}
function abrir() {
  const perfil = montar();
  fireEvent.click(perfil);
  return perfil;
}
const pendiente = () => {
  let resolver;
  const p = new Promise((r) => { resolver = r; });
  return [p, resolver];
};

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
    const perfil = montar();
    expect(negociosDelUsuario).not.toHaveBeenCalled();
    expect(soyStaffDivianco).not.toHaveBeenCalled();
    fireEvent.click(perfil);
    await screen.findByText('El Bar');
    expect(negociosDelUsuario).toHaveBeenCalledTimes(1);
  });

  it('precarga con hover y con foco, sin duplicar consultas', async () => {
    const perfil = montar();
    fireEvent.pointerEnter(perfil);
    fireEvent.focus(perfil);
    fireEvent.click(perfil);
    await screen.findByText('El Bar');
    expect(negociosDelUsuario).toHaveBeenCalledTimes(1);
    expect(soyStaffDivianco).toHaveBeenCalledTimes(1);
  });

  it('lista los negocios como radios, marca el actual y salta al otro con su slug', async () => {
    abrir();
    const actual = await screen.findByRole('menuitemradio', { name: /La Panaderia/ });
    expect(actual).toHaveAttribute('aria-checked', 'true');
    const otro = screen.getByRole('menuitemradio', { name: /El Bar/ });
    expect(otro).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('bar.divianco.app')).toBeInTheDocument();
    fireEvent.click(otro);
    await waitFor(() => expect(irAlAdmin).toHaveBeenCalledWith('bar'));
  });

  it('el negocio actual no navega', async () => {
    abrir();
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /La Panaderia/ }));
    expect(irAlAdmin).not.toHaveBeenCalled();
    expect(irALaConsola).not.toHaveBeenCalled();
  });

  it('el staff ve la consola y va a ella; el que no es staff no la ve', async () => {
    soyStaffDivianco.mockResolvedValue(true);
    abrir();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Consola de Divianco/ }));
    await waitFor(() => expect(irALaConsola).toHaveBeenCalledTimes(1));
  });

  it('sin staff no hay consola', async () => {
    abrir();
    await screen.findByText('El Bar');
    expect(screen.queryByText('Consola de Divianco')).toBeNull();
  });

  it('un solo negocio y sin staff: no hay seccion', async () => {
    negociosDelUsuario.mockResolvedValue({ ok: true, negocios: [DOS[0]] });
    abrir();
    await waitFor(() => expect(negociosDelUsuario).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(''));
    expect(screen.queryByRole('group', { name: 'Tus negocios' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Tema oscuro/ })).toBeInTheDocument();
  });

  it('las regiones live estan montadas, fuera del menu, y se llenan de texto', async () => {
    const [p, resolver] = pendiente();
    negociosDelUsuario.mockReturnValue(p);
    abrir();
    const menu = screen.getByRole('menu');
    const estado = screen.getByRole('status');
    const aviso = screen.getByRole('alert');
    expect(menu.contains(estado)).toBe(false);
    expect(menu.contains(aviso)).toBe(false);
    expect(estado).toHaveAttribute('aria-live', 'polite');
    expect(estado).toHaveTextContent('Buscando tus negocios…');
    resolver({ ok: true, negocios: DOS });
    await screen.findByText('El Bar');
    expect(screen.getByRole('status')).toBe(estado);
    expect(estado).toHaveTextContent('');
    expect(menu.querySelector('[role="status"], [role="alert"]')).toBeNull();
  });

  it('un error del salto se ve en el alert (fuera del menu) y se puede reintentar', async () => {
    irAlAdmin.mockResolvedValue({ ok: false, error: 'No pudimos llevarte.' });
    abrir();
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /El Bar/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No pudimos llevarte.'));
    expect(screen.getByRole('menu').contains(screen.getByRole('alert'))).toBe(false);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /El Bar/ }));
    await waitFor(() => expect(irAlAdmin).toHaveBeenCalledTimes(2));
  });

  it('mientras salta dice Abriendo y no deja un segundo toque', async () => {
    irAlAdmin.mockReturnValue(new Promise(() => {}));
    abrir();
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /El Bar/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Abriendo…'));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /El Bar/ }));
    expect(irAlAdmin).toHaveBeenCalledTimes(1);
  });

  it('las flechas recorren negocios y controles', async () => {
    abrir();
    await screen.findByText('El Bar');
    const menu = screen.getByRole('menu');
    const items = Array.from(menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"]'));
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
    abrir();
    await screen.findByText('El Bar');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('si las cuentas llegan tarde y nadie navego, el foco va al primer negocio', async () => {
    const [p, resolver] = pendiente();
    negociosDelUsuario.mockReturnValue(p);
    abrir();
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Tema oscuro/ }));
    resolver({ ok: true, negocios: DOS });
    const primero = await screen.findByRole('menuitemradio', { name: /La Panaderia/ });
    await waitFor(() => expect(document.activeElement).toBe(primero));
  });

  it('si ya navego, el foco no se le mueve cuando llegan las cuentas', async () => {
    const [p, resolver] = pendiente();
    negociosDelUsuario.mockReturnValue(p);
    abrir();
    const tema = screen.getByRole('menuitem', { name: /Tema oscuro/ });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' });
    resolver({ ok: true, negocios: DOS });
    await screen.findByRole('menuitemradio', { name: /La Panaderia/ });
    expect(document.activeElement).toBe(tema);
  });

  it('si la consulta falla, ofrece Reintentar y vuelve a consultar', async () => {
    negociosDelUsuario.mockResolvedValueOnce({ ok: false, error: 'x' });
    abrir();
    const fila = await screen.findByRole('menuitem', { name: /No pudimos traer tus negocios/ });
    expect(fila).toHaveTextContent('Reintentar');
    fireEvent.click(fila);
    await screen.findByRole('menuitemradio', { name: /El Bar/ });
    expect(negociosDelUsuario).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/No pudimos traer tus negocios/)).toBeNull();
  });
});
