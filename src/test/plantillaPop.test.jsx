import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PlantillaPop from '../catalog-pro/plantillas/PlantillaPop';

const mocks = vi.hoisted(() => ({ tasa: { v: null } }));

vi.mock('../hooks/useTasaCatalogo', () => ({
  default: () => ({ activa: Boolean(mocks.tasa.v), tasa: mocks.tasa.v, cargando: false, error: false }),
}));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) } }));
vi.mock('../lib/activeTenant', () => ({
  resolveTenantSlug: () => Promise.resolve('demo'),
  getTenantSlugSync: () => 'demo',
}));

const productos = [
  { id: 'a', name: 'Plato uno', sale_price: 10, category: 'Platos', image_url: 'https://x.test/a.jpg', catalog_attributes: { featured: true } },
  { id: 'b', name: 'Plato dos', sale_price: 5, category: 'Platos', catalog_attributes: {} },
  { id: 'c', name: 'Postre tres', sale_price: 3, category: 'Postres', catalog_attributes: { coming_soon: true } },
];
const categorias = [{ name: 'Todos', displayName: 'Todos' }, { name: 'Platos', displayName: 'Platos' }, { name: 'Postres', displayName: 'Postres' }];

const render_ = (props = {}, config = {}) => render(
  <PlantillaPop products={productos} categories={categorias} store={{ name: 'Casa Prueba', isOpen: true }}
    settings={{ currency: 'USD', timezone: 'America/Caracas' }} config={{ intro: false, ...config }} {...props} />,
);

const orden = (c) => [...c.querySelectorAll('section[id^="pop-"]')].map(s => s.id.replace('pop-', ''));

beforeEach(() => {
  mocks.tasa.v = null;
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('secciones por config', () => {
  it('respeta el orden y apaga lo que esta en off; el menu no se puede apagar', () => {
    const { container } = render_({}, {
      secciones: [{ id: 'menu' }, { id: 'favoritos' }, { id: 'hero', on: false }],
    });
    expect(orden(container)).toEqual(['menu', 'favoritos']);
    cleanup();
    const sinMenu = render_({}, { secciones: [{ id: 'favoritos' }, { id: 'menu', on: false }] });
    expect(orden(sinMenu.container)).toEqual(['favoritos', 'menu']);
  });

  it('favoritos, flyers vencidos, testimonios e historia se ocultan sin datos; el menu siempre esta', () => {
    const { container } = render_({ products: [productos[1]] }, {
      flyers: [{ titulo: 'Viejo', hasta: '2000-01-01' }],
    });
    const ids = orden(container);
    expect(ids).toContain('menu');
    for (const id of ['favoritos', 'flyers', 'testimonios', 'historia', 'cinta', 'submarca', 'banda']) expect(ids).not.toContain(id);
  });

  it('con datos aparecen: favoritos, flyer vigente y testimonios', () => {
    const { container } = render_({}, {
      flyers: [{ titulo: 'Vigente', texto: 'hoy' }],
      testimonios: [{ texto: 'Muy rico', nombre: 'Ana' }],
    });
    expect(orden(container)).toEqual(['inicio', 'favoritos', 'flyers', 'menu', 'testimonios']);
  });
});

describe('menu', () => {
  it('filtra por categoria con chips aria-pressed y por buscador', () => {
    render_();
    const menu = screen.getByRole('region', { name: 'Nuestro menú' });
    fireEvent.click(within(menu).getByRole('button', { name: 'Postres' }));
    expect(within(menu).getByRole('button', { name: 'Postres' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(menu).getByText('1 producto')).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('button', { name: 'Todos' }));
    fireEvent.change(within(menu).getByLabelText('Buscar en el menú'), { target: { value: 'dos' } });
    expect(within(menu).getByText('1 producto')).toBeInTheDocument();
  });

  it('muestra skeleton y no "0 productos" mientras no hay productos', () => {
    render_({ products: [] });
    expect(screen.queryByText(/0 productos/)).not.toBeInTheDocument();
    expect(screen.getByText('Cargando el menú…')).toBeInTheDocument();
  });
});

describe('productos', () => {
  it('Agregar llama onAddToCart con el producto crudo', () => {
    const onAddToCart = vi.fn();
    render_({ onAddToCart });
    const menu = screen.getByRole('region', { name: 'Nuestro menú' });
    fireEvent.click(within(menu).getByRole('button', { name: 'Agregar Plato dos' }));
    expect(onAddToCart).toHaveBeenCalledWith(productos[1]);
  });

  it('tocar la tarjeta abre el detalle', () => {
    const onSelectProduct = vi.fn();
    render_({ onSelectProduct });
    fireEvent.click(within(screen.getByRole('region', { name: 'Nuestro menú' })).getByRole('button', { name: 'Ver detalle de Plato dos' }));
    expect(onSelectProduct).toHaveBeenCalledWith(productos[1]);
  });

  it('un producto coming_soon se muestra con etiqueta y sin boton de agregar', () => {
    render_();
    const menu = screen.getByRole('region', { name: 'Nuestro menú' });
    expect(within(menu).getByText('PRÓXIMAMENTE')).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: 'Agregar Postre tres' })).not.toBeInTheDocument();
  });

  it('un producto agotado no se puede agregar', () => {
    render_({ soldOutIds: new Set(['b']) });
    expect(screen.queryByRole('button', { name: 'Agregar Plato dos' })).not.toBeInTheDocument();
    expect(screen.getAllByText('AGOTADO').length).toBeGreaterThan(0);
  });
});

