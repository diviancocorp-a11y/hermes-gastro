// Redondeo por moneda y tasa congelada (Cochi fase 5): logica pura de
// platform/functions/submit-order/montos.ts y su espejo del front, src/lib/moneda.js.
import { describe, it, expect } from 'vitest';
import * as srv from '../../platform/functions/submit-order/montos.ts';
import * as fe from '../lib/moneda.js';

describe('redondearMoneda', () => {
  it('ARS (o sin moneda) = Math.round de siempre, en cliente y servidor', () => {
    for (const n of [0, 0.4, 0.5, 1.5, 2.5, 99.99, 1234.567, 10000 * 0.15]) {
      for (const m of ['ARS', null, undefined, '']) {
        expect(srv.redondearMoneda(n, m)).toBe(Math.round(n));
        expect(fe.redondearMoneda(n, m)).toBe(Math.round(n));
      }
    }
  });
  it('USD y VES conservan los centavos (la mitad sube)', () => {
    expect(srv.redondearMoneda(9.5 * 0.1, 'USD')).toBe(0.95);
    expect(srv.redondearMoneda(1.005, 'USD')).toBe(1.01);
    expect(srv.redondearMoneda(7985.724, 'VES')).toBe(7985.72);
    for (const n of [0.95, 1.005, 7985.724, 12.345, 0, 3]) {
      expect(fe.redondearMoneda(n, 'USD')).toBe(srv.redondearMoneda(n, 'USD'));
    }
  });
  it('cerrarTotal: ARS queda como sale, el resto a 2 decimales', () => {
    expect(srv.cerrarTotal(10.1 + 20.2, 'ARS')).toBe(10.1 + 20.2);
    expect(srv.cerrarTotal(10.1 + 20.2, 'USD')).toBe(30.3);
  });
});

describe('tasa', () => {
  const HOY = new Date('2026-11-16T15:00:00Z');
  it('tasaVencida del servidor == la del front (3 dias calendario, zona del local)', () => {
    for (const f of ['2026-11-16', '2026-11-13', '2026-11-12', '2026-11-01', null, '', 'x']) {
      expect(srv.tasaVencida(f, HOY, 'America/Caracas')).toBe(fe.tasaVencida(f, HOY, 'America/Caracas'));
    }
    expect(srv.tasaVencida('2026-11-13', HOY)).toBe(false);
    expect(srv.tasaVencida('2026-11-12', HOY)).toBe(true);
  });
  it('elegirTasa: la mas reciente; a igual fecha la manual; ignora tasas invalidas', () => {
    expect(srv.elegirTasa([])).toBeNull();
    expect(srv.elegirTasa([{ rate: 0, effective_date: '2026-11-16' }])).toBeNull();
    const t = srv.elegirTasa([
      { rate: 450, effective_date: '2026-11-15', source: 'manual', created_at: '2026-11-15T10:00:00Z' },
      { rate: 455, effective_date: '2026-11-16', source: 'bcv', created_at: '2026-11-16T09:00:00Z' },
      { rate: 456, effective_date: '2026-11-16', source: 'manual', created_at: '2026-11-16T08:00:00Z' },
    ]);
    expect(t).toEqual({ rate: 456, fecha: '2026-11-16' });
  });
  it('congelarTasa: total_secondary con la tasa; vencida se congela y avisa; sin tasa = null', () => {
    expect(srv.congelarTasa(10, { rate: 798.5724, fecha: '2026-11-16' }, 'VES', HOY))
      .toEqual({ fx_rate: 798.5724, fx_currency: 'VES', total_secondary: 7985.72, fecha: '2026-11-16', estado: 'ok' });
    expect(srv.congelarTasa(10, { rate: 100, fecha: '2026-11-01' }, 'VES', HOY)?.estado).toBe('vencida');
    expect(srv.congelarTasa(10, null, 'VES', HOY)).toBeNull();
  });
});

describe('detalles de una cuenta de pago', () => {
  it('limpiarDetalles recorta, descarta lo que no es texto y tope de 6', () => {
    const lista = Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, value: `V${i}` }));
    expect(srv.limpiarDetalles(lista)).toHaveLength(6);
    expect(srv.limpiarDetalles([{ label: 'Banco', value: '  0102 ' }, { label: 5, value: 'x' }, { label: 'a', value: '' }, null]))
      .toEqual([{ label: 'Banco', value: '0102' }]);
    expect(srv.limpiarDetalles('no')).toEqual([]);
    expect(srv.limpiarMoneda('VES')).toBe('VES');
    expect(srv.limpiarMoneda('ves')).toBeNull();
    expect(srv.limpiarMoneda(3)).toBeNull();
  });
});
