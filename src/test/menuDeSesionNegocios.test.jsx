// El menu de sesion son dos botones: la burbuja (logo o iniciales) abre los
// negocios para saltar de uno a otro (y a la consola) sin pasar por /entrar;
// el nombre abre la cuenta (tema, ver catalogo, salir).
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
const controles = [
  { id: 'config', label: 'Configuración', Icono: () => null, onClick: vi.fn() },
  { id: 'tema', label: 'Tema oscuro', Icono: () => null, onClick: vi.fn() },
  { id: 'salir', label: 'Salir', Icono: () => null, onClick: vi.fn() },
];
const session = { user: { email: 'ana@x.com', user_metadata: { full_name: 'Ana Perez' } } };
const BURBUJA = { name: 'Cambiar de negocio' };
const CUENTA = { name: 'Cuenta de Ana Perez' };

function montar(props = {}) {
  render(<MenuDeSesion controles={controles} session={session} {...props} />);
  return screen.getByRole('button', BURBUJA);
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

  it('un solo negocio y sin staff: igual abre y muestra el actual tildado', async () => {
    negociosDelUsuario.mockResolvedValue({ ok: true, negocios: [DOS[0]] });
    abrir();
    const actual = await screen.findByRole('menuitemradio', { name: /La Panaderia/ });
    expect(actual).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menu', { name: 'Tus negocios' })).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(actual));
  });

  it('mientras carga, el menu va con aria-busy y lo pierde al llegar los negocios', async () => {
    const [p, resolver] = pendiente();
    negociosDelUsuario.mockReturnValue(p);
    abrir();
    expect(screen.getByRole('menu', { name: 'Tus negocios' })).toHaveAttribute('aria-busy', 'true');
    resolver({ ok: true, negocios: DOS });
    await screen.findByText('El Bar');
    expect(screen.getByRole('menu', { name: 'Tus negocios' })).not.toHaveAttribute('aria-busy');
  });

  it('sin negocios ni consola no monta el menu y lo dice el status', async () => {
    negociosDelUsuario.mockResolvedValue({ ok: true, negocios: [] });
    const burbuja = abrir();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No encontramos negocios asociados a tu cuenta.'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(burbuja).not.toHaveAttribute('aria-controls');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.activeElement).toBe(burbuja);
  });

  it('la burbuja abre solo negocios, sin los controles de la cuenta', async () => {
    abrir();
    await screen.findByText('El Bar');
    expect(screen.queryByRole('menuitem', { name: /Tema oscuro/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Salir/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Ver catálogo/ })).toBeNull();
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

  it('las flechas recorren los negocios y la consola', async () => {
    soyStaffDivianco.mockResolvedValue(true);
    abrir();
    await screen.findByText('El Bar');
    const menu = screen.getByRole('menu');
    const items = Array.from(menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"]'));
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining('La Panaderia'), expect.stringContaining('El Bar'),
      expect.stringContaining('Consola de Divianco'),
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

  it('Escape cierra el desplegable y devuelve el foco a la burbuja', async () => {
    const burbuja = abrir();
    await screen.findByText('El Bar');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(burbuja);
  });

  it('el clic afuera cierra', async () => {
    abrir();
    await screen.findByText('El Bar');
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('si las cuentas llegan tarde y nadie navego, el foco va al primer negocio', async () => {
    const [p, resolver] = pendiente();
    negociosDelUsuario.mockReturnValue(p);
    abrir();
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    resolver({ ok: true, negocios: DOS });
    const primero = await screen.findByRole('menuitemradio', { name: /La Panaderia/ });
    await waitFor(() => expect(document.activeElement).toBe(primero));
  });

  it('si ya navego, el foco no se le mueve cuando llegan las cuentas', async () => {
    const [p, resolver] = pendiente();
    negociosDelUsuario.mockReturnValue(p);
    const burbuja = abrir();
    burbuja.focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' });
    resolver({ ok: true, negocios: DOS });
    await screen.findByRole('menuitemradio', { name: /La Panaderia/ });
    expect(document.activeElement).toBe(burbuja);
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

describe('MenuDeSesion: la burbuja', () => {
  it('muestra el logo del negocio en lugar de las iniciales', () => {
    montar({ logoUrl: 'https://cdn.test/logo.png' });
    const burbuja = screen.getByRole('button', BURBUJA);
    const img = burbuja.querySelector('img');
    expect(img.getAttribute('src')).toBe('https://cdn.test/logo.png');
    expect(img.getAttribute('alt')).toBe('');
    expect(burbuja).not.toHaveTextContent('AP');
  });

  it('sin logo, o si no carga, muestra las iniciales', () => {
    montar({ logoUrl: 'https://cdn.test/roto.png' });
    const burbuja = screen.getByRole('button', BURBUJA);
    fireEvent.error(burbuja.querySelector('img'));
    expect(burbuja.querySelector('img')).toBeNull();
    expect(burbuja).toHaveTextContent('AP');
  });

  it('tiene popup de menu y expanded', () => {
    const burbuja = abrir();
    expect(burbuja).toHaveAttribute('aria-haspopup', 'menu');
    expect(burbuja).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('MenuDeSesion: el nombre abre la cuenta', () => {
  function abrirCuenta() {
    montar();
    const cuenta = screen.getByRole('button', CUENTA);
    fireEvent.click(cuenta);
    return cuenta;
  }

  it('lleva nombre y email arriba y los controles con Ver catálogo debajo del tema', () => {
    const cuenta = abrirCuenta();
    expect(cuenta).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('ana@x.com')).toBeInTheDocument();
    const menu = screen.getByRole('menu', { name: 'Mi cuenta' });
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    expect(items.map((i) => i.textContent)).toEqual(['Configuración', 'Tema oscuro', 'Ver catálogo', 'Salir']);
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(negociosDelUsuario).not.toHaveBeenCalled();
  });

  it('Ver catálogo abre la raiz en otra pestaña y lo avisa', () => {
    abrirCuenta();
    const link = screen.getByRole('menuitem', { name: 'Ver catálogo (se abre en otra pestaña)' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('un control cierra el menu, devuelve el foco y corre su accion', () => {
    const cuenta = abrirCuenta();
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Configuración' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tema oscuro' }));
    expect(controles[1].onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(cuenta);
  });

  it('las flechas recorren los controles', () => {
    abrirCuenta();
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveTextContent('Tema oscuro');
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toHaveTextContent('Salir');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveTextContent('Configuración');
  });

  it('abrir uno cierra el otro', async () => {
    const burbuja = montar();
    const cuenta = screen.getByRole('button', CUENTA);
    fireEvent.click(cuenta);
    expect(screen.getByRole('menu', { name: 'Mi cuenta' })).toBeInTheDocument();
    fireEvent.pointerDown(burbuja);
    fireEvent.click(burbuja);
    expect(screen.queryByRole('menu', { name: 'Mi cuenta' })).toBeNull();
    expect(screen.getByRole('menu', { name: 'Tus negocios' })).toBeInTheDocument();
    expect(cuenta).toHaveAttribute('aria-expanded', 'false');
    await screen.findByText('El Bar');
    fireEvent.click(cuenta);
    expect(screen.queryByRole('menu', { name: 'Tus negocios' })).toBeNull();
    expect(screen.getByRole('menu', { name: 'Mi cuenta' })).toBeInTheDocument();
  });

  it('Escape cierra y devuelve el foco al nombre', () => {
    const cuenta = abrirCuenta();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(cuenta);
  });
});
