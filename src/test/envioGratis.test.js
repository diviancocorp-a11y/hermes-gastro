import { describe, it, expect } from 'vitest';
import { esEnvioGratis } from '../modules/origenDelEnvio';
import { calcDeliveryCost } from '../constants/catalogConstants';

describe('esEnvioGratis', () => {
  it('es gratis solo si el subtotal SUPERA el umbral', () => {
    expect(esEnvioGratis(60001, 60000)).toBe(true);
    expect(esEnvioGratis(100000, 60000)).toBe(true);
  });

  it('exactamente en el umbral no es gratis: "mayor a" no incluye el borde', () => {
    expect(esEnvioGratis(60000, 60000)).toBe(false);
    expect(esEnvioGratis(59999, 60000)).toBe(false);
  });

  it('sin umbral o con uno invalido nunca es gratis', () => {
    expect(esEnvioGratis(999999, 0)).toBe(false);
    expect(esEnvioGratis(999999, null)).toBe(false);
    expect(esEnvioGratis(999999, undefined)).toBe(false);
    expect(esEnvioGratis(999999, '')).toBe(false);
    expect(esEnvioGratis(999999, 'abc')).toBe(false);
    expect(esEnvioGratis(999999, -5)).toBe(false);
  });

  it('acepta el umbral como string, que es como lo serializa Postgres', () => {
    expect(esEnvioGratis(70000, '60000')).toBe(true);
  });
});

describe('tramos de Crazy Miga: $3.700 cada 10 km', () => {
  const tramos = [
    { max_km: 10, cost: 3700 }, { max_km: 20, cost: 7400 },
    { max_km: 30, cost: 11100 }, { max_km: 40, cost: 14800 },
    { max_km: null, cost: 18500 },
  ];

  it('cobra por bloque de 10 km', () => {
    expect(calcDeliveryCost(0.5, tramos)).toBe(3700);
    expect(calcDeliveryCost(10, tramos)).toBe(3700);
    expect(calcDeliveryCost(10.1, tramos)).toBe(7400);
    expect(calcDeliveryCost(20, tramos)).toBe(7400);
    expect(calcDeliveryCost(25, tramos)).toBe(11100);
    expect(calcDeliveryCost(35, tramos)).toBe(14800);
  });

  it('pasado el ultimo bloque cae en el resto', () => {
    expect(calcDeliveryCost(41, tramos)).toBe(18500);
    expect(calcDeliveryCost(120, tramos)).toBe(18500);
  });
});
