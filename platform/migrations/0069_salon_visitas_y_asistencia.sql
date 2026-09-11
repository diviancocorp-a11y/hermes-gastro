-- 0069 - Cobertura de mesas, visitas y solicitudes del menu digital.
--
-- Una mesa, una visita y una comanda no son la misma entidad. La mesa existe
-- siempre; la visita representa al grupo sentado; los pedidos pueden ser
-- varios durante esa visita. El camarero responsable se congela en la visita
-- para que un cambio de turno no reescriba el historial.

alter table public.resources
  add column if not exists public_code uuid not null default gen_random_uuid();

create unique index if not exists resources_public_code_uniq
  on public.resources(public_code);

comment on column public.resources.public_code is
  'Codigo estable del QR fisico. No contiene tenant, mesa ni datos del cliente.';

-- Una asignacion por mesa. La UI puede seleccionar un rango, pero lo expande
-- a filas: asi una excepcion (mesa 8 para otro camarero) no exige otro modelo.
create table if not exists public.table_coverages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  staff_shift_id uuid references public.staff_shifts(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint table_coverages_time_valid check (ends_at > starts_at),
  constraint table_coverages_no_overlap exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (active)
);

create index if not exists idx_table_coverages_staff_time
  on public.table_coverages(staff_id, starts_at, ends_at) where active;
create index if not exists idx_table_coverages_branch_time
  on public.table_coverages(branch_id, starts_at, ends_at) where active;

alter table public.table_coverages enable row level security;

create policy table_coverages_select on public.table_coverages
  for select to authenticated using (
    tenant_id in (select private.current_user_tenants())
    and private.alcanza_branch(tenant_id, branch_id)
    and (
      private.tiene_rol(tenant_id, array['owner','manager'])
      or staff_id in (select s.id from public.staff s where s.user_id = auth.uid())
    )
  );

create policy table_coverages_write on public.table_coverages
  for all to authenticated using (
    tenant_id in (select private.current_user_tenants())
    and private.alcanza_branch(tenant_id, branch_id)
    and private.tiene_rol(tenant_id, array['owner','manager'])
  ) with check (
    tenant_id in (select private.current_user_tenants())
    and private.alcanza_branch(tenant_id, branch_id)
    and private.tiene_rol(tenant_id, array['owner','manager'])
  );

create table if not exists public.table_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  resource_id uuid not null references public.resources(id),
  responsible_staff_id uuid references public.staff(id) on delete set null,
  coverage_id uuid references public.table_coverages(id) on delete set null,
  service_mode text not null default 'mixed'
    check (service_mode in ('self_service','waiter','mixed')),
  source text not null default 'staff'
    check (source in ('staff','digital_menu','reservation')),
  party_size int check (party_size is null or party_size > 0),
  status text not null default 'open'
    check (status in ('open','preclosing','closed','cancelled')),
  opened_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  preclosed_at timestamptz,
  closed_at timestamptz,
  client_request_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists table_visits_one_open_per_resource
  on public.table_visits(resource_id)
  where status in ('open','preclosing');
create unique index if not exists table_visits_client_request_uniq
  on public.table_visits(tenant_id, client_request_id)
  where client_request_id is not null;
create index if not exists idx_table_visits_branch_status
  on public.table_visits(branch_id, status, opened_at);
create index if not exists idx_table_visits_staff_status
  on public.table_visits(responsible_staff_id, status, opened_at);

alter table public.table_visits enable row level security;

create policy table_visits_select on public.table_visits
  for select to authenticated using (
    tenant_id in (select private.current_user_tenants())
    and private.alcanza_branch(tenant_id, branch_id)
  );

create policy table_visits_write on public.table_visits
  for all to authenticated using (
    tenant_id in (select private.current_user_tenants())
    and private.alcanza_branch(tenant_id, branch_id)
    and private.tiene_rol(tenant_id, array['owner','manager','attendant','cashier'])
  ) with check (
    tenant_id in (select private.current_user_tenants())
    and private.alcanza_branch(tenant_id, branch_id)
    and private.tiene_rol(tenant_id, array['owner','manager','attendant','cashier'])
  );