describe('precios', () => {
  it('sin moneda secundaria muestra solo el principal y ningun aviso', () => {
    render_();
    expect(screen.queryByText(/Tasa/)).toBeNull();
    expect(screen.getAllByText('$5.00').length).toBeGreaterThan(0);
  });

  it('con secundaria y tasa muestra principal + secundario y la tasa', () => {
    mocks.tasa.v = { rate: 100, fecha: '2099-01-01', fuente: 'bcv', vencida: false };
    render_({ settings: { currency: 'USD', secondary_currency: 'VES', timezone: 'America/Caracas' } });
    expect(screen.getAllByText('$5.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/500,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/tasa del 01\/01\/2099/)).toBeInTheDocument();
  });

  it('tasa vencida: aviso visible con texto, no solo color', () => {
    mocks.tasa.v = { rate: 100, fecha: '2020-01-01', fuente: 'bcv', vencida: true };
    render_({ settings: { currency: 'USD', secondary_currency: 'VES', timezone: 'America/Caracas' } });
    expect(screen.getByText(/Tasa por verificar/)).toBeInTheDocument();
    expect(screen.getByText('Ojo:')).toBeInTheDocument();
  });
});

describe('intro', () => {
  const conIntro = { intro: true, marca: { isotipo: 'https://x.test/iso.png' } };

  it('aparece una vez por sesion y se salta con Escape', () => {
    render_({}, conIntro);
    expect(screen.getByTestId('pop-intro')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('pop-intro')).not.toBeInTheDocument();
    cleanup();
    render_({}, conIntro);
    expect(screen.queryByTestId('pop-intro')).not.toBeInTheDocument();
  });

  it('se cierra sola a los 2,2 s', () => {
    vi.useFakeTimers();
    render_({}, conIntro);
    expect(screen.getByTestId('pop-intro')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2300); });
    expect(screen.queryByTestId('pop-intro')).not.toBeInTheDocument();
  });

  it('no aparece con prefers-reduced-motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
    render_({}, conIntro);
    expect(screen.queryByTestId('pop-intro')).not.toBeInTheDocument();
    delete window.matchMedia;
  });

  it('no aparece con animaciones pausadas', () => {
    window.localStorage.setItem('dico-pop-quieto', '1');
    render_({}, conIntro);
    expect(screen.queryByTestId('pop-intro')).not.toBeInTheDocument();
  });

  it('con intro:false no aparece', () => {
    render_({}, { intro: false, marca: { isotipo: 'https://x.test/iso.png' } });
    expect(screen.queryByTestId('pop-intro')).not.toBeInTheDocument();
  });
});

describe('pausar animaciones', () => {
  it('el boton alterna la clase pop-quieto y persiste', () => {
    const { container } = render_();
    const raiz = container.querySelector('.pop-root');
    expect(raiz).not.toHaveClass('pop-quieto');
    fireEvent.click(screen.getByRole('button', { name: 'Pausar animaciones' }));
    expect(raiz).toHaveClass('pop-quieto');
    expect(window.localStorage.getItem('dico-pop-quieto')).toBe('1');
    cleanup();
    const otra = render_();
    expect(otra.container.querySelector('.pop-root')).toHaveClass('pop-quieto');
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar animaciones' }));
    expect(window.localStorage.getItem('dico-pop-quieto')).toBe('0');
  });
});

