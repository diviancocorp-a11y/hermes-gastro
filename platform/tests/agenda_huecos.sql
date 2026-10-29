-- Test de la 0109, 0110 y 0113: get_available_slots (huecos libres de la agenda).
-- Correr cada vez que se toque la funcion, staff_schedules, staff_time_off,
-- staff_services, booking_settings o las columnas nuevas de appointments.
--
-- No deja nada en la base: todo corre en un solo DO que TERMINA SIEMPRE EN
-- ERROR a proposito, y el error deshace la siembra entera. El resultado viene
-- en el mensaje del error:
--   'AGENDA_HUECOS 20/20 ok'                  -> verde
--   'AGENDA_HUECOS 18/20 ok | margen (...)'   -> lo que fallo
--
-- Correr: pegar en el SQL editor, o via MCP execute_sql.
-- Para probar la migracion ANTES de aplicarla, reemplazar la linea
-- @@MIGRACION@@ por `execute $mig$ <cuerpo de la 0109> $mig$;`.
--
-- La funcion usa now() (anticipacion minima), que no se puede fijar: por eso
-- todos los dias de prueba son d = hoy + 7 (siempre dentro de la ventana de 60
-- dias y mas alla de las 2 h de anticipacion) y el chequeo de anticipacion usa
-- el dia de hoy aparte.

do $test$
declare
  t    uuid := gen_random_uuid();
  u    uuid := gen_random_uuid();
  sa   uuid := gen_random_uuid();   -- profesional A
  sb   uuid := gen_random_uuid();   -- profesional B
  svc  uuid := gen_random_uuid();   -- servicio 60 min, sin margen
  svm  uuid := gen_random_uuid();   -- servicio 60 min, margen 30
  tz   text := 'America/Argentina/Buenos_Aires';
  d    date := current_date + 7;
  wd   int  := extract(dow from current_date + 7)::int;
  got  text;
  n    int;
  total int := 0;
  fallas text[] := '{}';
  ap   uuid;
