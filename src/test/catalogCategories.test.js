import { describe, it, expect } from 'vitest';
import { buildCatalogGroups, matchesCatalogCategory, buildCatalogDealParents } from '../lib/catalogCategories';

const fallback = [{ name: 'Panaderia', subs: ['Pan'] }];
const products = [
  { id: 'botella', category: 'Lorca Malbec' },
  { id: 'caja', category: 'Lorca Malbec x6' },
  { id: 'hielo', category: ' Hielo ' },
];
const idsFor = (groups, name) => products
  .filter(product => matchesCatalogCategory(product, groups.find(group => group.name === name)))
  .map(product => product.id);

describe('categorias publicas del tenant', () => {
  it('reemplaza el fallback y permite filtrar una presentacion por bodega o formato', () => {
    const groups = buildCatalogGroups([
      { name: 'Mauricio Lorca', subcategories: ['Lorca Malbec', 'Lorca Malbec x6'] },
      { name: 'Cajas', subs: ['Lorca Malbec x6'] },
    ], fallback, products);
    expect(groups.map(group => group.name)).toEqual(['Mauricio Lorca', 'Cajas', 'Hielo']);
    expect(idsFor(groups, 'Mauricio Lorca')).toEqual(['botella', 'caja']);
    expect(idsFor(groups, 'Cajas')).toEqual(['caja']);
    expect(idsFor(groups, 'Hielo')).toEqual(['hielo']);
  });

  it('conserva el fallback cuando el tenant no tiene configuracion', () => {
    expect(buildCatalogGroups(null, fallback)).toEqual(fallback);
    expect(buildCatalogGroups(undefined, fallback)).toEqual(fallback);
  });

  it('con configuracion vacia deriva categorias reales sin recuperar las del build', () => {
    expect(buildCatalogGroups([], fallback, products).map(group => group.name))
      .toEqual(['Lorca Malbec', 'Lorca Malbec x6', 'Hielo']);
    expect(buildCatalogGroups([], fallback, [])).toEqual([]);
  });

  it('normaliza blancos, ignora entradas invalidas y evita categorias duplicadas', () => {
    expect(buildCatalogGroups([
      null, {}, { name: 'Todos' }, { name: '  Vinos ', subs: [' Malbec ', '', 'Malbec', null] },
      { name: 'Vinos' },
    ], [], [{ category: ' Malbec ' }, { category: null }]))
      .toEqual([{ name: 'Vinos', icon: undefined, subs: ['Malbec'] }]);
  });

  it('incluye productos asignados a la madre, a sus subcategorias y en Todos', () => {
    const group = buildCatalogGroups([{ name: ' Vinos ', subs: [' Malbec '] }])[0];
    expect(matchesCatalogCategory({ category: ' Vinos ' }, group)).toBe(true);
    expect(matchesCatalogCategory({ category: ' Malbec ' }, group)).toBe(true);
    expect(matchesCatalogCategory({ category: 'Hielo' }, group)).toBe(false);
    expect(matchesCatalogCategory({ category: null }, { name: 'Todos' })).toBe(true);
    expect(matchesCatalogCategory({ category: 'Vinos' }, undefined)).toBe(false);
  });

  it('permite filtros cruzados sin cambiar la precedencia de ofertas del servidor', () => {
    const configured = [
      { name: 'Cajas', subs: ['Lorca Malbec x6', 'Espumantes'] },
      { name: 'Mauricio Lorca', subs: ['Lorca Malbec', 'Lorca Malbec x6'] },
      { name: 'Espumantes', subs: ['Lois Rose'] },
    ];
    const groups = buildCatalogGroups(configured, [], products);
    expect(idsFor(groups, 'Cajas')).toEqual(['caja']);
    expect(idsFor(groups, 'Mauricio Lorca')).toEqual(['botella', 'caja']);
    const parents = buildCatalogDealParents(configured);
    expect(parents['Lorca Malbec x6']).toBe('Mauricio Lorca');
    expect(parents.Espumantes).toBe('Cajas');
    expect(parents.Hielo).toBeUndefined();
    const deals = new Set(['Cajas']);
    expect(deals.has(parents['Lorca Malbec x6'])).toBe(false);
    expect(deals.has(parents.Espumantes)).toBe(true);
  });

  it('no normaliza asociaciones de ofertas que el servidor no reconoce', () => {
    expect(buildCatalogDealParents([
      { name: 'Vinos', subs: [' Malbec '] },
      { name: 'Otra bodega', subcategories: ['Malbec'] },
    ])).toEqual({ ' Malbec ': 'Vinos' });
  });
});
