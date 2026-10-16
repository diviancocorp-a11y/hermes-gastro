// ci-esperar: que el veredicto del CI salga con el codigo correcto.
import { describe, it, expect } from 'vitest';
import { veredicto } from '../../scripts/ci-esperar.mjs';

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

  it('cancelado cuenta como rojo', () => {
    expect(veredicto({ status: 'completed', conclusion: 'cancelled' }).codigo).toBe(1);
  });
});
