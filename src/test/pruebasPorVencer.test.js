// Pruebas de Dante por terminar: lo que morning-health avisa a la manana.
import { describe, it, expect } from 'vitest';
import { pruebasPorVencer, lineasDePruebas } from '../../scripts/pruebas-por-vencer.mjs';

const AHORA = new Date('2026-11-05T10:00:00Z');
const en = (horas) => new Date(AHORA.getTime() + horas * 3600_000).toISOString();

describe('pruebasPorVencer', () => {
  it('avisa las de Paris a 3 dias o menos, de la que vence antes a la ultima', () => {
    const filas = [
      { slug: 'lejos', plan_id: 'digital', prueba_hasta: en(24 * 5) },
      { slug: 'tres', plan_id: 'digital', prueba_hasta: en(24 * 3) },
      { slug: 'hoy', plan_id: 'digital', prueba_hasta: en(5) },
    ];
    expect(pruebasPorVencer(filas, AHORA)).toEqual([
      { slug: 'hoy', dias: 1 },
      { slug: 'tres', dias: 3 },
    ]);
  });

  it('no avisa las vencidas, las sin fecha ni las que ya pagan Dante o Magnus', () => {
    const filas = [
      { slug: 'vencida', plan_id: 'digital', prueba_hasta: en(-2) },
      { slug: 'sin-fecha', plan_id: 'digital', prueba_hasta: null },
      { slug: 'dante', plan_id: 'local', prueba_hasta: en(10) },
      { slug: 'sin-plan', plan_id: null, prueba_hasta: en(10) },
    ];
    expect(pruebasPorVencer(filas, AHORA)).toEqual([]);
  });
});

describe('lineasDePruebas', () => {
  it('sin pruebas por terminar no agrega nada', () => {
    expect(lineasDePruebas([])).toEqual([]);
  });

  it('dice cuanto le queda a cada una', () => {
    expect(lineasDePruebas([{ slug: 'hoy', dias: 1 }, { slug: 'tres', dias: 3 }])).toEqual([
      '⏳ *Pruebas de Dante por terminar*',
      '• hoy: termina hoy o mañana',
      '• tres: le quedan 3 días',
    ]);
  });
});
