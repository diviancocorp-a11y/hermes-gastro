// src/test/mapa.test.js
//
// Prueba scripts/mapa.mjs sin tocar el repo real: migraciones y codigo falsos
// en un directorio temporal.
//
// Lo que mas importa es `firmasVivas`: si se equivoca, el mapa marca como
// vigente una definicion que un drop ya saco, o calla un overload vivo, que es
// el error que falla en runtime y no al desplegar.
//
// Los nombres de los fixtures son inventados a proposito: este archivo vive en
// src/, que el mapa recorre, y un nombre real apareceria como llamada suya.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import {
  firma, definicionesEn, firmasVivas, llamadasEn, indexar, mapear, sugerencias, resumen, esTest,
} from '../../scripts/mapa.mjs';

const tmps = [];
function repoFalso(archivos) {
  const root = mkdtempSync(join(tmpdir(), 'mapa-'));
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

const OPCIONES = {
  bases: [
    { lado: 'edificio', dir: 'platform/migrations' },
    { lado: 'legacy', dir: 'supabase/migrations' },
  ],
  codigo: ['src', 'supabase/functions'],
};

describe('firma', () => {
  it('se queda con los tipos: el nombre del parametro y el default no cuentan', () => {
    expect(firma('p_tenant_id uuid, p_sector_id uuid default null')).toBe('uuid, uuid');
    expect(firma('p_x integer = 0')).toBe('integer');
  });

  it('la forma del drop (solo tipos) da la misma firma que la del create', () => {
    expect(firma('uuid, uuid')).toBe(firma('p_a uuid,\n  p_b  uuid'));
  });

  it('los OUT no son parte de la firma, los IN si', () => {
    expect(firma('in p_a text, out total numeric')).toBe('text');
  });

  it('entiende tipos de varias palabras, con y sin nombre', () => {
    expect(firma('timestamp with time zone')).toBe('timestamp with time zone');
    expect(firma('p_desde timestamp with time zone')).toBe('timestamp with time zone');
    expect(firma('p_monto double precision')).toBe('double precision');
  });

  it('normaliza alias y typmods, que Postgres ignora al identificar la funcion', () => {
    expect(firma('p_a timestamptz, p_b numeric(10,2), p_c int')).toBe('timestamp with time zone, numeric, integer');
    expect(firma('p_ids uuid[]')).toBe('uuid[]');
  });

  it('sin argumentos es la firma vacia, no null', () => {
    expect(firma('')).toBe('');
    expect(firma(null)).toBe(null);
  });
});

describe('definicionesEn', () => {
  it('encuentra funciones, tablas y vistas con su linea', () => {
    const sql = [
      'create table if not exists public.mesas_demo (id uuid);',
      'alter table public.mesas_demo enable row level security;',
      'create or replace function public.abrir_mesa_demo(p_id uuid)',
      'returns void language sql as $$ select 1 $$;',
      'create view private.vista_demo as select 1;',
    ].join('\n');
    const ev = definicionesEn(sql, '0001_x.sql');
    expect(ev.map((e) => [e.tipo, e.accion, e.nombre, e.linea])).toEqual([
      ['tabla', 'crea', 'mesas_demo', 1],
      ['tabla', 'altera', 'mesas_demo', 2],
      ['funcion', 'crea', 'abrir_mesa_demo', 3],
      ['vista', 'crea', 'vista_demo', 5],
    ]);
    expect(ev[3].esquema).toBe('private');
  });

  it('lo que esta comentado no cuenta como definicion', () => {
    const sql = '-- create table public.fantasma_demo (id int);\n/* drop function x_demo(); */\nselect 1;';
    expect(definicionesEn(sql, '0002_x.sql')).toEqual([]);
  });

  it('un drop sin parentesis queda sin firma', () => {
    const [ev] = definicionesEn('drop function if exists public.vieja_demo;', '0003_x.sql');
    expect(ev).toMatchObject({ accion: 'borra', nombre: 'vieja_demo', firma: null });
  });
});

describe('firmasVivas', () => {
  const crea = (firmaStr, archivo) => ({ tipo: 'funcion', accion: 'crea', firma: firmaStr, archivo });
  const borra = (firmaStr) => ({ tipo: 'funcion', accion: 'borra', firma: firmaStr });

  it('agregar un argumento sin dropear la anterior deja DOS firmas vivas', () => {
    const vivas = firmasVivas([crea('uuid, uuid', 'a'), crea('uuid, uuid, uuid', 'b')]);
    expect(vivas.map((v) => v.firma)).toEqual(['uuid, uuid', 'uuid, uuid, uuid']);
  });

  it('con el drop de la vieja queda una sola, la ultima', () => {
    const vivas = firmasVivas([crea('uuid, uuid', 'a'), borra('uuid, uuid'), crea('uuid, uuid, uuid', 'b')]);
    expect(vivas).toHaveLength(1);
    expect(vivas[0].archivo).toBe('b');
  });

  it('create or replace con la misma firma reemplaza, no suma', () => {
    const vivas = firmasVivas([crea('text', 'a'), crea('text', 'b')]);
    expect(vivas.map((v) => v.archivo)).toEqual(['b']);
  });

  it('un drop sin argumentos se lleva la que habia', () => {
    expect(firmasVivas([crea('text', 'a'), borra(null)])).toEqual([]);
  });
});

describe('llamadasEn', () => {
  it('encuentra rpc, rpc por REST y from, con su linea', () => {
    const src = [
      "await supabase.rpc('cobrar_demo', { a: 1 });",
      "fetch(`${url}/rest/v1/rpc/snapshot_demo`);",
      "supabase.from('mesas_demo').select('id');",
    ].join('\n');
    expect(llamadasEn(src, 'x.js').map((l) => [l.nombre, l.via, l.linea])).toEqual([
      ['cobrar_demo', 'rpc', 1],
      ['snapshot_demo', 'rpc', 2],
      ['mesas_demo', 'from', 3],
    ]);
  });

  it('un bucket de storage no es una tabla', () => {
    const src = "supabase.storage\n  .from('logos_demo').upload(x);";
    expect(llamadasEn(src, 'x.js')).toEqual([]);
  });

  it('una llamada comentada no cuenta', () => {
    expect(llamadasEn("// supabase.rpc('vieja_demo')", 'x.js')).toEqual([]);
  });
});

describe('mapear sobre un repo falso', () => {
  const root = repoFalso({
    'platform/migrations/0001_mesas.sql':
      'create or replace function public.cerrar_bandeja_demo(p_t uuid, p_o uuid)\nreturns void language sql as $$ select 1 $$;\n',
    'platform/migrations/0002_sector.sql': [
      'drop function if exists public.cerrar_bandeja_demo(uuid, uuid);',
      'create or replace function public.cerrar_bandeja_demo(p_t uuid, p_o uuid, p_s uuid default null)',
      'returns void language sql as $$ select 1 $$;',
      'grant execute on function public.cerrar_bandeja_demo(uuid, uuid, uuid) to authenticated;',
    ].join('\n'),
    'supabase/migrations/000_initial.sql': 'create table public.bandejas_demo (id int);\n',
    'src/services/kds.js': "supabase.rpc('cerrar_bandeja_demo', args);\nsupabase.rpc('sin_migracion_demo');\n",
    'src/test/kds.test.js': "supabase.rpc('solo_en_mock_demo');\n",
    'supabase/functions/legacy/index.ts': "db.from('bandejas_demo').select('*');\n",
  });
  const indice = indexar({ root, ...OPCIONES });

  it('marca como vigente la firma que sobrevive al drop', () => {
    const r = mapear(indice, 'public.cerrar_bandeja_demo');
    const edificio = r.lados.find((l) => l.lado === 'edificio');
    expect(edificio.eventos.map((e) => e.accion)).toEqual(['crea', 'borra', 'crea']);
    expect(edificio.vivas).toHaveLength(1);
    expect(edificio.vivas[0]).toMatchObject({ archivo: '0002_sector.sql', firma: 'uuid, uuid, uuid', linea: 2 });
    expect(edificio.menciones).toEqual([{ archivo: '0002_sector.sql', linea: 4 }]);
    expect(r.llamadas).toEqual([{ nombre: 'cerrar_bandeja_demo', via: 'rpc', archivo: 'src/services/kds.js', linea: 1 }]);
  });

  it('cada base se reporta por su lado', () => {
    const r = mapear(indice, 'bandejas_demo');
    expect(r.lados.find((l) => l.lado === 'edificio').eventos).toEqual([]);
    expect(r.lados.find((l) => l.lado === 'legacy').eventos).toHaveLength(1);
    expect(r.llamadas[0].archivo).toBe('supabase/functions/legacy/index.ts');
  });

  it('sin match exacto no inventa: sugiere por substring', () => {
    const r = mapear(indice, 'bandeja');
    expect(r.encontrado).toBe(false);
    expect(sugerencias(indice, 'bandeja')).toEqual(['bandejas_demo', 'cerrar_bandeja_demo']);
  });

  it('el resumen marca la RPC sin migracion, pero no la que solo llama un mock', () => {
    const s = resumen(indice);
    expect(s.huerfanas.map((h) => h.nombre)).toEqual(['sin_migracion_demo']);
    expect(s.overloads).toEqual([]);
  });
});

describe('esTest', () => {
  it('reconoce tests y e2e, y no confunde servicios', () => {
    expect(esTest('src/test/kds.test.js')).toBe(true);
    expect(esTest('e2e/qa-lite/x.mjs')).toBe(true);
    expect(esTest('platform/tests/isolation_e2e.mjs')).toBe(true);
    expect(esTest('src/services/kds.js')).toBe(false);
  });
});
