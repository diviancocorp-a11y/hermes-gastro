import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import HomeScreen from '../catalog-pro/HomeScreen';
import HomeConPlantilla from '../catalog-pro/plantillas/HomeConPlantilla';

// Regresion de la plantilla: los tenants que NO la eligieron ven lo mismo que antes.
//   A. default / null / undefined / desconocida -> HomeScreen y el chunk de la plantilla ni se evalua.
//   B. el DOM del wrapper es identico al de HomeScreen directo (HomeScreen.jsx no se toca).
//   C. Catalog.jsx no importa la plantilla de forma estatica (va en chunk aparte).
//   D. config rota o plantilla que lanza -> cae a HomeScreen y reporta a Sentry.

const mocks = vi.hoisted(() => ({ cargada: vi.fn(), lanzar: { v: false }, captureException: vi.fn(), captureMessage: vi.fn() }));

vi.mock('../catalog-pro/OrderStatusCard', () => ({ default: () => null }));
vi.mock('../catalog-pro/ReservarEntrada', () => ({ default: () => null }));
vi.mock('../catalog-pro/CatalogMusicToggle', () => ({ default: () => null }));
vi.mock('../catalog-pro/PromoCarousel', () => ({ default: () => null }));
vi.mock('../catalog-pro/SuperCombos', () => ({ default: () => null }));
vi.mock('../catalog-pro/homeHelpers', async importOriginal => ({ ...await importOriginal(), buildStories: () => [], buildRecos: () => [] }));
vi.mock('../lib/observability', async importOriginal => ({ ...await importOriginal(), captureException: mocks.captureException, captureMessage: mocks.captureMessage }));
vi.mock('../catalog-pro/plantillas/PlantillaPop', () => {
  mocks.cargada();
  return { default: () => {
    if (mocks.lanzar.v) throw new Error('la plantilla exploto');
    return <div data-testid="plantilla-pop">POP</div>;
  } };
});

const products = [{ id: 'a', name: 'Producto de prueba', sale_price: 100, catalog_attributes: { features: [] } }];
const base = { products, categories: [{ name: 'Todos' }], store: { name: 'Prueba' } };
const configOk = { marca: { primario: '#eb140c', fondo: '#f5f0dc', texto: '#211e1a' }, intro: true };

beforeEach(() => { mocks.cargada.mockClear(); mocks.lanzar.v = false; mocks.captureException.mockClear(); mocks.captureMessage.mockClear(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('A. tenants sin plantilla', () => {
  for (const valor of [undefined, null, 'default', 'otra', '']) {
    it(`catalog_template=${JSON.stringify(valor)} monta HomeScreen y no evalua la plantilla`, () => {
      render(<HomeConPlantilla {...base} settings={{ catalog_profile: 'gastro', catalog_template: valor, catalog_template_config: configOk }} />);
      expect(screen.getByRole('region', { name: 'Filtros del catálogo' })).toBeInTheDocument();
      expect(screen.queryByTestId('plantilla-pop')).not.toBeInTheDocument();
      expect(mocks.cargada).not.toHaveBeenCalled();
    });
  }
});

describe('B. DOM identico', () => {
  it('el wrapper devuelve el mismo HTML que HomeScreen directo', () => {
    const settings = { catalog_profile: 'gastro', catalog_theme: 'carbon' };
    const directo = render(<HomeScreen {...base} settings={settings} />).container.innerHTML;
    cleanup();
    const envuelto = render(<HomeConPlantilla {...base} settings={{ ...settings, catalog_template: 'default' }} />).container.innerHTML;
    expect(envuelto).toBe(directo);
    expect(directo.length).toBeGreaterThan(500);
  });
});

describe('C. Catalog.jsx', () => {
  it('no importa la plantilla de forma estatica; solo el wrapper, y esa carga es dinamica', () => {
    const catalog = readFileSync(resolve(__dirname, '../pages/Catalog.jsx'), 'utf-8');
    expect(catalog).not.toMatch(/from\s+["'][^"']*PlantillaPop["']/);
    const wrapper = readFileSync(resolve(__dirname, '../catalog-pro/plantillas/HomeConPlantilla.jsx'), 'utf-8');
    // El mapa de plantillas (plantillasCargables.js) es quien las carga, siempre con import() dinamico.
    expect(wrapper).toMatch(/from ["']\.\/plantillasCargables["']/);
    expect(wrapper).not.toMatch(/^import .* from ["']\.\/PlantillaPop["']/m);
    const mapa = readFileSync(resolve(__dirname, '../catalog-pro/plantillas/plantillasCargables.js'), 'utf-8');
    expect(mapa).toMatch(/lazyReload\(\(\)\s*=>\s*import\(["']\.\/PlantillaPop["']\)\)/);
    expect(mapa).not.toMatch(/^import .* from ["']\.\/(PlantillaPop|cochi\/PlantillaCochi)["']/m);
  });
});

describe('plantilla elegida', () => {
  it('pop con config valida carga el chunk y pinta la plantilla', async () => {
    render(<HomeConPlantilla {...base} settings={{ catalog_template: 'pop', catalog_template_config: configOk }} />);
    await waitFor(() => expect(screen.getByTestId('plantilla-pop')).toBeInTheDocument());
    expect(mocks.captureException).not.toHaveBeenCalled();
  });
});

describe('D. fallos', () => {
  it('config rota: HomeScreen y aviso a Sentry, sin tocar la plantilla', () => {
    render(<HomeConPlantilla {...base} settings={{ catalog_template: 'pop', catalog_template_config: { marca: { primario: 'rojo' } } }} />);
    expect(screen.getByRole('region', { name: 'Filtros del catálogo' })).toBeInTheDocument();
    expect(screen.queryByTestId('plantilla-pop')).not.toBeInTheDocument();
    expect(mocks.captureMessage).toHaveBeenCalledTimes(1);
    expect(mocks.captureMessage.mock.calls[0][0]).toMatch(/marca\.primario/);
  });
  it('plantilla que lanza: la guardia cae a HomeScreen y reporta la excepcion', async () => {
    mocks.lanzar.v = true;
    render(<HomeConPlantilla {...base} settings={{ catalog_template: 'pop', catalog_template_config: configOk, catalog_profile: 'gastro' }} />);
    await waitFor(() => expect(screen.getByRole('region', { name: 'Filtros del catálogo' })).toBeInTheDocument());
    expect(screen.queryByTestId('plantilla-pop')).not.toBeInTheDocument();
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    expect(mocks.captureException.mock.calls[0][0].message).toBe('la plantilla exploto');
    expect(mocks.captureException.mock.calls[0][1].tags.source).toBe('plantilla-catalogo');
  });
});
