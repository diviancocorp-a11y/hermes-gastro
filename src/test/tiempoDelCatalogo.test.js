import { describe, it, expect } from 'vitest';
import { tiempoFor, mapProduct } from '../catalog-pro/homeHelpers.js';

describe('tiempo que muestra la tarjeta del catalogo', () => {
  it('un servicio muestra su duracion', () => {
    expect(tiempoFor({ id: 'a', type: 'service', duration_min: 180 })).toBe('3 h');
    expect(tiempoFor({ id: 'b', type: 'service', duration_min: 150 })).toBe('2 h 30');
    expect(tiempoFor({ id: 'c', type: 'service', duration_min: 50 })).toBe('50 min');
  });

  it('un servicio sin duracion (un agregado) no muestra tiempo', () => {
    expect(tiempoFor({ id: 'd', type: 'service', duration_min: null })).toBeNull();
  });

  it('gastronomia y comercio no muestran tiempo', () => {
    expect(tiempoFor({ id: 'e', type: 'composite' })).toBeNull();
    expect(tiempoFor({ id: 'f', type: 'simple' })).toBeNull();
    expect(tiempoFor({ id: 'g' })).toBeNull();
  });

  it('mapProduct expone el tiempo listo para pintar', () => {
    const p = mapProduct({ id: 'h', name: 'Alisado', type: 'service', duration_min: 180, sale_price: 26000 });
    expect(p.tiempo).toBe('3 h');
    expect(mapProduct({ id: 'i', name: 'Box x9', type: 'composite', sale_price: 9000 }).tiempo).toBeNull();
  });
});
