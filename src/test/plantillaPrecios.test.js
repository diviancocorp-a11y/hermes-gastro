import { describe, it, expect } from 'vitest';
import { precioDoble, avisoDeTasa } from '../catalog-pro/plantillas/precios';
import { leerTasa } from '../hooks/useTasaCatalogo';

const fila = { base_currency: 'USD', quote_currency: 'VES', rate: 887.302, effective_date: '2026-11-14', source: 'manual' };

describe('leerTasa', () => {
  const ahora = new Date('2026-11-14T16:00:00Z');
  it('lee una fila valida', () => {
    expect(leerTasa(fila, 'VES', 'America/Caracas', ahora)).toEqual({ rate: 887.302, fecha: '2026-11-14', fuente: 'manual', vencida: false });
  });
  it('vencida pasados 3 dias en la zona del negocio', () => {
    expect(leerTasa({ ...fila, effective_date: '2026-11-10' }, 'VES', 'America/Caracas', ahora).vencida).toBe(true);
  });
  it('null, tasa invalida o moneda que no es la secundaria del tenant dan null', () => {
    expect(leerTasa(null, 'VES')).toBeNull();
    expect(leerTasa({ ...fila, rate: 0 }, 'VES')).toBeNull();
    expect(leerTasa({ ...fila, quote_currency: 'EUR' }, 'VES')).toBeNull();
  });
});

describe('precioDoble', () => {
  const tasa = { rate: 887.302, fecha: '2026-11-14', vencida: false };
  it('USD + VES con la tasa, formateado por moneda.js', () => {
    expect(precioDoble(9, { principal: 'USD', secundaria: 'VES', tasa })).toEqual({ principal: '$9.00', secundario: 'Bs. 7.985,72', estado: 'ok' });
  });
  it('tasa vencida marca el estado, no esconde el monto', () => {
    expect(precioDoble(9, { principal: 'USD', secundaria: 'VES', tasa: { ...tasa, vencida: true } })).toMatchObject({ secundario: 'Bs. 7.985,72', estado: 'vencida' });
  });
  it('sin tasa: solo principal', () => {
    expect(precioDoble(9, { principal: 'USD', secundaria: 'VES', tasa: null })).toEqual({ principal: '$9.00', secundario: null, estado: 'sin-tasa' });
  });
  it('tenant de una sola moneda no cambia (ARS)', () => {
    expect(precioDoble(1500, { principal: 'ARS' })).toEqual({ principal: '$1.500', secundario: null, estado: 'sin-secundaria' });
  });
});

describe('avisoDeTasa', () => {
  it('sin secundaria no dice nada', () => expect(avisoDeTasa(null, { principal: 'ARS' })).toBeNull());
  it('sin tasa avisa', () => expect(avisoDeTasa(null, { principal: 'USD', secundaria: 'VES' }).nivel).toBe('aviso'));
  it('vigente informa y vencida avisa "por verificar"', () => {
    const t = { rate: 887.302, fecha: '2026-11-14', vencida: false };
    expect(avisoDeTasa(t, { principal: 'USD', secundaria: 'VES' })).toEqual({ nivel: 'info', texto: '1 USD = Bs. 887,30 · tasa del 14/11/2026' });
    expect(avisoDeTasa({ ...t, vencida: true }, { principal: 'USD', secundaria: 'VES' }).texto).toMatch(/^Tasa por verificar/);
  });
});
