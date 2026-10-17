// ci-esperar: que el veredicto del CI salga con el codigo correcto.
import { describe, it, expect } from 'vitest';
import { veredicto, transcurrido } from '../../scripts/ci-esperar.mjs';

describe('veredicto', () => {
  it('sin run o en curso: no terminado', () => {
    expect(veredicto(undefined).terminado).toBe(false);
    expect(veredicto({ status: 'queued', conclusion: null }).terminado).toBe(false);
  });

  it('verde: sale 0', () => {
    const v = veredicto({ status: 'completed', conclusion: 'success' }, [{ name: 'Build', conclusion: 'success' }]);
    expect(v).toMatchObject({ terminado: true, codigo: 0 });
  });

  it('rojo: sale 1 y nombra el job que fallo', () => {
    const v = veredicto({ status: 'completed', conclusion: 'failure' }, [
      { name: 'Lint', conclusion: 'success' },
      { name: 'Security Audit', conclusion: 'failure' },
    ]);
    expect(v.codigo).toBe(1);
    expect(v.lineas).toContain('  ✗ Security Audit: failure');
  });

  // ci.yml cancela el run del commit anterior cuando entra otro push: no es
  // rojo, es que ese commit no tiene veredicto propio.
  it('cancelado: sale 2, no rojo, y dice que mirar', () => {
    const v = veredicto({ status: 'completed', conclusion: 'cancelled' });
    expect(v).toMatchObject({ terminado: true, codigo: 2 });
    expect(v.lineas.join(' ')).toMatch(/push posterior/);
  });

  it('timed_out sigue siendo rojo', () => {
    expect(veredicto({ status: 'completed', conclusion: 'timed_out' }).codigo).toBe(1);
  });
});

describe('transcurrido', () => {
  it('segundos y minutos', () => {
    expect(transcurrido(4_000)).toBe('4s');
    expect(transcurrido(95_000)).toBe('1m35s');
    expect(transcurrido(600_000)).toBe('10m00s');
  });
});