-- Los pedidos hechos por el cliente desde una mesa se vinculan a la visita y
-- esperan revision. `pending_review` no es una comanda: cocina nunca lo toma.
alter table public.orders
  add column if not exists visit_id uuid references public.table_visits(id) on delete set null,
  add column if not exists review_status text not null default 'not_required',
  add column if not exists risk_flags jsonb not null default '[]'::jsonb,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

alter table public.orders drop constraint if exists orders_review_status_check;
alter table public.orders add constraint orders_review_status_check
  check (review_status in ('not_required','pending','approved','rejected'));

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders alter column status set default 'new';
alter table public.orders add constraint orders_status_check
  check (status in (
    'pending_review','pending_payment','new','preparing','active','completed','cancelled'
  ));

create index if not exists idx_orders_visit on public.orders(visit_id)
  where visit_id is not null;
create index if not exists idx_orders_pending_review
  on public.orders(tenant_id, staff_id, created_at)
  where review_status = 'pending';

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  visit_id uuid not null references public.table_visits(id) on delete cascade,
  resource_id uuid not null references public.resources(id),
  assigned_staff_id uuid references public.staff(id) on delete set null,
  kind text not null check (kind in ('waiter','bill','manager')),
  status text not null default 'pending'
    check (status in ('pending','accepted','resolved','cancelled')),
  source text not null default 'digital_menu'
    check (source in ('digital_menu','staff')),
  requested_at timestamptz not null default now(),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  client_request_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists service_requests_one_active_kind
  on public.service_requests(visit_id, kind)
  where status in ('pending','accepted');
create unique index if not exists service_requests_client_request_uniq
  on public.service_requests(tenant_id, client_request_id)
  where client_request_id is not null;
create index if not exists idx_service_requests_assigned_pending
  on public.service_requests(assigned_staff_id, requested_at)
  where status in ('pending','accepted');
create index if not exists idx_service_requests_branch_pending
  on public.service_requests(branch_id, requested_at)
  where status in ('pending','accepted');

alter table public.service_requests enable row level security;

create policy service_requests_select on public.service_requests
  for select to authenticated using (
    tenant_id in (select private.current_user_tenants())
    and private.alcanza_branch(tenant_id, branch_id)
    and (
      private.tiene_rol(tenant_id, array['owner','manager'])
      or assigned_staff_id in (select s.id from public.staff s where s.user_id = auth.uid())
    )
  );

-- Los cambios de estado pasan por update_service_request(). No se permite
-- insert publico ni escritura directa para conservar tiempos y responsable.

create or replace function private.guard_salon_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'table_coverages' then
    if not exists (
      select 1 from public.resources r
       where r.id = new.resource_id and r.tenant_id = new.tenant_id
         and r.branch_id = new.branch_id and r.kind = 'table'
    ) or not exists (
      select 1 from public.staff s where s.id = new.staff_id and s.tenant_id = new.tenant_id
    ) then raise exception 'alcance_salon_invalido'; end if;
  elsif tg_table_name = 'table_visits' then
    if not exists (
      select 1 from public.resources r
       where r.id = new.resource_id and r.tenant_id = new.tenant_id
         and r.branch_id = new.branch_id and r.kind = 'table'
    ) or (new.responsible_staff_id is not null and not exists (
      select 1 from public.staff s
       where s.id = new.responsible_staff_id and s.tenant_id = new.tenant_id
    )) then raise exception 'alcance_salon_invalido'; end if;
  elsif tg_table_name = 'service_requests' then
    if not exists (
      select 1 from public.table_visits v
       where v.id = new.visit_id and v.tenant_id = new.tenant_id
         and v.branch_id = new.branch_id and v.resource_id = new.resource_id
    ) or (new.assigned_staff_id is not null and not exists (
      select 1 from public.staff s
       where s.id = new.assigned_staff_id and s.tenant_id = new.tenant_id
    )) then raise exception 'alcance_salon_invalido'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_salon_scope on public.table_coverages;
