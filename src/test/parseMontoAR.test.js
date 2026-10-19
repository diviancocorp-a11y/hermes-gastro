// Montos tipeados a mano en formato argentino (auditoria de Caja, 19/oct).
// Number('1500,50') || 0 daba 0 y Number('12.500') daba 12.5.

import { describe, it, expect } from 'vitest';
import { parseMontoAR, montoParaEditar } from '../lib/format';

describe('parseMontoAR', () => {
  it.each([
    ['5000', 5000],
    ['1500,50', 1500.5],
    ['1500,5', 1500.5],
    ['1.500,50', 1500.5],
    ['12.500', 12500],
    ['1.250.000', 1250000],
    ['1.250.000,75', 1250000.75],
    ['1500.5', 1500.5],
    ['1500.50', 1500.5],
    [' $ 2.000 ', 2000],
    ['0', 0],
  ])('%s -> %s', (texto, numero) => {
    expect(parseMontoAR(texto)).toBe(numero);
  });

  it.each(['', '1,2,3', '1.2.3', '12.50.0', '1,500', ',5', '5,', '1.500.5', 'abc'])(
    'no adivina lo ambiguo o roto: "%s"', (texto) => {
      expect(parseMontoAR(texto)).toBeNaN();
    },
  );
});

describe('montoParaEditar', () => {
  it.each([[6500, '6500'], [6500.5, '6500,5'], [12500.75, '12500,75'], [1500.125, '1500,13']])(
    '%s -> "%s", y parseMontoAR lo vuelve a leer', (n, texto) => {
      expect(montoParaEditar(n)).toBe(texto);
      expect(parseMontoAR(texto)).toBe(Number(texto.replace(',', '.')));
    },
  );
});
