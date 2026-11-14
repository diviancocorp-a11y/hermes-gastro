import { describe, it, expect } from 'vitest';
import { redondear, aSecundaria, aPrincipal, formatearMonto, tasaVencida } from '../lib/moneda';
import { fmtAR } from '../lib/format';
import { monedaSecundariaDe, getPais } from '../modules/paises';

describe('conversion', () => {
  it('principal -> secundaria con 2 decimales', () => {
    expect(aSecundaria(9, 887.3022)).toBe(7985.72);
    expect(aSecundaria(0, 900)).toBe(0);
  });
  it('ida y vuelta no se desvia de un centavo', () => {
    const bs = aSecundaria(12.5, 911.6243);
    expect(Math.abs(aPrincipal(bs, 911.6243) - 12.5)).toBeLessThanOrEqual(0.01);
  });
  it('sin tasa valida devuelve null, no 0 ni Infinity', () => {
    for (const r of [0, -1, null, undefined, NaN]) {
      expect(aSecundaria(5, r)).toBeNull();
      expect(aPrincipal(5, r)).toBeNull();
    }
  });
  it('redondeo: mitad hacia arriba y tolera error binario', () => {
    expect(redondear(1.005)).toBe(1.01);
    expect(redondear(2.675)).toBe(2.68);
    expect(redondear(-1.005)).toBe(-1.01);
    expect(redondear('x')).toBe(0);
  });
});

describe('formato', () => {
  it('USD, VES y ARS', () => {
    expect(formatearMonto(9, 'USD')).toBe('$9.00');
    expect(formatearMonto(7985.72, 'VES')).toBe('Bs. 7.985,72');
    expect(formatearMonto(1234.5, 'ARS')).toBe(fmtAR(1234.5));
  });
  it('moneda desconocida no rompe', () => {
    expect(formatearMonto(3, 'EUR')).toBe('EUR 3.00');
  });
});

describe('tasaVencida (zona de Caracas, UTC-4)', () => {
  it('mismo dia y hasta 3 dias: vigente', () => {
    expect(tasaVencida('2026-11-13', new Date('2026-11-13T12:00:00Z'))).toBe(false);
    expect(tasaVencida('2026-11-10', new Date('2026-11-13T12:00:00Z'))).toBe(false);
  });
  it('mas de 3 dias: vencida', () => {
    expect(tasaVencida('2026-11-09', new Date('2026-11-13T12:00:00Z'))).toBe(true);
  });
  it('usa el dia de Caracas, no el de UTC', () => {
    // 01:00 UTC del 14 es todavia 21:00 del 13 en Caracas.
    expect(tasaVencida('2026-11-10', new Date('2026-11-14T01:00:00Z'))).toBe(false);
    expect(tasaVencida('2026-11-10', new Date('2026-11-14T05:00:00Z'))).toBe(true);
  });
  it('sin fecha o fecha basura: vencida', () => {
    expect(tasaVencida(null)).toBe(true);
    expect(tasaVencida('ayer')).toBe(true);
  });
});

describe('Venezuela en paises', () => {
  it('USD principal, VES secundaria, Caracas, RIF', () => {
    const ve = getPais('VE');
    expect([ve.currency, ve.timezone, ve.idFiscal, ve.ivaDefault, ve.fiscal]).toEqual(['USD', 'America/Caracas', 'RIF', 16, null]);
    expect(monedaSecundariaDe('VE')).toBe('VES');
    expect(monedaSecundariaDe('AR')).toBeNull();
  });
});
