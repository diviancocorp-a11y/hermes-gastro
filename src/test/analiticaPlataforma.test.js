import { describe, it, expect } from 'vitest';
import { analiticaHabilitada } from '../lib/analiticaPlataforma';

// El plan Hobby de Vercel trae 50.000 eventos por mes para toda la cuenta:
// si la analitica se cargara en los catalogos de los tenants, se los comerian.
describe('analiticaHabilitada', () => {
  it('se carga en la raiz de la plataforma', () => {
    expect(analiticaHabilitada('divianco.app', true)).toBe(true);
    expect(analiticaHabilitada('www.divianco.app', true)).toBe(true);
  });

  it('se carga en los previews de Vercel', () => {
    expect(analiticaHabilitada('hermes-platform-abc.vercel.app', true)).toBe(true);
  });

  it('no se carga en el catalogo de un tenant', () => {
    expect(analiticaHabilitada('crazy-miga.divianco.app', true)).toBe(false);
  });

  it('no se carga en subdominios reservados ni dominios ajenos', () => {
    expect(analiticaHabilitada('demo.divianco.app', true)).toBe(false);
    expect(analiticaHabilitada('minegocio.com.ar', true)).toBe(false);
  });

  it('no se carga en local ni fuera de produccion', () => {
    expect(analiticaHabilitada('localhost', true)).toBe(false);
    expect(analiticaHabilitada('divianco.app', false)).toBe(false);
  });
});