begin
  -- @@MIGRACION@@

  perform set_config('timezone', 'UTC', true);

  /* ── Siembra ── */
  insert into public.tenants (id, slug, name, vertical)
    values (t, 'zz-prueba-0109-' || substr(t::text, 1, 8), 'Prueba 0109', 'barber');
  update public.tenants set timezone = tz where id = t;
  insert into public.tenant_members (tenant_id, user_id, role, roles)
    values (t, u, 'owner', array['owner']);

  insert into public.products (id, tenant_id, type, name, price, duration_min, buffer_after_min) values
    (svc, t, 'service', 'Corte', 1000, 60, 0),
    (svm, t, 'service', 'Color',  2000, 60, 30);
  insert into public.staff (id, tenant_id, name) values (sa, t, 'A'), (sb, t, 'B');

  insert into public.booking_settings (tenant_id, slot_step_min, min_notice_min)
    values (t, 30, 120);

  -- Como el servicio que reserva el panel (sin service_role no hay datos).
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  /* 1. Sin horario cargado no hay huecos. */
  select count(*) into n from public.get_available_slots(t, svc, d, d);
  total := total + 1; if n <> 0 then
    fallas := fallas || format('sin horario (%s hueco(s))', n); end if;

  /* 2. Horario 10-13, servicio de 60, paso 30: el ultimo arranca a las 12. */
  insert into public.staff_schedules (tenant_id, staff_id, weekday, start_time, end_time)
    values (t, sa, wd, '10:00', '13:00');
  select string_agg(to_char(starts_at at time zone tz, 'HH24:MI'), ',' order by starts_at) into got
    from public.get_available_slots(t, svc, d, d, sa);
  total := total + 1; if got is distinct from '10:00,10:30,11:00,11:30,12:00' then
    fallas := fallas || format('grilla (%s)', got); end if;

  /* 3. Un turno 11-12: quedan 10:00 (pegado, permitido) y 12:00. */
  insert into public.appointments (id, tenant_id, staff_id, service_id, starts_at, ends_at)
    values (gen_random_uuid(), t, sa, svc,
            (d + time '11:00') at time zone tz, (d + time '12:00') at time zone tz);
  select string_agg(to_char(starts_at at time zone tz, 'HH24:MI'), ',' order by starts_at) into got
    from public.get_available_slots(t, svc, d, d, sa);
  total := total + 1; if got is distinct from '10:00,12:00' then
    fallas := fallas || format('turno (%s)', got); end if;

  /* 4. Un turno cancelado no bloquea. */
  update public.appointments set status = 'cancelled' where staff_id = sa;
  select count(*) into n from public.get_available_slots(t, svc, d, d, sa);
  total := total + 1; if n <> 5 then
    fallas := fallas || format('cancelado (%s hueco(s), esperaba 5)', n); end if;

  /* 5. Un no_show SI bloquea (igual que el EXCLUDE de staff). */
  update public.appointments set status = 'no_show' where staff_id = sa;
  select count(*) into n from public.get_available_slots(t, svc, d, d, sa);
  total := total + 1; if n <> 2 then
    fallas := fallas || format('no_show (%s hueco(s), esperaba 2)', n); end if;
  delete from public.appointments where staff_id = sa;

  /* 6. Ausencia de la profesional 10:30-11:30: quedan 11:30 y 12:00. */
  insert into public.staff_time_off (tenant_id, staff_id, starts_at, ends_at)
    values (t, sa, (d + time '10:30') at time zone tz, (d + time '11:30') at time zone tz);
  select string_agg(to_char(starts_at at time zone tz, 'HH24:MI'), ',' order by starts_at) into got
    from public.get_available_slots(t, svc, d, d, sa);
  total := total + 1; if got is distinct from '11:30,12:00' then
    fallas := fallas || format('ausencia (%s)', got); end if;
  delete from public.staff_time_off where tenant_id = t;

  /* 7. Cierre de todo el negocio (staff_id nulo) tambien bloquea. */
  insert into public.staff_time_off (tenant_id, staff_id, starts_at, ends_at)
    values (t, null, (d + time '00:00') at time zone tz, (d + time '23:59') at time zone tz);
  select count(*) into n from public.get_available_slots(t, svc, d, d, sa);
  total := total + 1; if n <> 0 then
    fallas := fallas || format('cierre del negocio (%s hueco(s))', n); end if;
  delete from public.staff_time_off where tenant_id = t;

  /* 8. Margen: horario 10-15, turno 11-12 de un servicio con margen 30 (ocupa
        hasta 12:30). Un corte sin margen entra a las 10:00 (pegado) y desde
        las 12:30. */
  delete from public.staff_schedules where tenant_id = t;
  insert into public.staff_schedules (tenant_id, staff_id, weekday, start_time, end_time)
    values (t, sa, wd, '10:00', '15:00');
  insert into public.appointments (tenant_id, staff_id, service_id, starts_at, ends_at)
    values (t, sa, svm,
            (d + time '11:00') at time zone tz, (d + time '12:00') at time zone tz);
  select string_agg(to_char(starts_at at time zone tz, 'HH24:MI'), ',' order by starts_at) into got
    from public.get_available_slots(t, svc, d, d, sa);
  total := total + 1; if got is distinct from '10:00,12:30,13:00,13:30,14:00' then
    fallas := fallas || format('margen del turno existente (%s)', got); end if;

  /* 9. Margen del servicio que se reserva: el color (margen 30) no puede
        arrancar a las 10:00 porque terminaria 11:00 + 30 = 11:30 sobre el turno. */
  select string_agg(to_char(starts_at at time zone tz, 'HH24:MI'), ',' order by starts_at) into got
    from public.get_available_slots(t, svm, d, d, sa);
  total := total + 1; if got is distinct from '12:30,13:00,13:30,14:00' then
    fallas := fallas || format('margen del servicio (%s)', got); end if;
  delete from public.appointments where staff_id = sa;

  /* 10. Domicilio apagado: no hay huecos a domicilio. Prendido (traslado 30)
         con un turno LOCAL 11-12 en horario 10-14: antes no entra (hay que volver
         al local), despues desde las 12:30. En el local: 10:00, 12:00, 12:30, 13:00. */
  delete from public.staff_schedules where tenant_id = t;
  insert into public.staff_schedules (tenant_id, staff_id, weekday, start_time, end_time)
    values (t, sa, wd, '10:00', '14:00');
  insert into public.appointments (tenant_id, staff_id, service_id, starts_at, ends_at)
    values (t, sa, svc,
            (d + time '11:00') at time zone tz, (d + time '12:00') at time zone tz);
  select count(*) into n from public.get_available_slots(t, svc, d, d, sa, 'home');
  total := total + 1; if n <> 0 then
    fallas := fallas || format('domicilio apagado (%s hueco(s))', n); end if;

  update public.booking_settings set offers_home = true, travel_min = 30 where tenant_id = t;
  select string_agg(to_char(starts_at at time zone tz, 'HH24:MI'), ',' order by starts_at) into got
    from public.get_available_slots(t, svc, d, d, sa, 'home');
  total := total + 1; if got is distinct from '12:30,13:00' then
    fallas := fallas || format('domicilio con traslado (%s)', got); end if;

  select string_agg(to_char(starts_at at time zone tz, 'HH24:MI'), ',' order by starts_at) into got
    from public.get_available_slots(t, svc, d, d, sa, 'local');
  total := total + 1; if got is distinct from '10:00,12:00,12:30,13:00' then
    fallas := fallas || format('local con domicilio prendido (%s)', got); end if;
  /* 10b. El traslado de la zona pisa el fijo (0110): 0 min = como en el local
         pero a domicilio; 60 min deja solo el ultimo hueco. */
  select string_agg(to_char(starts_at at time zone tz, 'HH24:MI'), ',' order by starts_at) into got
    from public.get_available_slots(t, svc, d, d, sa, 'home', 0);
  total := total + 1; if got is distinct from '10:00,12:00,12:30,13:00' then
    fallas := fallas || format('traslado de zona 0 (%s)', got); end if;
  select string_agg(to_char(starts_at at time zone tz, 'HH24:MI'), ',' order by starts_at) into got
    from public.get_available_slots(t, svc, d, d, sa, 'home', 60);
  total := total + 1; if got is distinct from '13:00' then
    fallas := fallas || format('traslado de zona 60 (%s)', got); end if;
  delete from public.appointments where staff_id = sa;

  /* 11. staff_services: el servicio solo lo hace B -> A no aparece. */
  insert into public.staff_schedules (tenant_id, staff_id, weekday, start_time, end_time)
    values (t, sb, wd, '10:00', '14:00');
  insert into public.staff_services (tenant_id, staff_id, service_id) values (t, sb, svc);
  select count(*) into n from public.get_available_slots(t, svc, d, d) where staff_id = sa;
  total := total + 1; if n <> 0 then
    fallas := fallas || format('staff_services excluye a A (%s)', n); end if;
  select count(*) into n from public.get_available_slots(t, svc, d, d) where staff_id = sb;
  total := total + 1; if n = 0 then
    fallas := fallas || 'staff_services incluye a B (0)'; end if;

  /* 12. Anticipacion minima: hoy con horario todo el dia no ofrece nada antes
         de ahora + 120 min. */
  delete from public.staff_services where tenant_id = t;
  delete from public.staff_schedules where tenant_id = t;
  insert into public.staff_schedules (tenant_id, staff_id, weekday, start_time, end_time)
    select t, sa, w, '00:00', '23:30' from generate_series(0, 6) w;
  select count(*) into n from public.get_available_slots(t, svc, current_date - 1, current_date + 1, sa)
   where starts_at < now() + interval '120 minutes';
  total := total + 1; if n <> 0 then
    fallas := fallas || format('anticipacion minima (%s hueco(s) antes de tiempo)', n); end if;

  /* 13. Sin service_role y sin ser miembro: no devuelve nada (y no rompe). */
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  select count(*) into n from public.get_available_slots(t, svc, d, d, sa);
  total := total + 1; if n <> 0 then
    fallas := fallas || format('aislamiento (%s hueco(s) a un ajeno)', n); end if;

  /* 14. Las tablas nuevas tienen RLS prendida. */
  select count(*) into n from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relname in ('booking_settings', 'staff_schedules', 'staff_time_off', 'staff_services', 'booking_zones')
     and c.relrowsecurity;
  total := total + 1; if n <> 5 then
    fallas := fallas || format('RLS (%s de 5 tablas)', n); end if;

  /* 15. Como la llama la edge function booking: con el ROL service_role de
         verdad, no como postgres. Un permiso del esquema private (0113) paso
         inadvertido hasta la primera prueba en vivo porque estos tests corrian
         como superusuario. */
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
  begin
    select count(*) into n from public.get_available_slots(t, svc, d, d, sa);
    total := total + 1; if n = 0 then
      fallas := fallas || 'service_role sin horarios'; end if;
  exception when others then
    total := total + 1; fallas := fallas || format('service_role fallo: %s', sqlerrm);
  end;
  perform set_config('role', 'none', true);

  raise exception 'AGENDA_HUECOS %/% ok%', total - cardinality(fallas), total,
    case when cardinality(fallas) = 0 then '' else ' | ' || array_to_string(fallas, ' | ') end;
end $test$;
