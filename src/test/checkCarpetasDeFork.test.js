// Gate de carpetas para PRs de forks (scripts/check-carpetas-de-fork.mjs).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { revisarArchivos } from '../../scripts/check-carpetas-de-fork.mjs';

const permisos = {
  disenador: { tenant: 'cochi', carpetas: ['src/catalog-pro/plantillas/cochi/'] },
};
const f = (filename, previous_filename) => ({ filename, ...(previous_filename ? { previous_filename } : {}) });

describe('revisarArchivos', () => {
  it('todo dentro de su carpeta: ok', () => {
    const r = revisarArchivos({
      login: 'disenador', permisos,
      archivos: [f('src/catalog-pro/plantillas/cochi/CochiHero.jsx'), f('src/catalog-pro/plantillas/cochi/assets/a.webp')],
    });
    expect(r).toMatchObject({ ok: true, fuera: [] });
  });

  it('un archivo afuera falla y se lista', () => {
    const r = revisarArchivos({
      login: 'disenador', permisos,
      archivos: [f('src/catalog-pro/plantillas/cochi/cochi.css'), f('src/services/catalog.js')],
    });
    expect(r.ok).toBe(false);
    expect(r.fuera).toEqual(['src/services/catalog.js']);
  });

  it('un login sin entrada falla', () => {
    const r = revisarArchivos({ login: 'cualquiera', permisos, archivos: [f('src/catalog-pro/plantillas/cochi/cochi.css')] });
    expect(r).toMatchObject({ ok: false, motivo: 'usuario no habilitado: pedile a Ricky' });
    expect(revisarArchivos({ login: 'disenador', permisos: {}, archivos: [] }).ok).toBe(false);
    // un login que coincide con una propiedad heredada de Object tampoco entra
    expect(revisarArchivos({ login: 'constructor', permisos, archivos: [] }).ok).toBe(false);
  });

  it('un renombre desde afuera hacia adentro falla (cuenta el origen)', () => {
    const r = revisarArchivos({
      login: 'disenador', permisos,
      archivos: [f('src/catalog-pro/plantillas/cochi/PopRobado.jsx', 'src/catalog-pro/plantillas/PopHero.jsx')],
    });
    expect(r.ok).toBe(false);
    expect(r.fuera).toEqual(['src/catalog-pro/plantillas/PopHero.jsx']);
  });

  it('un renombre de adentro hacia afuera falla (cuenta el destino)', () => {
    const r = revisarArchivos({
      login: 'disenador', permisos,
      archivos: [f('src/lib/algo.js', 'src/catalog-pro/plantillas/cochi/algo.js')],
    });
    expect(r.fuera).toEqual(['src/lib/algo.js']);
  });

  it('un prefijo parecido no cuenta', () => {
    const r = revisarArchivos({ login: 'disenador', permisos, archivos: [f('src/catalog-pro/plantillas/cochi-otro/x.jsx')] });
    expect(r.ok).toBe(false);
    expect(r.fuera).toEqual(['src/catalog-pro/plantillas/cochi-otro/x.jsx']);
  });

  it('un .. que escapa de la carpeta falla', () => {
    const r = revisarArchivos({ login: 'disenador', permisos, archivos: [f('src/catalog-pro/plantillas/cochi/../PopHero.jsx')] });
    expect(r.ok).toBe(false);
  });

  it('una carpeta sin barra final se trata como carpeta', () => {
    const p = { d: { carpetas: ['src/catalog-pro/plantillas/cochi'] } };
    expect(revisarArchivos({ login: 'd', permisos: p, archivos: [f('src/catalog-pro/plantillas/cochi/x.jsx')] }).ok).toBe(true);
    expect(revisarArchivos({ login: 'd', permisos: p, archivos: [f('src/catalog-pro/plantillas/cochi2/x.jsx')] }).ok).toBe(false);
  });
});

describe('scripts/disenadores.json', () => {
  it('es JSON valido, con `disenadores` y sin entradas que apunten fuera de su carpeta', () => {
    const j = JSON.parse(readFileSync(resolve(__dirname, '../../scripts/disenadores.json'), 'utf-8'));
    expect(typeof j.disenadores).toBe('object');
    for (const [login, e] of Object.entries(j.disenadores)) {
      expect(login).toMatch(/^[A-Za-z0-9-]+$/);
      expect(e.carpetas.length).toBeGreaterThan(0);
      for (const c of e.carpetas) expect(c.startsWith('src/catalog-pro/plantillas/')).toBe(true);
    }
  });
});
