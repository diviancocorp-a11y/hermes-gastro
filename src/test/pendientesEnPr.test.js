// pendientes-en-pr: que morning-health nombre lo que falta y en que PR esta.
// Las salidas son las reales del 29/oct (0113 esperando en el PR 54).
import { describe, it, expect } from 'vitest';
import {
  nombresDelDrift, nombresSinArchivo, buscarEnPrs, listarConPr,
} from '../../scripts/pendientes-en-pr.mjs';

const DRIFT = [
  '\x1b[31m✗\x1b[0m get_available_slots: ninguna firma desplegada coincide con 0110_agenda_zonas_y_adicionales.sql',
  '  repo       … 62 dias\';end if;…',
  '\x1b[31m✗\x1b[0m get_catalog: ninguna firma desplegada coincide con 0112_get_catalog_emite_reserva_online.sql',
  '\x1b[31m✗\x1b[0m vieja_fn(uuid, text): desplegada y ninguna migracion la deja viva',
  '\x1b[32m✓\x1b[0m 87 firma(s) de public: las mismas en la base y en el repo',
  '',
  '\x1b[31m✗\x1b[0m 2 funcion(es) con drift entre el repo y la base',
].join('\n');

const SIN_ARCHIVO = [
  '✗ 2 migracion(es) aplicada(s) al edificio sin archivo en platform/migrations:',
  '    slots_para_el_servicio',
  '    catalogo_por_rubro',
  '',
  '  El repo dice que corre otra cosa. Traer el SQL y escribir el archivo:',
  "    select statements from supabase_migrations.schema_migrations where name = '<nombre>';",
].join('\n');

const PRS = [
  { number: 52, files: [{ filename: 'src/landing/Hero.jsx', patch: 'function get_catalog(' }] },
  {
    number: 54,
    files: [{
      filename: 'platform/migrations/0113_slots_para_el_servicio.sql',
      patch: '+create or replace function public.get_available_slots(\n+  p_tenant_id uuid',
    }],
  },
];

describe('nombresDelDrift', () => {
  it('saca los nombres sin ANSI ni argumentos, y no el resumen', () => {
    expect(nombresDelDrift(DRIFT)).toEqual(['get_available_slots', 'get_catalog', 'vieja_fn']);
  });

  it('sin lineas de drift, nada', () => {
    expect(nombresDelDrift('✓ todo bien')).toEqual([]);
  });
});

describe('nombresSinArchivo', () => {
  it('lee la lista y frena en la linea en blanco', () => {
    expect(nombresSinArchivo(SIN_ARCHIVO)).toEqual(['slots_para_el_servicio', 'catalogo_por_rubro']);
  });

  it('sin encabezado, nada', () => {
    expect(nombresSinArchivo('✓ 128 migraciones aplicadas')).toEqual([]);
  });
});

describe('buscarEnPrs', () => {
  const donde = buscarEnPrs(
    { funciones: ['get_available_slots', 'get_catalog'], migraciones: ['slots_para_el_servicio', 'catalogo_por_rubro'] },
    PRS,
  );

  it('la migracion por nombre de archivo, sin el numero', () => {
    expect(donde.get('slots_para_el_servicio')).toBe(54);
  });

  it('la funcion por su create function en el patch', () => {
    expect(donde.get('get_available_slots')).toBe(54);
  });

  it('solo mira platform/migrations: un .jsx que la nombra no cuenta', () => {
    expect(donde.has('get_catalog')).toBe(false);
    expect(donde.has('catalogo_por_rubro')).toBe(false);
  });
});

describe('listarConPr', () => {
  it('nombres en code y el PR cuando lo hay', () => {
    expect(listarConPr(['get_available_slots', 'get_catalog'], new Map([['get_available_slots', 54]])))
      .toBe('`get_available_slots` (en el PR #54, falta mergear), `get_catalog`');
  });
});
