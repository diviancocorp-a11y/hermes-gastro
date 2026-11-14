import { describe, it, expect } from 'vitest';
import { COCHI_SETTINGS, COCHI_PRODUCTS, cochiTasa } from './fixtures/cochi-plantilla';
import { leerConfigPlantilla, plantillaEfectiva } from '../lib/plantillaConfig';
import { CatalogAttributesSchema } from '../lib/schemas';
import { seccionesVisibles } from '../catalog-pro/plantillas/seccionesVisibles';
import { leerTasa } from '../hooks/useTasaCatalogo';

// El fixture de Cochi tiene que cumplir el mismo contrato que valida la base (0128).
describe('fixture de Cochi', () => {
  it('la config es valida y la plantilla efectiva es pop', () => {
    expect(leerConfigPlantilla(COCHI_SETTINGS.catalog_template_config).error).toBeNull();
    expect(plantillaEfectiva(COCHI_SETTINGS)).toBe('pop');
  });
  it('30 productos, 10 categorias, atributos validos para valid_catalog_attributes', () => {
    expect(COCHI_PRODUCTS).toHaveLength(30);
    expect(new Set(COCHI_PRODUCTS.map(p => p.category)).size).toBe(10);
    for (const p of COCHI_PRODUCTS) expect(CatalogAttributesSchema.safeParse(p.catalog_attributes).success).toBe(true);
    expect(COCHI_PRODUCTS.filter(p => p.catalog_attributes.featured).length).toBeGreaterThanOrEqual(3);
    expect(COCHI_PRODUCTS.filter(p => p.catalog_attributes.coming_soon).length).toBe(2);
  });
  it('doble moneda: USD principal, VES secundaria, tasa vigente', () => {
    expect(COCHI_SETTINGS).toMatchObject({ currency: 'USD', secondary_currency: 'VES' });
    expect(leerTasa(cochiTasa(), 'VES', COCHI_SETTINGS.timezone, new Date('2026-11-14T16:00:00Z'))).toMatchObject({ rate: 887.302, vencida: false });
  });
  it('muestra todas las secciones que tienen datos (testimonios vacios se ocultan)', () => {
    const ids = seccionesVisibles(COCHI_SETTINGS.catalog_template_config, {
      favoritos: 3, submarcaProductos: COCHI_PRODUCTS.filter(p => p.category === 'Postres').length,
    }, COCHI_SETTINGS.timezone);
    expect(ids).toEqual(['hero', 'cinta', 'favoritos', 'flyers', 'menu', 'submarca', 'banda', 'historia']);
  });
});
