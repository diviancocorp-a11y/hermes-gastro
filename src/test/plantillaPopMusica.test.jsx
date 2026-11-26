import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PlantillaPop from '../catalog-pro/plantillas/PlantillaPop';
import HomeScreen from '../catalog-pro/HomeScreen';

// El singleton de musica se simula con un estado propio: lo que se prueba es que
// los controles lo lean y lo cambien, no el audio (jsdom no lo reproduce).
const musica = vi.hoisted(() => ({ on: true, subs: new Set(), toggle: null }));
vi.mock('../catalog-pro/catalogMusic', () => {
  musica.toggle = vi.fn(() => { musica.on = !musica.on; musica.subs.forEach((f) => f(musica.on)); return musica.on; });
  return {
    musicOn: () => musica.on,
    toggleMusic: musica.toggle,
    ensureMusic: vi.fn(),
    subscribeMusic: (fn) => { musica.subs.add(fn); return () => musica.subs.delete(fn); },
  };
});
vi.mock('../hooks/useTasaCatalogo', () => ({ default: () => ({ activa: false, tasa: null, cargando: false, error: false }) }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) } }));
vi.mock('../lib/activeTenant', () => ({
  resolveTenantSlug: () => Promise.resolve('demo'),
  getTenantSlugSync: () => 'demo',
}));
vi.mock('../catalog-pro/OrderStatusCard', () => ({ default: () => null }));
vi.mock('../catalog-pro/ReservarEntrada', () => ({ default: () => null }));
vi.mock('../catalog-pro/PromoCarousel', () => ({ default: () => null }));
vi.mock('../catalog-pro/SuperCombos', () => ({ default: () => null }));

const productos = [{ id: 'a', name: 'Plato uno', sale_price: 10, category: 'Platos', catalog_attributes: {} }];
const categorias = [{ name: 'Todos', displayName: 'Todos' }, { name: 'Platos', displayName: 'Platos' }];
const pop = (settings = {}) => render(
  <PlantillaPop products={productos} categories={categorias} store={{ name: 'Casa Prueba', isOpen: true }}
    settings={{ currency: 'USD', timezone: 'America/Caracas', ...settings }} config={{ intro: false }} />,
);
const delHeader = (c) => c.querySelector('.pop-header');

beforeEach(() => { musica.on = true; musica.subs.clear(); musica.toggle.mockClear(); window.localStorage.clear(); });
afterEach(cleanup);

describe('musica en la plantilla pop', () => {
  it('muestra el boton en el header cuando catalog_music no es false', () => {
    const { container } = pop();
    const boton = delHeader(container).querySelector('button.cp-music');
    expect(boton).toBeInTheDocument();
    expect(boton).toHaveAttribute('aria-label', 'Silenciar música');
    expect(boton).toHaveAttribute('aria-pressed', 'true');
  });

  it('no lo muestra, ni en el footer, cuando catalog_music es false', () => {
    const { container } = pop({ catalog_music: false });
    expect(container.querySelector('.cp-music')).toBeNull();
    expect(screen.queryByRole('button', { name: /música/ })).toBeNull();
  });

  it('al tocarlo llama a toggleMusic y cambia aria-pressed y aria-label', () => {
    const { container } = pop();
    const boton = delHeader(container).querySelector('button.cp-music');
    fireEvent.click(boton);
    expect(musica.toggle).toHaveBeenCalledTimes(1);
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    expect(boton).toHaveAttribute('aria-label', 'Activar música');
    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-pressed', 'true');
    expect(boton).toHaveAttribute('aria-label', 'Silenciar música');
  });

  it('el footer comparte el estado con el header', () => {
    const { container } = pop();
    const header = delHeader(container).querySelector('button.cp-music');
    const footer = container.querySelector('.pop-footer button.pop-footer__tool[aria-pressed]');
    expect(footer).toHaveTextContent('Silenciar música');
    fireEvent.click(footer);
    expect(musica.toggle).toHaveBeenCalledTimes(1);
    expect(footer).toHaveTextContent('Activar música');
    expect(header).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('musica en la plantilla clasica', () => {
  it('sigue teniendo su boton y se puede silenciar', () => {
    render(<HomeScreen products={productos} settings={{}} />);
    const boton = screen.getByRole('button', { name: 'Silenciar música' });
    fireEvent.click(boton);
    expect(musica.toggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Activar música' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('no lo monta con catalog_music en false', () => {
    render(<HomeScreen products={productos} settings={{ catalog_music: false }} />);
    expect(screen.queryByRole('button', { name: /música/ })).toBeNull();
  });
});
