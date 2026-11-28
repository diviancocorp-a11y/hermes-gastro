// Plantilla exclusiva `cochi`: PlantillaPop acepta reemplazos de secciones y una
// clase extra sin cambiar lo que renderiza por defecto; el editor solo ofrece la
// exclusiva al tenant dueno.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import PlantillaPop from '../catalog-pro/plantillas/PlantillaPop';
import PlantillaCochi from '../catalog-pro/plantillas/cochi/PlantillaCochi';
import { PLANTILLAS_CARGABLES } from '../catalog-pro/plantillas/plantillasCargables';
import PlantillaEditor from '../components/admin/platform/PlantillaEditor';
import { PLANTILLAS, PLANTILLAS_EXCLUSIVAS } from '../lib/plantillaListas';
import { COCHI_SETTINGS, COCHI_PRODUCTS } from './fixtures/cochi-plantilla';

vi.mock('../hooks/useTasaCatalogo', () => ({ default: () => ({ activa: false, tasa: null, cargando: false, error: false }) }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) } }));
vi.mock('../lib/activeTenant', () => ({ resolveTenantSlug: () => Promise.resolve('demo'), getTenantSlugSync: () => 'demo' }));

const productos = [
  { id: 'a', name: 'Plato uno', sale_price: 10, category: 'Platos', image_url: 'https://x.test/a.jpg', catalog_attributes: { featured: true } },
  { id: 'b', name: 'Plato dos', sale_price: 5, category: 'Platos', catalog_attributes: {} },
];
const categorias = [{ name: 'Todos', displayName: 'Todos' }, { name: 'Platos', displayName: 'Platos' }];
const props = {
  products: productos, categories: categorias, store: { name: 'Casa Prueba', isOpen: true },
  settings: { currency: 'USD', timezone: 'America/Caracas' }, config: { intro: false },
};

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => cleanup());

describe('PlantillaPop con componentes y className', () => {
  it('sin los props nuevos renderiza lo mismo que siempre', () => {
    const { container } = render(<PlantillaPop {...props} />);
    const raiz = container.firstChild;
    expect(raiz.className).toBe('cp-root pop-root');
    expect(container.querySelector('.hero-reemplazado')).toBeNull();
    const ids = [...container.querySelectorAll('section[id^="pop-"]')].map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['pop-inicio', 'pop-menu']));
  });

  it('con componentes={{ Hero: X }} renderiza X en lugar de PopHero, y el resto queda', () => {
    const base = render(<PlantillaPop {...props} />);
    const idsBase = [...base.container.querySelectorAll('section[id^="pop-"]')].map((s) => s.id);
    cleanup();
    const Hero = () => <section id="pop-inicio" className="hero-reemplazado">hola</section>;
    const { container } = render(<PlantillaPop {...props} componentes={{ Hero }} />);
    expect(container.querySelector('.hero-reemplazado')).not.toBeNull();
    const ids = [...container.querySelectorAll('section[id^="pop-"]')].map((s) => s.id);
    expect(ids).toEqual(idsBase);
  });

  it('className se suma a la raiz', () => {
    const { container } = render(<PlantillaPop {...props} className="plantilla-cochi" />);
    expect(container.firstChild.className).toBe('cp-root pop-root plantilla-cochi');
  });
});

describe('PlantillaCochi', () => {
  it('hoy se ve como pop, con la clase plantilla-cochi en la raiz', () => {
    const { container } = render(<PlantillaCochi {...props} />);
    expect(container.firstChild.className).toContain('plantilla-cochi');
    expect(container.querySelector('#pop-menu')).not.toBeNull();
  });

  it('esta en el mapa de plantillas cargables, igual que cada plantilla con portada propia', () => {
    for (const p of PLANTILLAS.filter((x) => x !== 'default')) expect(PLANTILLAS_CARGABLES[p]).toBeTruthy();
    expect(PLANTILLAS_EXCLUSIVAS).toEqual({ cochi: 'cochi' });
  });

  it('se carga por el mapa (chunk aparte)', async () => {
    const Cochi = PLANTILLAS_CARGABLES.cochi;
    const { container } = render(<Suspense fallback={null}><Cochi {...props} /></Suspense>);
    expect(await screen.findByRole('main')).toBeTruthy();
    expect(container.querySelector('.plantilla-cochi')).not.toBeNull();
  });
});

describe('PlantillaEditor: radio de la plantilla exclusiva', () => {
  const montar = (extra = {}, settings = COCHI_SETTINGS) => render(
    <PlantillaEditor
      settings={settings} productos={COCHI_PRODUCTS} onSave={vi.fn()} onSubirImagen={vi.fn()} showToast={vi.fn()} {...extra}
    />,
  );
  const radioCochi = () => screen.queryByRole('radio', { name: /Cochi \(exclusiva\)/ });

  it('visible para el tenant cochi', () => {
    montar({ tenantSlug: 'cochi' });
    expect(radioCochi()).not.toBeNull();
  });

  it('oculto para otro tenant y para el que no manda slug', () => {
    montar({ tenantSlug: 'monare' });
    expect(radioCochi()).toBeNull();
    cleanup();
    montar();
    expect(radioCochi()).toBeNull();
  });

  it('si el tenant ya tiene la exclusiva, el editor la respeta; si no es suya, cae a default', () => {
    montar({ tenantSlug: 'cochi' }, { ...COCHI_SETTINGS, catalog_template: 'cochi' });
    expect(radioCochi().checked).toBe(true);
    cleanup();
    montar({ tenantSlug: 'monare' }, { ...COCHI_SETTINGS, catalog_template: 'cochi' });
    expect(screen.getByRole('radio', { name: /Clásica/ }).checked).toBe(true);
  });
});
