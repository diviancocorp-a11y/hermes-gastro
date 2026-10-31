import { describe, expect, it } from 'vitest';
import { familyTotal, groupCatalogItems, packSummary, packTexts, shortNames } from '../lib/catalogFamilies';

const emp = (id, name, price, extra = {}) => ({
  id, name, sale_price: price, catalog_attributes: { family: 'Empanadas', family_pack: '12' }, ...extra,
});

describe('groupCatalogItems', () => {
  const lista = [
    { id: 'p0', name: 'Pan', sale_price: 100 },
    emp('e1', 'Empanada de Carne', 2250, { image_url: null }),
    { id: 'p1', name: 'Torta', sale_price: 500 },
    emp('e2', 'Empanada de Pollo', 2000, { image_url: 'pollo.jpg' }),
  ];

  it('agrupa en la posicion del primer miembro con foto y precio minimo', () => {
    const out = groupCatalogItems(lista);
    expect(out.map(e => e.type)).toEqual(['product', 'family', 'product']);
    const f = out[1].family;
    expect(f.name).toBe('Empanadas');
    expect(f.members.map(m => m.id)).toEqual(['e1', 'e2']);
    expect(f.minPrice).toBe(2000);
    expect(f.image).toBe('pollo.jpg');
    expect(f.pack).toBe(12);
  });

  it('una familia de un solo miembro queda como producto', () => {
    const out = groupCatalogItems([emp('e1', 'Empanada de Carne', 100)]);
    expect(out).toEqual([{ type: 'product', product: expect.objectContaining({ id: 'e1' }) }]);
  });

  it('con group false no agrupa nada', () => {
    expect(groupCatalogItems(lista, { group: false }).every(e => e.type === 'product')).toBe(true);
  });

  it('sin family no cambia nada y conserva el orden', () => {
    const sin = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    expect(groupCatalogItems(sin).map(e => e.product.id)).toEqual(['a', 'b']);
  });

  it('ignora inactivos y productos +18', () => {
    const out = groupCatalogItems([
      emp('e1', 'X', 1), emp('e2', 'Y', 2, { active: false }), emp('e3', 'Z', 3, { requires_age_gate: true }),
    ]);
    expect(out.every(e => e.type === 'product')).toBe(true);
  });

  it('sin family_pack valido el pack es null', () => {
    const a = { id: 'a', name: 'Pan relleno de Jamon', sale_price: 1, catalog_attributes: { family: 'Pan relleno' } };
    const b = { id: 'b', name: 'Pan relleno de Queso', sale_price: 2, catalog_attributes: { family: 'Pan relleno' } };
    expect(groupCatalogItems([a, b])[0].family.pack).toBeNull();
  });
});

describe('agotados y genero', () => {
  it('minPrice ignora agotados salvo que lo esten todos', () => {
    const ms = [emp('a', 'Empanada de A', 100), emp('b', 'Empanada de B', 300)];
    expect(groupCatalogItems(ms, { soldOut: m => m.id === 'a' })[0].family).toMatchObject({ minPrice: 300, allSoldOut: false });
    expect(groupCatalogItems(ms, { soldOut: () => true })[0].family).toMatchObject({ minPrice: 100, allSoldOut: true });
  });
  it('packTexts: docena femenino, pack masculino, mitad solo si es par', () => {
    expect(packTexts(12)).toMatchObject({ the: 'la docena', one: 'una docena', half: 'media docena', halfEven: true });
    expect(packTexts(9)).toMatchObject({ the: 'el pack', one: 'un pack', half: 'medio pack', halfEven: false });
    expect(packSummary(0, 6).label).toBe('Te faltan 6 para el pack');
  });
});

describe('shortNames', () => {
  it('quita el prefijo comun y el conector', () => {
    expect(shortNames([{ name: 'Empanada de Carne' }, { name: 'Empanada de Pollo' }])).toEqual(['Carne', 'Pollo']);
  });
  it('sin prefijo comun usa el nombre completo', () => {
    expect(shortNames([{ name: 'Carne' }, { name: 'Pollo' }])).toEqual(['Carne', 'Pollo']);
  });
  it('si un nombre quedaria vacio usa los completos', () => {
    expect(shortNames([{ name: 'Pasta frola' }, { name: 'Pasta frola de batata' }]))
      .toEqual(['Pasta frola', 'Pasta frola de batata']);
  });
});

describe('packSummary', () => {
  it('muestra cuanto falta para la docena', () => {
    expect(packSummary(5, 12)).toMatchObject({ faltan: 7, label: 'Te faltan 7 para la docena' });
    expect(packSummary(0, 12).faltan).toBe(12);
  });
  it('docenas completas y resto', () => {
    expect(packSummary(15, 12)).toMatchObject({ docenas: 1, resto: 3, label: '1 docena + 3' });
    expect(packSummary(24, 12).label).toBe('2 docenas');
  });
  it('sin pack no hay etiqueta', () => {
    expect(packSummary(7, null)).toMatchObject({ total: 7, label: '' });
  });
});

describe('familyTotal', () => {
  it('suma real por unidad, sin descuentos', () => {
    const ms = [{ id: 'a', sale_price: 100 }, { id: 'b', sale_price: 250 }];
    expect(familyTotal(ms, { a: 2, b: 3 })).toEqual({ units: 5, amount: 950 });
    expect(familyTotal(ms, {})).toEqual({ units: 0, amount: 0 });
  });
});
