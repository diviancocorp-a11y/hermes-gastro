import { describe, it, expect } from 'vitest';
import { tiempoFor, mapProduct } from '../catalog-pro/homeHelpers.js';

describe('tiempo que muestra la tarjeta del catalogo', () => {
  it('un servicio muestra su duracion, no el tiempo de preparacion', () => {
    expect(tiempoFor({ id: 'a', type: 'service', duration_min: 180 }, 30)).toBe('3 h');
    expect(tiempoFor({ id: 'b', type: 'service', duration_min: 150 }, 30)).toBe('2 h 30');
    expect(tiempoFor({ id: 'c', type: 'service', duration_min: 50 }, 30)).toBe('50 min');
  });

  it('un servicio sin duracion (un agregado) no muestra tiempo', () => {
    expect(tiempoFor({ id: 'd', type: 'service', duration_min: null }, 30)).toBeNull();
  });

  it('gastronomia sigue con el tiempo de preparacion del negocio', () => {
    expect(tiempoFor({ id: 'e', type: 'product' }, 25)).toBe('25 min');
    // El deploy anterior a la 0119 no manda type: queda como antes.
    expect(tiempoFor({ id: 'f' }, 30)).toBe('30 min');
  });

  it('mapProduct expone el tiempo listo para pintar', () => {
    const p = mapProduct({ id: 'g', name: 'Alisado', type: 'service', duration_min: 180, sale_price: 26000 }, { prepDefault: 30 });
    expect(p.tiempo).toBe('3 h');
  });
});
