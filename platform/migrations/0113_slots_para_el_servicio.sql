-- 0113 — get_available_slots no toca el esquema private cuando llama el servicio.
-- Aplicada via MCP el 24/oct/2026 (schema_migrations: slots_para_el_servicio). Probada
-- antes en una transaccion que terminaba en error, ejecutando como service_role y
-- como authenticated; la funcion vigente fallaba en ese mismo control.
--
-- Encontrado en la primera prueba EN VIVO de la edge function booking (24/oct):
-- "permission denied for schema private". La guarda de la 0109/0110 evaluaba
-- private.current_user_tenants() ANTES de mirar si el rol era service_role, y
-- service_role no puede usar ese esquema. Los tests SQL corrian como postgres
-- (superusuario) y no lo veian: ahora agenda_huecos.sql ejecuta tambien como
-- service_role.
--
-- Misma firma, misma respuesta: solo expandir.

create or replace function public.get_available_slots(
  p_tenant_id     uuid,
  p_service_id    uuid,
  p_from          date,
  p_to            date,
  p_staff_id      uuid default null,
  p_location_kind text default 'local',
  p_travel_min    integer default null
)
returns table (staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
set search_path = public, private, pg_temp
as $$
begin
  if p_location_kind not in ('local', 'home') then return; end if;
  if p_from is null or p_to is null or p_to < p_from then return; end if;
  if p_to - p_from > 62 then
    raise exception 'rango_demasiado_largo: maximo 62 dias';
  end if;

  -- El servicio (edge function booking) entra por la primera rama y NUNCA toca el
  -- esquema private: service_role no tiene USAGE sobre el. Cualquier otro rol
  -- pasa por la segunda rama y se limita a los negocios de los que es miembro.
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '')
       is distinct from 'service_role' then
    if not (p_tenant_id in (select private.current_user_tenants())) then
      return;
    end if;
  end if;

  return query
  with cfg as (
    select t.timezone as tz,
           coalesce(bs.min_notice_min, 120)   as min_notice,
           coalesce(bs.max_advance_days, 60)  as max_adv,
           coalesce(bs.slot_step_min, 15)     as step,
           coalesce(p_travel_min, bs.travel_min, 0) as travel,
           coalesce(bs.offers_local, true)    as offers_local,
           coalesce(bs.offers_home, false)    as offers_home
      from public.tenants t
      left join public.booking_settings bs on bs.tenant_id = t.id
     where t.id = p_tenant_id
  ),
  svc as (
    select p.id, p.duration_min, coalesce(p.buffer_after_min, 0) as buf
      from public.products p
     where p.id = p_service_id and p.tenant_id = p_tenant_id
       and p.type = 'service' and p.duration_min > 0
  ),
  cands as (
    select s.id as sid, coalesce(ss.duration_min, svc.duration_min) as dur
      from public.staff s
     cross join svc
      left join public.staff_services ss
        on ss.staff_id = s.id and ss.service_id = svc.id
     where s.tenant_id = p_tenant_id and s.active
       and (p_staff_id is null or s.id = p_staff_id)
       and (ss.staff_id is not null
            or not exists (select 1 from public.staff_services x
                            where x.service_id = svc.id and x.tenant_id = p_tenant_id))
  ),
  days as (
    select d::date as d from generate_series(p_from, p_to, interval '1 day') d
  ),
  wins as (
    select c.sid, c.dur,
           ((d.d + sc.start_time) at time zone cfg.tz) as w_start,
           ((d.d + sc.end_time)   at time zone cfg.tz) as w_end
      from cands c
     cross join cfg
     cross join days d
      join public.staff_schedules sc
        on sc.staff_id = c.sid and sc.weekday = extract(dow from d.d)::int
  ),
  slots as (
    select w.sid, g as s, g + make_interval(mins => w.dur) as e
      from wins w
     cross join cfg
     cross join lateral generate_series(
       w.w_start,
       w.w_end - make_interval(mins => w.dur),
       make_interval(mins => cfg.step)) g
  )
  select sl.sid, sl.s, sl.e
    from slots sl
   cross join cfg
   cross join svc
   where sl.s >= now() + make_interval(mins => cfg.min_notice)
     and sl.s <= now() + make_interval(days => cfg.max_adv)
     and ((p_location_kind = 'local' and cfg.offers_local)
          or (p_location_kind = 'home' and cfg.offers_home))
     and not exists (
       select 1 from public.staff_time_off o
        where o.tenant_id = p_tenant_id
          and (o.staff_id is null or o.staff_id = sl.sid)
          and tstzrange(o.starts_at, o.ends_at) && tstzrange(sl.s, sl.e))
     and not exists (
       select 1
         from public.appointments a
         left join public.products ap on ap.id = a.service_id
        where a.staff_id = sl.sid
          and a.status <> 'cancelled'
          and tstzrange(
                a.starts_at - make_interval(mins => case when a.location_kind = 'home' then a.travel_min else 0 end),
                a.ends_at
                  + make_interval(mins => coalesce(ap.buffer_after_min, 0))
                  + make_interval(mins => case when a.location_kind = 'home' and p_location_kind = 'local' then a.travel_min else 0 end))
              &&
              tstzrange(
                sl.s - make_interval(mins => case when p_location_kind = 'home' then cfg.travel else 0 end),
                sl.e
                  + make_interval(mins => svc.buf)
                  + make_interval(mins => case when p_location_kind = 'home' and a.location_kind = 'local' then cfg.travel else 0 end)))
   order by sl.s, sl.sid;
end;
$$;
