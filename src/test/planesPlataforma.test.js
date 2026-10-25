import { describe, expect, it } from 'vitest';
import { PLANES_COMERCIALES, PLANES_DIAGNOSTICO, precioDelPeriodo } from '../lib/planesPlataforma';

const plan = id => PLANES_COMERCIALES.find(p => p.id === id);

describe('importes públicos aprobados', () => {
  it('Digital cuesta 14.999 y conserva pago mensual al ver la modalidad anual', () => {
    expect(precioDelPeriodo(plan('digital'), false)).toEqual({ importe: 14999, periodo: 'mes', equivalente: null });
    expect(precioDelPeriodo(plan('digital'), true)).toEqual({ importe: 14999, periodo: 'mes', equivalente: null });
  });
  it('Local distingue cuota mensual, equivalente y total anual', () => {
    expect(precioDelPeriodo(plan('local'), false)).toEqual({ importe: 59000, periodo: 'mes', equivalente: null });
    expect(precioDelPeriodo(plan('local'), true)).toEqual({ importe: 566400, periodo: 'año', equivalente: 47200 });
  });
  it('Cadena muestra el total anual por local sin tratarlo como una cuota mensual', () => {
    expect(precioDelPeriodo(plan('cadena'), true)).toEqual({ importe: 950400, periodo: 'año', equivalente: 79200 });
  });
  it('el diagnóstico usa la misma oferta y Digital no se presenta como gratis', () => {
    expect(PLANES_DIAGNOSTICO.digital.precio).toBe('$14.999 por mes');
    expect(PLANES_DIAGNOSTICO.local.precio).toBe('$59.000 por mes');
    expect(PLANES_DIAGNOSTICO.cadena.precio).toBe('$99.000 por mes por local');
  });
});
