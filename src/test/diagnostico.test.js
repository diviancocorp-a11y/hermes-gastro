import { describe, it, expect } from 'vitest';
import {
  VERTICALES, ESTABLECIMIENTOS, desafiosDe, planRecomendado, solucion, paramsDelAlta,
  ORDEN_PASOS, URGENCIAS, INVERSIONES,
} from '../lib/diagnostico';

describe('diagnostico de la landing', () => {
  it('recomienda Cadena con varias sucursales', () => {
    expect(planRecomendado({ locales: 'dos_tres' })).toBe('cadena');
    expect(planRecomendado({ locales: 'cuatro_o_mas' })).toBe('cadena');
  });

  it('recomienda Local con equipo o con otro sistema, y Digital al resto', () => {
    expect(planRecomendado({ locales: 'uno', equipo: 'de_6_a_15' })).toBe('local');
    expect(planRecomendado({ locales: 'uno', equipo: 'hasta_5', gestion_actual: 'otro_sistema' })).toBe('local');
    expect(planRecomendado({ locales: 'uno', equipo: 'hasta_5', gestion_actual: 'planillas' })).toBe('digital');
  });

  it('cada desafio de cada rubro tiene su respuesta', () => {
    for (const v of VERTICALES) {
      for (const d of desafiosDe(v.id)) {
        expect(solucion(d.id, v.id), `${v.id}/${d.id}`).toBeTruthy();
      }
    }
  });

  it('lo que no existe se dice como pendiente, no como hecho', () => {
    expect(solucion('turnos', 'servicios').pendiente).toMatch(/en desarrollo/);
    expect(solucion('stock', 'comercio').pendiente).toMatch(/en desarrollo/);
  });

  it('las recetas solo se ofrecen en gastronomia', () => {
    expect(desafiosDe('comercio').map((d) => d.id)).not.toContain('costos');
    expect(desafiosDe('servicios').map((d) => d.id)).not.toContain('costos');
  });

  it('los tipos de negocio son solo de su rubro', () => {
    expect(ESTABLECIMIENTOS.otro).toEqual([]);
    expect(ESTABLECIMIENTOS.gastronomia.map((e) => e.id)).toContain('dark_kitchen');
  });

  it('el dolor va segundo y cada uno tiene su bajada', () => {
    expect(ORDEN_PASOS.slice(0, 2)).toEqual(['vertical', 'desafio']);
    for (const v of VERTICALES) {
      for (const d of desafiosDe(v.id)) expect(d.sub, `${v.id}/${d.id}`).toBeTruthy();
    }
  });

  it('urgencia e inversion usan los mismos ids que la base (0102)', () => {
    expect(URGENCIAS.map((u) => u.id)).toEqual(['ya', 'este_mes', 'proximos_meses', 'explorando']);
    expect(INVERSIONES.map((i) => i.id)).toEqual(['gratis', 'hasta_60k', 'hasta_100k', 'mas_de_100k', 'no_se']);
  });

  it('el alta recibe el rubro del registry, el nombre y el id', () => {
    const q = new URLSearchParams(paramsDelAlta({ vertical: 'comercio', nombre_negocio: 'Monte' }, 'abc'));
    expect(q.get('rubro')).toBe('retail');
    expect(q.get('negocio')).toBe('Monte');
    expect(q.get('d')).toBe('abc');
  });
});