create trigger trg_guard_salon_scope before insert or update on public.table_coverages
  for each row execute function private.guard_salon_scope();
drop trigger if exists trg_guard_salon_scope on public.table_visits;
create trigger trg_guard_salon_scope before insert or update on public.table_visits
  for each row execute function private.guard_salon_scope();
drop trigger if exists trg_guard_salon_scope on public.service_requests;
create trigger trg_guard_salon_scope before insert or update on public.service_requests
  for each row execute function private.guard_salon_scope();

create or replace function private.coverage_for_table(
  p_tenant_id uuid,
  p_resource_id uuid,
  p_at timestamptz default now()
)
returns public.table_coverages
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select c.*
    from public.table_coverages c
   where c.tenant_id = p_tenant_id
     and c.resource_id = p_resource_id
     and c.active
     and p_at >= c.starts_at
     and p_at < c.ends_at
   order by c.starts_at desc
   limit 1
$$;

revoke all on function private.coverage_for_table(uuid, uuid, timestamptz)
  from public, anon, authenticated;

create or replace function public.open_table_visit(
  p_tenant_id uuid,
  p_resource_id uuid,
  p_service_mode text default 'mixed',
  p_party_size int default null,
  p_staff_id uuid default null,
  p_client_request_id uuid default null
)
returns public.table_visits
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_resource public.resources;
  v_coverage public.table_coverages;
  v_visit public.table_visits;
begin
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;
  if not private.tiene_rol(p_tenant_id, array['owner','manager','attendant','cashier']) then
    raise exception 'sin_permiso';
  end if;
  if p_service_mode not in ('self_service','waiter','mixed') then
    raise exception 'modo_invalido';
  end if;

  select * into v_resource from public.resources
   where id = p_resource_id and tenant_id = p_tenant_id and active and kind = 'table';
  if not found then raise exception 'mesa_no_encontrada'; end if;
  if not private.alcanza_branch(p_tenant_id, v_resource.branch_id) then
    raise exception 'sin_sucursal';
  end if;
  if p_staff_id is not null and not exists (
    select 1 from public.staff s
     where s.id = p_staff_id and s.tenant_id = p_tenant_id and s.active
  ) then raise exception 'responsable_invalido'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_resource_id::text, 0));
  select * into v_visit from public.table_visits
   where resource_id = p_resource_id and status in ('open','preclosing')
   limit 1;
  if found then return v_visit; end if;

  select * into v_coverage
    from private.coverage_for_table(p_tenant_id, p_resource_id, now());

  insert into public.table_visits (
    tenant_id, branch_id, resource_id, responsible_staff_id, coverage_id,
    service_mode, source, party_size, opened_by, client_request_id
  ) values (
    p_tenant_id, v_resource.branch_id, p_resource_id,
    coalesce(p_staff_id, v_coverage.staff_id), v_coverage.id,
    p_service_mode, 'staff', p_party_size, auth.uid(), p_client_request_id
  ) returning * into v_visit;

  return v_visit;
end $$;

revoke all on function public.open_table_visit(uuid, uuid, text, int, uuid, uuid)
  from public, anon;
grant execute on function public.open_table_visit(uuid, uuid, text, int, uuid, uuid)
  to authenticated;