describe('estructura y marca', () => {
  it('raiz cp-root + pop-root, un solo h1, landmarks y tokens de marca', () => {
    const { container } = render_({}, { marca: { primario: '#eb140c', fondo: '#f5f0dc', texto: '#211e1a' } });
    const raiz = container.querySelector('.pop-root');
    expect(raiz).toHaveClass('cp-root');
    expect(raiz.style.getPropertyValue('--ac')).toBe('#eb140c');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
  });

  it('con carrito: barra inferior y boton de pedido llaman onOpenCart', () => {
    const onOpenCart = vi.fn();
    render_({ cartCount: 2, cartTotal: 20, onOpenCart });
    fireEvent.click(screen.getByRole('button', { name: /Ver mi pedido \(2\)/ }));
    expect(onOpenCart).toHaveBeenCalledTimes(1);
  });

  it('el render por defecto no trae textos de la marca de referencia', () => {
    const { container } = render_();
    expect(container.textContent).not.toMatch(/cochi|brutal|cerdit/i);
  });

  it('una sola hoja de fuentes inyectada y limpiada', () => {
    const { unmount } = render_({}, { marca: { fuente_titulo: 'Bebas Neue', fuente_texto: 'DM Sans' } });
    expect(document.querySelectorAll('link[data-pop-fuentes]')).toHaveLength(1);
    unmount();
    expect(document.querySelectorAll('link[data-pop-fuentes]')).toHaveLength(0);
  });
});

