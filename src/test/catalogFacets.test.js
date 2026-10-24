import { describe, expect, it } from 'vitest';
import {
  applyCatalogFacets, getCatalogCategories, getFacetOptions, getProductFeatures,
  normalizeCatalogFacets, resolveCatalogProfile, BOX_PRESENTATION,
} from '../lib/catalogFacets';

const beverages = resolveCatalogProfile({ catalog_profile: 'beverages' });
const products = [
  { id: 'a', name: 'Espumante A', catalog_attributes: { category: 'Espumantes', brand: 'Chandon', presentation: 'Botella', features: [] } },
  { id: 'b', name: 'Espumante B', catalog_attributes: { category: 'Espumantes', brand: 'Otra', presentation: 'Botella', features: ['vegan'] } },
  { id: 'c', name: 'Vino C', catalog_attributes: { category: 'Tintos', brand: 'Otra', line: 'Poético', varietal: 'Malbec', presentation: 'Caja x6', features: ['vegan', 'gluten_free'] } },
  { id: 'd', name: 'Hielo', catalog_attributes: { category: 'Hielo', presentation: 'Bolsa 2kg', features: [] } },
];

describe('clasificación independiente del negocio', () => {
  it('combina categoría, bodega y presentación por AND', () => {
    expect(applyCatalogFacets(products, { category: 'Espumantes', facets: { brand: 'Chandon', presentation: 'Botella' } }).map(p => p.id)).toEqual(['a']);
    expect(applyCatalogFacets(products, { category: 'Tintos', facets: { brand: 'Chandon' } })).toEqual([]);
  });
  it('nunca infiere claims de la descripción ni de palabras parcialmente coincidentes', () => {
    const sample = [{ description: 'No es vegetariano, ni sin TACC. Marca Chandon.', name: 'Vegano imaginario' }];
    expect(getProductFeatures(sample[0])).toEqual([]);
    expect(applyCatalogFacets(sample, { facets: { brand: 'Chandon' } })).toEqual([]);
    expect(applyCatalogFacets(sample, { quickFilter: 'veg' })).toEqual([]);
  });
  it('respeta el flag vegetariano legacy declarado y descarta features desconocidos', () => {
    expect(getProductFeatures({ is_vegetarian: true })).toEqual(['vegetarian']);
    expect(getProductFeatures({ is_vegetarian: true, catalog_attributes: { features: ['vegan', 'inventado'] } })).toEqual(['vegan']);
    expect(getProductFeatures({ is_vegetarian: true, catalog_attributes: { features: [] } })).toEqual([]);
  });
  it('no mezcla marcas en las categorías cuando hay clasificación explícita', () => {
    const categories = getCatalogCategories(products, [{ name: 'Chandon' }], beverages);
    expect(categories.map(c => c.name)).toEqual(['Todos', 'Espumantes', 'Tintos', 'Hielo']);
  });
  it('respeta categorías ya resueltas por el catálogo, incluidas las ocultas y nombres personalizados', () => {
    const visible = [{ name: 'Todos' }, { name: 'Espumantes', displayName: 'Burbujas', img: 'imagen.jpg' }];
    expect(getCatalogCategories(products, visible, beverages)).toBe(visible);
  });
  it('conserva los grupos gastronómicos legacy cuando no existen atributos', () => {
    const categories = [{ name: 'Todos' }, { name: 'Comidas', subs: ['Pizzas'] }];
    expect(getCatalogCategories([{ category: 'Pizzas' }], categories, resolveCatalogProfile())).toBe(categories);
    expect(applyCatalogFacets([{ category: 'Pizzas ' }], { category: 'Comidas', categories })).toHaveLength(1);
  });
  it('las opciones de cada selector respetan las otras dimensiones', () => {
    const options = getFacetOptions(products, { profile: beverages, category: 'Espumantes', facets: { brand: 'Chandon' } });
    expect(options.brand).toEqual(['Chandon', 'Otra']);
    expect(options.presentation).toEqual(['Botella']);
    expect(options.varietal).toEqual([]);
  });
  it('cambiar categoría limpia bodega y cepa incompatibles, no deja selecciones atrapadas', () => {
    expect(normalizeCatalogFacets(products, { category: 'Hielo', facets: { brand: 'Otra', varietal: 'Malbec', presentation: 'Caja x6' } })).toEqual({});
  });
  it('prioriza el selector recién elegido sobre otra selección incompatible', () => {
    expect(normalizeCatalogFacets(products, { facets: { brand: 'Chandon', line: 'Poético' } }, 'brand')).toEqual({ brand: 'Chandon' });
  });
  it('Cajas usa la presentación declarada, no el nombre ni la categoría legacy', () => {
    const sample = [...products, { name: 'Caja falsa', category: 'Cajas' }];
    expect(applyCatalogFacets(sample, { facets: { presentation: BOX_PRESENTATION } }).map(p => p.id)).toEqual(['c']);
    expect(applyCatalogFacets(sample, { category: 'Tintos', facets: { presentation: BOX_PRESENTATION, brand: 'Otra' } })).toHaveLength(1);
  });
  it('combina características confirmadas y mantiene búsqueda y filtros comerciales', () => {
    expect(applyCatalogFacets(products, { facets: { features: ['vegan', 'gluten_free'] }, search: 'Vino', quickFilter: 'deal', hasDeal: p => p.id === 'c' }).map(p => p.id)).toEqual(['c']);
  });
  it('configura retail sin filtros de dieta y gastro con vegetariano', () => {
    expect(resolveCatalogProfile({ vertical: 'retail' }).quickFilters.some(f => f.id === 'veg')).toBe(false);
    expect(resolveCatalogProfile({ vertical: 'retail' }).facets.map(f => f.key)).toContain('brand');
    expect(resolveCatalogProfile({ vertical: 'gastro' }).quickFilters.some(f => f.id === 'veg')).toBe(true);
    expect(beverages.quickFilters.some(f => f.id === 'veg')).toBe(false);
    expect(resolveCatalogProfile({ catalog_profile: 'invalid', vertical: 'barber' }).id).toBe('barber');
  });
});