create or replace function public.open_table_visit_from_menu(
  p_tenant_slug text,
  p_table_code uuid,
  p_service_mode text default 'self_service',
  p_party_size int default null,
  p_client_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_resource public.resources;
  v_coverage public.table_coverages;
  v_visit public.table_visits;
begin
  if p_service_mode not in ('self_service','mixed') then
    raise exception 'modo_invalido';
  end if;
  if p_party_size is not null and p_party_size <= 0 then
    raise exception 'cantidad_invalida';
  end if;

  select r.* into v_resource
    from public.resources r join public.tenants t on t.id = r.tenant_id
   where t.slug = lower(btrim(coalesce(p_tenant_slug, '')))
     and r.public_code = p_table_code and r.active and r.kind = 'table';
  if not found then raise exception 'mesa_no_encontrada'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_resource.id::text, 0));
  select * into v_visit from public.table_visits
   where resource_id = v_resource.id and status in ('open','preclosing')
   limit 1;

  if not found then
    select * into v_coverage
      from private.coverage_for_table(v_resource.tenant_id, v_resource.id, now());
    insert into public.table_visits (
      tenant_id, branch_id, resource_id, responsible_staff_id, coverage_id,
      service_mode, source, party_size, client_request_id
    ) values (
      v_resource.tenant_id, v_resource.branch_id, v_resource.id,
      v_coverage.staff_id, v_coverage.id, p_service_mode, 'digital_menu',
      p_party_size, p_client_request_id
    ) returning * into v_visit;
  end if;

  return jsonb_build_object(
    'visit_id', v_visit.id,
    'table_name', v_resource.name,
    'service_mode', v_visit.service_mode,
    'has_responsible', v_visit.responsible_staff_id is not null
  );
end $$;

revoke all on function public.open_table_visit_from_menu(text, uuid, text, int, uuid)
  from public, anon, authenticated;
grant execute on function public.open_table_visit_from_menu(text, uuid, text, int, uuid)
  to service_role;

create or replace function public.request_table_assistance(
  p_tenant_slug text,
  p_table_code uuid,
  p_kind text,
  p_client_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_resource public.resources;
  v_visit public.table_visits;
  v_request public.service_requests;
begin
  if p_kind not in ('waiter','bill','manager') then
    raise exception 'tipo_solicitud_invalido';
  end if;

  select r.* into v_resource
    from public.resources r join public.tenants t on t.id = r.tenant_id
   where t.slug = lower(btrim(coalesce(p_tenant_slug, '')))
     and r.public_code = p_table_code and r.active and r.kind = 'table';
  if not found then raise exception 'mesa_no_encontrada'; end if;

  select * into v_visit from public.table_visits
   where resource_id = v_resource.id and status in ('open','preclosing')
   limit 1;
  if not found then raise exception 'visita_no_abierta'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_visit.id::text || ':' || p_kind, 0));
  select * into v_request from public.service_requests
   where visit_id = v_visit.id and kind = p_kind
     and status in ('pending','accepted')
   limit 1;

  if not found then
    insert into public.service_requests (
      tenant_id, branch_id, visit_id, resource_id, assigned_staff_id,
      kind, client_request_id
    ) values (
      v_visit.tenant_id, v_visit.branch_id, v_visit.id, v_visit.resource_id,
      case when p_kind = 'manager' then null else v_visit.responsible_staff_id end,
      p_kind, p_client_request_id
    ) returning * into v_request;
  end if;

  return jsonb_build_object(
    'request_id', v_request.id,
    'status', v_request.status,
    'kind', v_request.kind,
    'table_name', v_resource.name,
    'assigned_user_id', (
      select s.user_id from public.staff s where s.id = v_request.assigned_staff_id
    ),
    'tenant_id', v_request.tenant_id
  );
end $$;

