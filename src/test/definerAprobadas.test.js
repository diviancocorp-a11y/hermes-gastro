// check-definer-aprobadas: que una SECURITY DEFINER nueva no llegue al
// edificio sin que alguien haya mirado que se cuida sola.
import { describe, it, expect } from 'vitest';
import {
  estadoDeFunciones, definerLlamables, sinAprobar,
} from '../../scripts/check-definer-aprobadas.mjs';

const mig = (archivo, sql) => ({ archivo, sql });
const llamables = (...migs) => definerLlamables(estadoDeFunciones(migs));

const DEFINER = (nombre, args = 'p_tenant_id uuid') => `
create or replace function public.${nombre}(${args})
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tenant_id not in (select private.current_user_tenants()) then raise exception 'no'; end if;
end $$;`;

describe('que funciones cuenta como llamables desde el front', () => {
  it('una definer de public, sin revoke: llamable', () => {
    expect(llamables(mig('0001.sql', DEFINER('cobrar')))).toEqual(['cobrar']);
  });

  it('una invoker no cuenta: la cuida el RLS de las tablas', () => {
    const sql = 'create function public.leer(p uuid) returns void language sql as $$ select 1 $$;';
    expect(llamables(mig('0001.sql', sql))).toEqual([]);
  });

  it('las de trigger no cuentan: PostgREST no las expone', () => {
    const sql = `create function public.auditar() returns trigger language plpgsql
      security definer as $$ begin return new; end $$;`;
    expect(llamables(mig('0001.sql', sql))).toEqual([]);
  });

  it('las de private no cuentan', () => {
    const sql = DEFINER('cobrar').replace('public.cobrar', 'private.cobrar');
    expect(llamables(mig('0001.sql', sql))).toEqual([]);
  });

  it('revocada de public, anon y authenticated: fuera del front', () => {
    const sql = DEFINER('interna') + '\nrevoke all on function public.interna(uuid) from public, anon, authenticated;';
    expect(llamables(mig('0001.sql', sql))).toEqual([]);
  });

  it('revocada solo de anon SIGUE llamable: authenticated la hereda de PUBLIC (0076)', () => {
    const sql = DEFINER('interna') + '\nrevoke execute on function public.interna(uuid) from anon;';
    expect(llamables(mig('0001.sql', sql))).toEqual(['interna']);
  });

  it('los revokes se suman aunque vengan en sentencias o archivos distintos', () => {
    expect(llamables(
      mig('0001.sql', DEFINER('interna') + '\nrevoke all on function public.interna(uuid) from public;'),
      mig('0002.sql', 'revoke execute on function public.interna(uuid) from anon, authenticated;'),
    )).toEqual([]);
  });

  it('volver a crearla despues de un revoke la reabre', () => {
    expect(llamables(
      mig('0001.sql', DEFINER('interna') + '\nrevoke all on function public.interna(uuid) from public, anon, authenticated;'),
      mig('0002.sql', DEFINER('interna')),
    )).toEqual(['interna']);
  });

  it('un drop la saca', () => {
    expect(llamables(
      mig('0001.sql', DEFINER('vieja')),
      mig('0002.sql', 'drop function if exists public.vieja(uuid);'),
    )).toEqual([]);
  });

  it('dropear UNA firma deja la otra (sumar_staff tiene dos)', () => {
    expect(llamables(
      mig('0001.sql', DEFINER('sumar', 'p_email text')),
      mig('0002.sql', DEFINER('sumar', 'p_email text, p_puesto text')),
      mig('0003.sql', 'drop function if exists public.sumar(text);'),
    )).toEqual(['sumar']);
  });

  it('mudarla a private con set schema la saca (0002 con current_user_tenants)', () => {
    expect(llamables(
      mig('0001.sql', DEFINER('ayuda', '')),
      mig('0002.sql', 'alter function public.ayuda() set schema private;'),
    )).toEqual([]);
  });

  it('un security definer escrito en un comentario no cuenta', () => {
    const sql = `-- ojo: no es security definer
      create function public.leer(p uuid) returns void language sql as $$ select 1 $$;`;
    expect(llamables(mig('0001.sql', sql))).toEqual([]);
  });
});

describe('la aprobacion', () => {
  it('una llamable sin aprobar se reporta con su archivo', () => {
    const firmas = estadoDeFunciones([mig('0067_caja.sql', DEFINER('force_close'))]);
    expect(sinAprobar(firmas, {})).toEqual([{ nombre: 'force_close', archivo: '0067_caja.sql' }]);
  });

  it('una aprobada pasa', () => {
    const firmas = estadoDeFunciones([mig('0067_caja.sql', DEFINER('force_close'))]);
    expect(sinAprobar(firmas, { force_close: { tipo: 'se_cuida', porque: 'x' } })).toEqual([]);
  });
});
