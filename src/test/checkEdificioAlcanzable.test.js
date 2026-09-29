// src/test/checkEdificioAlcanzable.test.js
//
// Prueba scripts/check-edificio-alcanzable.mjs sobre un repo falso en un
// directorio temporal. Lo que importa: que siga los tres tipos de import
// (estatico, dinamico con lazy, alias), que no cuente lo que nadie importa, y
// que una funcion con un overload borrado siga viva.
//
// Los nombres de tablas y RPC son inventados: este archivo vive en src/ y el
// mapa lo recorre.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import {
  grafo, objetosDelEdificio, llamadasHuerfanas, comparar, podar,
} from '../../scripts/check-edificio-alcanzable.mjs';

const tmps = [];
function repoFalso(archivos) {
  const root = mkdtempSync(join(tmpdir(), 'alcanzable-'));
  tmps.push(root);
  for (const [ruta, texto] of Object.entries(archivos)) {
    mkdirSync(dirname(join(root, ruta)), { recursive: true });
    writeFileSync(join(root, ruta), texto, 'utf8');
  }
  return root;
}
afterAll(() => {
  for (const d of tmps) { try { rmSync(d, { recursive: true, force: true }); } catch { /* noop */ } }
});

const MIGRACIONES = {
  'platform/migrations/0001_base.sql': `
    create table public.zz_pedidos (id uuid);
    create table public.zz_vieja (id uuid);
    create or replace function public.zz_cobrar(p_id uuid) returns void language sql as $$ select 1 $$;
    create or replace function public.zz_cobrar(p_id uuid, p_nota text) returns void language sql as $$ select 1 $$;
  `,
  'platform/migrations/0002_limpieza.sql': `
    drop table if exists public.zz_vieja;
    drop function if exists public.zz_cobrar(uuid);
  `,
};

describe('check-edificio-alcanzable', () => {
  const root = repoFalso({
    ...MIGRACIONES,
    'clients/edificio/business.js': 'export default { platform: true }',
    'src/main.jsx': `
      import business from '@business'
      import App from './App.jsx'
    `,
    'src/App.jsx': `
      import { lazy } from 'react'
      import { traer } from '@dico/core/services/pedidos'
      const Panel = lazy(() => import('./pages/Panel'))
      export default App
    `,
    'src/services/pedidos.js': `
      export const traer = (s) => s.from('zz_pedidos').select('*')
      export const cobrar = (s) => s.rpc('zz_cobrar', {})
    `,
    'src/pages/Panel.jsx': `
      export default (s) => s.from('zz_vieja').select('*')
    `,
    'src/pages/Huerfana.jsx': `
      export default (s) => s.rpc('zz_inexistente')
    `,
  });

  it('sigue imports estaticos, dinamicos y alias; ignora lo que nadie importa', () => {
    const rutas = [...grafo(root).keys()].map((p) => p.slice(root.length + 1).replace(/\\/g, '/'));
    expect(rutas).toEqual(expect.arrayContaining([
      'src/main.jsx', 'src/App.jsx', 'src/services/pedidos.js', 'src/pages/Panel.jsx',
      'clients/edificio/business.js',
    ]));
    expect(rutas).not.toContain('src/pages/Huerfana.jsx');
  });

  it('una tabla borrada muere; una funcion sigue viva mientras le quede un overload', () => {
    const vivos = objetosDelEdificio(root);
    expect(vivos.has('from:zz_pedidos')).toBe(true);
    expect(vivos.has('from:zz_vieja')).toBe(false);
    expect(vivos.has('rpc:zz_cobrar')).toBe(true);
  });

  it('reporta solo lo alcanzable que el edificio no tiene', () => {
    expect(llamadasHuerfanas({ root })).toEqual({
      'src/pages/Panel.jsx': ['from:zz_vieja'],
    });
  });

  it('comparar separa lo nuevo de lo que ya se resolvio', () => {
    const { nuevas, resueltas } = comparar(
      { 'a.js': ['from:x', 'rpc:y'] },
      { 'a.js': ['from:x'], 'b.js': ['rpc:z'] },
    );
    expect(nuevas).toEqual([{ archivo: 'a.js', llamada: 'rpc:y' }]);
    expect(resueltas).toEqual([{ archivo: 'b.js', llamada: 'rpc:z' }]);
  });

  it('podar saca lo resuelto, borra archivos vacios y nunca agrega', () => {
    expect(podar(
      { 'a.js': ['from:x', 'rpc:y'], 'b.js': ['rpc:z'] },
      [{ archivo: 'a.js', llamada: 'rpc:y' }, { archivo: 'b.js', llamada: 'rpc:z' }, { archivo: 'c.js', llamada: 'from:w' }],
    )).toEqual({ 'a.js': ['from:x'] });
  });
});