describe('revelado al scroll', () => {
  const sinVer = (c) => [...c.querySelectorAll('[data-revelar]')].filter(el => !el.hasAttribute('data-visto'));

  it('lo que se monta despues (datos tardios, cambio de categoria) queda visible aunque el observer nunca dispare', async () => {
    const observe = vi.fn();
    vi.stubGlobal('IntersectionObserver', class { observe = observe; unobserve() {} disconnect() {} });
    const props = { store: { name: 'Casa Prueba' }, settings: { currency: 'USD' }, categories: categorias, config: { intro: false } };
    const { container, rerender } = render(<PlantillaPop {...props} products={[]} />);
    expect(container.querySelector('.pop-root')).toHaveClass('pop-anima');
    rerender(<PlantillaPop {...props} products={productos} />);
    const tarjetas = container.querySelectorAll('.pop-card');
    expect(tarjetas.length).toBeGreaterThan(0);
    await waitFor(() => tarjetas.forEach(t => expect(t).toHaveAttribute('data-visto', '1')));
    fireEvent.click(screen.getByRole('button', { name: 'Postres' }));
    await waitFor(() => { const n = container.querySelectorAll('.pop-card'); expect(n.length).toBeGreaterThan(0); n.forEach(t => expect(t).toHaveAttribute('data-visto', '1')); });
    expect(sinVer(container).every(el => !el.classList.contains('pop-card'))).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('intro, cinta y hero', () => {
  it('mientras dura la intro el resto queda inert y se restituye al saltarla', () => {
    render_({}, { intro: true, marca: { isotipo: 'https://x.test/iso.png' } });
    expect(screen.getByRole('main')).toHaveAttribute('inert');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
  });

  it('la cinta repite las frases y solo la primera pasada es legible', () => {
    const { container } = render_({}, { cinta: ['Uno', 'Dos'] });
    const tiras = container.querySelectorAll('.pop-cinta__tira');
    expect(tiras).toHaveLength(2);
    expect(tiras[0].querySelectorAll('li').length).toBeGreaterThanOrEqual(10);
    expect(tiras[0].querySelectorAll('li:not([aria-hidden])')).toHaveLength(2);
  });

  it('el estado del hero tiene tres casos y no promete pedido programado', () => {
    const una = render_({ store: { name: 'X', isOpen: false } });
    expect(screen.getByText('Ahora estamos cerrados')).toBeInTheDocument();
    una.unmount();
    render_({ store: { name: 'X' } });
    expect(screen.queryByText(/cerrados|recibiendo/)).not.toBeInTheDocument();
  });
});

describe('tenants sin fotos', () => {
  const sinFoto = productos.map(({ image_url: _i, ...p }) => p);

  it('las tarjetas sin imagen usan la variante compacta; las con imagen, no', () => {
    const { container } = render_({ products: [...sinFoto, { id: 'd', name: 'Con foto', sale_price: 1, category: 'Platos', image_url: 'https://x.test/d.jpg', catalog_attributes: {} }] });
    const menu = container.querySelector('#pop-menu');
    expect(menu.querySelectorAll('.pop-card--sinfoto')).toHaveLength(3);
    expect(menu.querySelectorAll('.pop-card:not(.pop-card--sinfoto)')).toHaveLength(1);
    expect(within(menu).getByRole('button', { name: 'Agregar Plato dos' })).toBeInTheDocument();
    expect(within(menu).getByText('PRÓXIMAMENTE')).toBeInTheDocument();
  });

  it('el hero sin imagen no deja bloque vacio y el titular ocupa el ancho', () => {
    const { container } = render_({ products: sinFoto });
    expect(container.querySelector('.pop-hero')).toHaveClass('pop-hero--solo');
    expect(container.querySelector('.pop-hero__imagen')).toBeNull();
    expect(container.querySelector('.pop-hero__vacio')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Casa Prueba');
  });

  it('submarca: un color propio con poco contraste sobre su fondo cae al texto legible', () => {
    const sub = { nombre: 'Sub', categoria: 'Platos', fondo: '#ffffff', color: '#eeeeee' };
    const { container } = render_({}, { submarca: sub });
    expect(container.querySelector('#pop-submarca').style.getPropertyValue('--pop-sub-texto')).toBe('#111111');
    cleanup();
    const bueno = render_({}, { submarca: { ...sub, color: '#000000' } });
    expect(bueno.container.querySelector('#pop-submarca').style.getPropertyValue('--pop-sub-texto')).toBe('#000000');
  });

  it('con imagen el hero conserva su bloque', () => {
    const { container } = render_();
    expect(container.querySelector('.pop-hero')).not.toHaveClass('pop-hero--solo');
    expect(container.querySelector('.pop-hero__imagen img')).not.toBeNull();
  });
});

describe('submarca y menu sin repetidos', () => {
  const sub = { nombre: 'Dulce', categoria: 'Postres' };
  const nombresMenu = (c) => [...c.querySelectorAll('#pop-menu .pop-card__nombre')].map(n => n.textContent);
  const nombresSub = (c) => [...c.querySelectorAll('#pop-submarca .pop-card__nombre')].map(n => n.textContent);

  it('con la submarca activa, su categoria sale del menu (y de sus chips)', () => {
    const { container } = render_({}, { submarca: sub });
    expect(nombresSub(container)).toEqual(['Postre tres']);
    expect(nombresMenu(container)).toEqual(['Plato uno', 'Plato dos']);
    expect(within(container.querySelector('#pop-menu')).queryByRole('button', { name: 'Postres' })).not.toBeInTheDocument();
  });
  it('con la seccion apagada, los productos vuelven al menu', () => {
    const { container } = render_({}, { submarca: sub, secciones: [{ id: 'menu' }, { id: 'submarca', on: false }] });
    expect(container.querySelector('#pop-submarca')).toBeNull();
    expect(nombresMenu(container)).toContain('Postre tres');
    expect(within(container.querySelector('#pop-menu')).getByRole('button', { name: 'Postres' })).toBeInTheDocument();
  });
  it('sin productos en esa categoria la seccion se oculta y nada se pierde del menu', () => {
    const { container } = render_({ products: productos.filter(p => p.category !== 'Postres') }, { submarca: sub });
    expect(container.querySelector('#pop-submarca')).toBeNull();
    expect(nombresMenu(container)).toEqual(['Plato uno', 'Plato dos']);
  });
});

describe('precio de proximamente', () => {
  const otros = (precio) => [{ id: 'z', name: 'Brownie', sale_price: precio, category: 'Postres', catalog_attributes: { coming_soon: true } }];
  it('sin precio (0) no muestra precio ni boton Agregar', () => {
    const { container } = render_({ products: otros(0) });
    const card = container.querySelector('#pop-menu .pop-card');
    expect(card.textContent).toMatch(/pr[oó]ximamente/i);
    expect(card.querySelector('.pop-precio')).toBeNull();
    expect(card.textContent).not.toMatch(/0[.,]00/);
    expect(within(card).queryByRole('button', { name: /^Agregar/ })).toBeNull();
  });
  it('con precio lo muestra, sin boton Agregar', () => {
    const { container } = render_({ products: otros(4) });
    const card = container.querySelector('#pop-menu .pop-card');
    expect(card.textContent).toMatch(/4/);
    expect(within(card).queryByRole('button', { name: /^Agregar/ })).toBeNull();
  });
});
