// El tag `tenant` de Sentry sale del subdominio: con el build "edificio" para
// todos, antes todos los errores decian "edificio" y no se podia filtrar por
// negocio.
import { describe, it, expect } from 'vitest';
import { tenantDelHost } from '../lib/observability.js';

describe('tenantDelHost', () => {
  it('el negocio sale del subdominio', () => {
    expect(tenantDelHost('crazy-miga.divianco.app', 'edificio')).toBe('crazy-miga');
    expect(tenantDelHost('La-Nona-Pato.divianco.app:443', 'edificio')).toBe('la-nona-pato');
  });
  it('la raiz y www son la landing', () => {
    expect(tenantDelHost('divianco.app', 'edificio')).toBe('raiz');
    expect(tenantDelHost('www.divianco.app', 'edificio')).toBe('raiz');
  });
  it('fuera de la plataforma cae al build', () => {
    expect(tenantDelHost('hermes-platform.vercel.app', 'edificio')).toBe('edificio');
    expect(tenantDelHost('localhost', '')).toBe('unknown');
    expect(tenantDelHost('admin.divianco.app', 'edificio')).toBe('edificio');
  });
});