revoke all on function public.request_table_assistance(text, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.request_table_assistance(text, uuid, text, uuid)
  to service_role;

create or replace function public.update_service_request(
  p_request_id uuid,
  p_status text
)
returns public.service_requests
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_request public.service_requests;
  v_is_manager boolean;
  v_is_assigned boolean;
begin
  if p_status not in ('accepted','resolved','cancelled') then
    raise exception 'estado_solicitud_invalido';
  end if;

  select * into v_request from public.service_requests where id = p_request_id for update;
  if not found or v_request.tenant_id not in (select private.current_user_tenants()) then
    raise exception 'solicitud_no_encontrada';
  end if;
  if not private.alcanza_branch(v_request.tenant_id, v_request.branch_id) then
    raise exception 'sin_sucursal';
  end if;

  v_is_manager := private.tiene_rol(v_request.tenant_id, array['owner','manager']);
  v_is_assigned := exists (
    select 1 from public.staff s
     where s.id = v_request.assigned_staff_id and s.user_id = auth.uid()
  );
  if not v_is_manager and not v_is_assigned then raise exception 'sin_permiso'; end if;

  if p_status = 'accepted' and v_request.status = 'pending' then
    update public.service_requests
       set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
     where id = p_request_id returning * into v_request;
  elsif p_status in ('resolved','cancelled')
        and v_request.status in ('pending','accepted') then
    update public.service_requests
       set status = p_status, resolved_by = auth.uid(), resolved_at = now()
     where id = p_request_id returning * into v_request;
  end if;

  return v_request;
end $$;

revoke all on function public.update_service_request(uuid, text) from public, anon;
grant execute on function public.update_service_request(uuid, text) to authenticated;

create or replace function public.review_table_order(
  p_order_id uuid,
  p_decision text,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_order public.orders;
  v_is_manager boolean;
  v_is_responsible boolean;
begin
  if p_decision not in ('approve','reject') then
    raise exception 'decision_invalida';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.tenant_id not in (select private.current_user_tenants()) then
    raise exception 'pedido_no_encontrado';
  end if;
  if not private.alcanza_branch(v_order.tenant_id, v_order.branch_id) then
    raise exception 'sin_sucursal';
  end if;
  if v_order.review_status <> 'pending' or v_order.status <> 'pending_review' then
    return v_order;
  end if;

  v_is_manager := private.tiene_rol(v_order.tenant_id, array['owner','manager']);
  v_is_responsible := exists (
    select 1 from public.staff s
     where s.id = v_order.staff_id and s.user_id = auth.uid()
  );
  if not v_is_manager and not v_is_responsible then raise exception 'sin_permiso'; end if;

  update public.orders
     set review_status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
         status = case
           when p_decision = 'reject' then 'cancelled'
           when payment = 'mercadopago' and payment_status <> 'approved' then 'pending_payment'
           else 'new'
         end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_order_id
  returning * into v_order;

  -- Un rechazo no debe quemar el cupon del cliente. Se libera solo si no hay
  -- otro pedido vigente que lo este usando.
  if p_decision = 'reject' and v_order.coupon_id is not null
     and not exists (
       select 1 from public.orders o
        where o.coupon_id = v_order.coupon_id and o.id <> v_order.id
          and o.status <> 'cancelled'
     ) then
    update public.coupons set used = false, used_at = null where id = v_order.coupon_id;
  end if;

  return v_order;
end $$;

revoke all on function public.review_table_order(uuid, text, text) from public, anon;
grant execute on function public.review_table_order(uuid, text, text) to authenticated;

-- Ningun update directo puede convertir una comanda pendiente en trabajo de
-- cocina. Solo review_table_order, que corre como owner de la funcion, deja
-- una decision y sus timestamps.
create or replace function private.guard_order_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.review_status = 'pending'
     and (new.review_status is distinct from old.review_status
          or new.status is distinct from old.status)
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'revision_obligatoria';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_order_review on public.orders;
create trigger trg_guard_order_review before update of review_status, status on public.orders
  for each row execute function private.guard_order_review();

-- Realtime entrega estas filas solo a quien supera RLS. El menu publico no se
-- suscribe: crea por RPC y recibe una respuesta acotada.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.service_requests;
  end if;
exception when duplicate_object then null;
end $$;

grant select, insert, update, delete on public.table_coverages to authenticated;
grant select, insert, update on public.table_visits to authenticated;
grant select on public.service_requests to authenticated;

comment on table public.table_coverages is
  'Mesas que cubre una persona en una ventana. La UI puede agruparlas como rango.';
comment on table public.table_visits is
  'Grupo atendido en una mesa. Congela responsable y modo de servicio.';
comment on table public.service_requests is
  'Llamados del menu digital. Ver, aceptar y resolver son estados distintos.';
