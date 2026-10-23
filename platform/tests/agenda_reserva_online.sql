-- Test de la 0111: la sena que no se paga a tiempo libera el hueco.
-- Correr cada vez que se toque private.expire_deposit_holds o hold_until.
--
-- No deja nada en la base: un solo DO que TERMINA SIEMPRE EN ERROR y deshace la
-- siembra. El resultado viene en el mensaje:
--   'AGENDA_RESERVA 6/6 ok'  -> verde
-- Para probar la migracion antes de aplicarla, pegarla antes de este bloque en
-- la misma consulta (el error final la deshace).

do $test$
declare
  t uuid := gen_random_uuid(); sa uuid := gen_random_uuid(); svc uuid := gen_random_uuid();
  vencido uuid := gen_random_uuid(); vigente uuid := gen_random_uuid();
  pagado uuid := gen_random_uuid(); sinhold uuid := gen_random_uuid();
  n int; st text; tok1 uuid; tok2 uuid; total int := 0; fallas text[] := '{}';
begin
  insert into public.tenants (id, slug, name, vertical) values (t, 'zz-prueba-0111-' || substr(t::text, 1, 8), 'Prueba 0111', 'barber');
  insert into public.products (id, tenant_id, type, name, price, duration_min) values (svc, t, 'service', 'Corte', 1000, 60);
  insert into public.staff (id, tenant_id, name) values (sa, t, 'A');

  insert into public.appointments (id, tenant_id, staff_id, service_id, starts_at, ends_at, status, deposit_status, hold_until) values
    (vencido, t, sa, svc, now() + interval '2 days',           now() + interval '2 days 1 hour',  'booked', 'pending', now() - interval '1 minute'),
    (vigente, t, sa, svc, now() + interval '2 days 2 hours',   now() + interval '2 days 3 hours', 'booked', 'pending', now() + interval '20 minutes'),
    (pagado,  t, sa, svc, now() + interval '2 days 4 hours',   now() + interval '2 days 5 hours', 'confirmed', 'paid', now() - interval '1 hour'),
    (sinhold, t, sa, svc, now() + interval '2 days 6 hours',   now() + interval '2 days 7 hours', 'booked', null, null);

  total := total + 1; select private.expire_deposit_holds() into n;
  if n <> 1 then fallas := fallas || format('cancelo %s (esperaba 1)', n); end if;

  total := total + 1; select status into st from public.appointments where id = vencido;
  if st <> 'cancelled' then fallas := fallas || format('vencido quedo %s', st); end if;
  total := total + 1; select status into st from public.appointments where id = vigente;
  if st <> 'booked' then fallas := fallas || format('vigente quedo %s', st); end if;
  total := total + 1; select status into st from public.appointments where id = pagado;
  if st <> 'confirmed' then fallas := fallas || format('pagado quedo %s', st); end if;
  total := total + 1; select status into st from public.appointments where id = sinhold;
  if st <> 'booked' then fallas := fallas || format('sin hold quedo %s', st); end if;

  -- Cada turno tiene su propio token, distinto del id.
  total := total + 1; select public_token into tok1 from public.appointments where id = vencido;
  select public_token into tok2 from public.appointments where id = vigente;
  if tok1 is null or tok1 = tok2 or tok1 = vencido then fallas := fallas || 'public_token repetido o igual al id'; end if;

  raise exception 'AGENDA_RESERVA %/% ok%', total - cardinality(fallas), total,
    case when cardinality(fallas) = 0 then '' else ' | ' || array_to_string(fallas, ' | ') end;
end $test$;
