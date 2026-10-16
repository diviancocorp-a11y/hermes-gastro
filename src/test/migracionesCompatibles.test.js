// check-migraciones-compatibles: que una migracion nueva no rompa al deploy
// anterior, que comparte la base y vuelve con un rollback.
import { describe, it, expect } from 'vitest';
import { hallazgos } from '../../scripts/check-migraciones-compatibles.mjs';

const mig = (archivo, sql) => ({ archivo, sql });
const que = (...migs) => hallazgos(migs).map((h) => h.que);

describe('que cuenta como romper al deploy anterior', () => {
  it('borrar una columna', () => {
    expect(que(mig('0096_x.sql', 'alter table public.a drop column if exists b;'))).toEqual(['borra una columna']);
  });

  it('renombrar una columna o una tabla', () => {
    expect(que(mig('0096_x.sql', 'alter table public.a rename column b to c;'))).toEqual(['renombra']);
    expect(que(mig('0096_x.sql', 'alter table public.a rename to z;'))).toEqual(['renombra']);
  });

  it('borrar tabla, vista, tipo o funcion', () => {
    const sql = `drop table public.a;
drop view if exists public.v;
drop type public.t;
drop function if exists public.f(uuid);`;
    expect(que(mig('0096_x.sql', sql))).toEqual([
      'borra una tabla', 'borra una vista', 'borra un tipo', 'borra una funcion o le cambia la firma',
    ]);
  });

  it('volver NOT NULL o cambiar el tipo de una columna', () => {
    const sql = `alter table public.a
  alter column b set not null,
  alter column c type text;`;
    expect(que(mig('0096_x.sql', sql))).toEqual(['vuelve NOT NULL una columna', 'cambia el tipo de una columna']);
  });

  it('agregar no rompe nada', () => {
    const sql = `alter table public.a add column b text;
create table public.n (id uuid primary key);
create or replace function public.f() returns void language sql as $$ select 1 $$;`;
    expect(que(mig('0096_x.sql', sql))).toEqual([]);
  });
});

describe('lo que no cuenta', () => {
  it('las migraciones anteriores a la regla', () => {
    expect(que(mig('0055_x.sql', 'alter table public.a drop column b;'))).toEqual([]);
  });

  it('el archivo que se declara como paso de contraer', () => {
    const sql = '-- contraer: ningun deploy desde el 1/nov lee b\nalter table public.a drop column b;';
    expect(que(mig('0096_x.sql', sql))).toEqual([]);
  });

  it('una marca vacia no aprueba', () => {
    const sql = '-- contraer:\nalter table public.a drop column b;';
    expect(que(mig('0096_x.sql', sql))).toEqual(['borra una columna']);
  });

  it('los comentarios', () => {
    const sql = '-- antes: alter table public.a drop column b;\n/* drop table public.a; */\nselect 1;';
    expect(que(mig('0096_x.sql', sql))).toEqual([]);
  });

  it('un drop dentro del cuerpo de una funcion (tabla temporal)', () => {
    const sql = `create function public.f() returns void language plpgsql as $$
begin
  drop table if exists tmp_x;
end $$;`;
    expect(que(mig('0096_x.sql', sql))).toEqual([]);
  });
});

it('un bloque do si se lee: corre en la migracion', () => {
  const sql = 'do $$ begin alter table public.a drop column b; end $$;';
  expect(que(mig('0096_x.sql', sql))).toEqual(['borra una columna']);
});

it('dice archivo y linea', () => {
  const sql = 'alter table public.a add column c text;\n\nalter table public.a drop column b;';
  expect(hallazgos([mig('0096_x.sql', sql)])).toEqual([
    { archivo: '0096_x.sql', linea: 3, que: 'borra una columna', texto: 'alter table public.a drop column b;' },
  ]);
});
