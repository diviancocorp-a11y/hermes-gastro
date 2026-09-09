-- 0067 -- Rendiciones por camarero, incidencias de caja y cola fiscal ARCA.
--
-- Caja conserva la custodia del dinero; Salon conserva mesa y comanda. Una
-- factura es un documento fiscal de una cuenta saldada, no el cierre de mesa.
-- Por eso la emision se encola y puede reintentarse sin duplicar comprobantes.

/* ----------------------- Quien recibio cada pago ----------------------- */

alter table public.payments
  add column if not exists collected_by uuid,
  add column if not exists collector_staff_id uuid references public.staff(id) on delete set null,
  add column if not exists reference text,
  add column if not exists verification_status text not null default 'not_required'
    check (verification_status in ('not_required','pending','verified','rejected'));

create index if not exists idx_payments_collector
  on public.payments(tenant_id, cash_session_id, collector_staff_id)
  where collector_staff_id is not null;

create or replace function private.identificar_cobrador()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_kind text;
begin
  new.collected_by := coalesce(new.collected_by, auth.uid());
  if new.collector_staff_id is null and new.collected_by is not null then
    select s.id into new.collector_staff_id
      from public.staff s
     where s.tenant_id = new.tenant_id
       and s.user_id = new.collected_by
       and s.active
     order by s.created_at
     limit 1;
  end if;
  select pm.kind into v_kind from public.payment_methods pm where pm.id = new.method_id;
  if new.verification_status = 'not_required' and v_kind in ('card','transfer') then
    new.verification_status := 'pending';
  end if;
  return new;
end $$;

drop trigger if exists payments_identificar_cobrador on public.payments;
create trigger payments_identificar_cobrador
  before insert on public.payments
  for each row execute function private.identificar_cobrador();

/* ---------------------- Pre-cierre de mini caja ------------------------ */

create table if not exists public.staff_cash_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  cash_session_id uuid not null references public.cash_sessions(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete restrict,
  status text not null default 'submitted' check (status in (
    'submitted','under_review','observed','approved','closed'
  )),
  expected_cash numeric(12,2) not null default 0,
  declared_cash numeric(12,2) not null default 0,
  difference numeric(12,2) not null default 0,
  notes text,
  submitted_by uuid not null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  cash_received_by uuid,
  cash_received_at timestamptz,
  closed_at timestamptz,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists staff_settlement_request_uniq
  on public.staff_cash_settlements(tenant_id, client_request_id)
  where client_request_id is not null;
create unique index if not exists staff_settlement_uno_activo
  on public.staff_cash_settlements(cash_session_id, staff_id)
  where status <> 'closed';
create index if not exists idx_staff_settlements_review
  on public.staff_cash_settlements(tenant_id, branch_id, status, submitted_at);

/* -------------------- Fotos de comprobantes de pago ------------------- */

create table if not exists public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  settlement_id uuid references public.staff_cash_settlements(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  storage_path text not null,
  original_filename text,
  mime_type text check (mime_type is null or mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 10485760),
  sha256 text,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  uploaded_by uuid not null,
  uploaded_at timestamptz not null default now(),
  verified_by uuid,
  verified_at timestamptz,
  rejection_reason text,
  unique (tenant_id, storage_path)
);

create index if not exists idx_payment_evidence_settlement
  on public.payment_evidence(settlement_id, status);
create index if not exists idx_payment_evidence_payment
  on public.payment_evidence(payment_id);

/* --------------------- Excepciones para el encargado ------------------ */

create table if not exists public.cash_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  settlement_id uuid references public.staff_cash_settlements(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  kind text not null check (kind in (
    'table_move','discount','order_error','refund','payment_correction',
    'reopened_order','cash_difference','receipt_mismatch','transfer_pending',
    'fiscal_failure','other'
  )),
  severity text not null default 'approval'
    check (severity in ('info','approval','critical')),
  status text not null default 'open'
    check (status in ('open','in_review','resolved','dismissed')),
  title text not null,
  description text,
  context jsonb not null default '{}'::jsonb,
  reported_by uuid not null,
  assigned_to uuid,
  resolved_by uuid,
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  client_request_id uuid
);

create unique index if not exists cash_exceptions_request_uniq
  on public.cash_exceptions(tenant_id, client_request_id)
  where client_request_id is not null;
create index if not exists idx_cash_exceptions_pending
  on public.cash_exceptions(tenant_id, branch_id, severity, created_at)
  where status in ('open','in_review');

/* ----------------------- Configuracion fiscal ARCA -------------------- */

create table if not exists public.fiscal_profiles (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  legal_name text not null,
  cuit text not null check (cuit ~ '^[0-9]{11}$'),
  vat_condition text not null check (vat_condition in (
    'responsable_inscripto','monotributo','exento'
  )),
  point_of_sale integer not null check (point_of_sale between 1 and 99999),
  environment text not null default 'homologation'
    check (environment in ('homologation','production')),
  default_voucher_type integer not null check (default_voucher_type in (1,6,11)),
  default_vat_rate numeric(5,2) not null default 21
    check (default_vat_rate in (0, 2.5, 5, 10.5, 21, 27)),
  credential_ref text not null,
  auto_issue boolean not null default true,
  enabled boolean not null default false,
  processing_document_id uuid,
  processing_locked_at timestamptz,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_profile_voucher_matches_vat check (
    (vat_condition = 'responsable_inscripto' and default_voucher_type in (1,6))
    or (vat_condition in ('monotributo','exento') and default_voucher_type = 11)
  )
);

comment on column public.fiscal_profiles.credential_ref is
  'Identificador opaco del secreto server-side. Nunca contiene certificado ni clave privada.';

create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  order_id uuid references public.orders(id) on delete restrict,
  related_document_id uuid references public.fiscal_documents(id) on delete restrict,
  status text not null default 'queued' check (status in (
    'queued','processing','authorized','rejected','retry_required','cancelled'
  )),
  voucher_type integer not null,
  point_of_sale integer not null,
  voucher_number bigint,
  concept integer not null default 1 check (concept in (1,2,3)),
  issue_date date not null default current_date,
  currency text not null default 'PES',
  exchange_rate numeric(18,6) not null default 1,
  receiver_doc_type integer not null default 99,
  receiver_doc_number text not null default '0',
  receiver_name text,
  receiver_vat_condition integer,
  total numeric(14,2) not null check (total > 0),
  net_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  exempt_amount numeric(14,2) not null default 0,
  non_taxed_amount numeric(14,2) not null default 0,
  other_taxes_amount numeric(14,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  vat_breakdown jsonb not null default '[]'::jsonb,
  cae text,
  cae_expires_on date,
  arca_result text,
  arca_observations jsonb not null default '[]'::jsonb,
  last_error_code text,
  last_error_message text,
  attempt_count integer not null default 0,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  processing_started_at timestamptz,
  authorized_at timestamptz,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fiscal_profiles
  add constraint fiscal_profile_processing_document_fk
  foreign key (processing_document_id) references public.fiscal_documents(id) on delete set null;

create unique index if not exists fiscal_document_request_uniq
  on public.fiscal_documents(tenant_id, client_request_id);
create unique index if not exists fiscal_document_order_activo_uniq
  on public.fiscal_documents(order_id)
  where order_id is not null and related_document_id is null and status <> 'cancelled';
create unique index if not exists fiscal_document_number_uniq
  on public.fiscal_documents(tenant_id, point_of_sale, voucher_type, voucher_number)
  where voucher_number is not null;
create index if not exists idx_fiscal_documents_queue
  on public.fiscal_documents(status, requested_at)
  where status in ('queued','retry_required');

create table if not exists public.fiscal_attempts (
  id bigserial primary key,
  fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null default 'started'
    check (outcome in ('started','authorized','rejected','transport_error','internal_error')),
  arca_operation text not null default 'FECAESolicitar',
  response_code text,
  response_message text,
  response_meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_fiscal_attempts_document
  on public.fiscal_attempts(fiscal_document_id, started_at desc);

/* ------------------------------ RLS ----------------------------------- */

alter table public.staff_cash_settlements enable row level security;
alter table public.payment_evidence enable row level security;
alter table public.cash_exceptions enable row level security;
alter table public.fiscal_profiles enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.fiscal_attempts enable row level security;

create policy staff_settlements_select on public.staff_cash_settlements
for select using (
  tenant_id in (select private.current_user_tenants())
  and private.alcanza_branch(tenant_id, branch_id)
  and (
    private.tiene_rol(tenant_id, array['owner','manager','cashier','accountant'])
    or exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid())
  )
);

create policy payment_evidence_select on public.payment_evidence
for select using (
  tenant_id in (select private.current_user_tenants())
  and private.alcanza_branch(tenant_id, branch_id)
  and (
    private.tiene_rol(tenant_id, array['owner','manager','cashier','accountant'])
    or uploaded_by = auth.uid()
  )
);

create policy cash_exceptions_select on public.cash_exceptions
for select using (
  tenant_id in (select private.current_user_tenants())
  and private.alcanza_branch(tenant_id, branch_id)
  and (
    private.tiene_rol(tenant_id, array['owner','manager','cashier','accountant'])
    or reported_by = auth.uid()
  )
);

create policy fiscal_profiles_select on public.fiscal_profiles
for select using (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager','accountant'])
);
create policy fiscal_profiles_write on public.fiscal_profiles
for all using (
  private.tiene_rol(tenant_id, array['owner','manager'])
) with check (
  private.tiene_rol(tenant_id, array['owner','manager'])
);

create policy fiscal_documents_select on public.fiscal_documents
for select using (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager','cashier','accountant'])
  and private.alcanza_branch(tenant_id, branch_id)
);

create policy fiscal_attempts_select on public.fiscal_attempts
for select using (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager','accountant'])
);

/* -------------------------- Operaciones RPC --------------------------- */

create or replace function public.staff_settlement_expected_cash(
  p_cash_session_id uuid,
  p_staff_id uuid
)
returns numeric
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select coalesce(sum(p.amount), 0)
    from public.payments p
    join public.payment_methods pm on pm.id = p.method_id
   where p.cash_session_id = p_cash_session_id
     and p.collector_staff_id = p_staff_id
     and pm.kind = 'cash'
     and p.tenant_id in (select private.current_user_tenants())
$$;

create or replace function public.submit_staff_cash_settlement(
  p_tenant_id uuid,
  p_cash_session_id uuid,
  p_staff_id uuid,
  p_declared_cash numeric,
  p_notes text default null,
  p_client_request_id uuid default null
)
returns public.staff_cash_settlements
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_branch uuid;
  v_expected numeric;
  v_result public.staff_cash_settlements;
  v_is_self boolean;
begin
  if p_tenant_id not in (select private.current_user_tenants()) then
    raise exception 'no_sos_miembro';
  end if;
  select exists (
    select 1 from public.staff s
     where s.id = p_staff_id and s.tenant_id = p_tenant_id and s.user_id = auth.uid()
  ) into v_is_self;
  if not v_is_self and not private.tiene_rol(p_tenant_id, array['owner','manager','cashier']) then
    raise exception 'sin_permiso_para_rendicion';
  end if;
  if coalesce(p_declared_cash, -1) < 0 then
    raise exception 'monto_invalido';
  end if;
  if p_client_request_id is not null then
    select * into v_result from public.staff_cash_settlements
     where tenant_id = p_tenant_id and client_request_id = p_client_request_id;
    if found then return v_result; end if;
  end if;
  select cs.branch_id into v_branch from public.cash_sessions cs
   where cs.id = p_cash_session_id and cs.tenant_id = p_tenant_id and cs.status = 'open';
  if v_branch is null then raise exception 'turno_no_encontrado'; end if;
  if not private.alcanza_branch(p_tenant_id, v_branch) then
    raise exception 'sucursal_fuera_de_alcance';
  end if;
  if not exists (select 1 from public.staff s where s.id = p_staff_id and s.tenant_id = p_tenant_id) then
    raise exception 'personal_no_encontrado';
  end if;
  select coalesce(sum(p.amount), 0) into v_expected
    from public.payments p
    join public.payment_methods pm on pm.id = p.method_id
   where p.cash_session_id = p_cash_session_id
     and p.collector_staff_id = p_staff_id
     and pm.kind = 'cash';
  insert into public.staff_cash_settlements (
    tenant_id, branch_id, cash_session_id, staff_id, expected_cash,
    declared_cash, difference, notes, submitted_by, client_request_id
  ) values (
    p_tenant_id, v_branch, p_cash_session_id, p_staff_id, v_expected,
    p_declared_cash, p_declared_cash - v_expected, nullif(btrim(coalesce(p_notes,'')),''),
    auth.uid(), p_client_request_id
  ) returning * into v_result;
  return v_result;
end $$;

create or replace function public.review_staff_cash_settlement(
  p_settlement_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.staff_cash_settlements
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_result public.staff_cash_settlements;
begin
  select * into v_result from public.staff_cash_settlements
   where id = p_settlement_id for update;
  if not found then raise exception 'rendicion_no_encontrada'; end if;
  if not private.tiene_rol(v_result.tenant_id, array['owner','manager','cashier'])
     or not private.alcanza_branch(v_result.tenant_id, v_result.branch_id) then
    raise exception 'sin_permiso_para_revisar';
  end if;
  if v_result.status = 'closed' then return v_result; end if;
  if p_decision not in ('review','observe','approve') then raise exception 'decision_invalida'; end if;
  if p_decision = 'approve' and exists (
    select 1
      from public.payments p
      join public.payment_methods pm on pm.id = p.method_id and pm.kind = 'card'
     where p.cash_session_id = v_result.cash_session_id
       and p.collector_staff_id = v_result.staff_id
       and not exists (
         select 1 from public.payment_evidence pe
          where pe.payment_id = p.id and pe.settlement_id = v_result.id
            and pe.status = 'verified'
       )
  ) then
    raise exception 'faltan_comprobantes_verificados';
  end if;
  update public.staff_cash_settlements set
    status = case p_decision when 'review' then 'under_review'
             when 'observe' then 'observed' else 'closed' end,
    reviewed_by = auth.uid(), reviewed_at = now(),
    review_notes = nullif(btrim(coalesce(p_notes,'')),''),
    cash_received_by = case when p_decision = 'approve' then auth.uid() else cash_received_by end,
    cash_received_at = case when p_decision = 'approve' then now() else cash_received_at end,
    closed_at = case when p_decision = 'approve' then now() else null end,
    updated_at = now()
   where id = p_settlement_id returning * into v_result;
  return v_result;
end $$;

create or replace function public.queue_fiscal_document(
  p_tenant_id uuid,
  p_order_id uuid,
  p_receiver_doc_type integer default 99,
  p_receiver_doc_number text default '0',
  p_receiver_name text default null,
  p_receiver_vat_condition integer default null,
  p_client_request_id uuid default gen_random_uuid()
)
returns public.fiscal_documents
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_order public.orders;
  v_profile public.fiscal_profiles;
  v_result public.fiscal_documents;
  v_paid numeric;
  v_net numeric;
  v_vat numeric;
  v_vat_code integer;
  v_vat_breakdown jsonb := '[]'::jsonb;
begin
  if p_tenant_id not in (select private.current_user_tenants())
     or not private.tiene_rol(p_tenant_id, array['owner','manager','cashier']) then
    raise exception 'sin_permiso_para_facturar';
  end if;
  select * into v_result from public.fiscal_documents
   where tenant_id = p_tenant_id and client_request_id = p_client_request_id;
  if found then return v_result; end if;
  select * into v_order from public.orders
   where id = p_order_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'pedido_no_encontrado'; end if;
  if not private.alcanza_branch(p_tenant_id, v_order.branch_id) then
    raise exception 'sucursal_fuera_de_alcance';
  end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = p_order_id;
  if v_paid + 0.01 < v_order.total then raise exception 'pedido_no_saldado'; end if;
  select * into v_profile from public.fiscal_profiles where tenant_id = p_tenant_id and enabled;
  if not found then raise exception 'facturacion_no_configurada'; end if;
  select * into v_result from public.fiscal_documents
   where order_id = p_order_id and related_document_id is null and status <> 'cancelled';
  if found then return v_result; end if;
  if v_profile.default_voucher_type in (1, 6) and v_profile.default_vat_rate > 0 then
    v_net := round(v_order.total / (1 + v_profile.default_vat_rate / 100), 2);
    v_vat := v_order.total - v_net;
    v_vat_code := case v_profile.default_vat_rate
      when 2.5 then 9 when 5 then 8 when 10.5 then 4
      when 21 then 5 when 27 then 6 else 3 end;
    v_vat_breakdown := jsonb_build_array(jsonb_build_object(
      'id', v_vat_code, 'base_amount', v_net, 'amount', v_vat
    ));
  else
    v_net := v_order.total;
    v_vat := 0;
  end if;
  insert into public.fiscal_documents (
    tenant_id, branch_id, order_id, voucher_type, point_of_sale,
    receiver_doc_type, receiver_doc_number, receiver_name, receiver_vat_condition,
    total, net_amount, vat_amount, vat_breakdown, requested_by, client_request_id
  ) values (
    p_tenant_id, v_order.branch_id, p_order_id, v_profile.default_voucher_type,
    v_profile.point_of_sale, p_receiver_doc_type, coalesce(nullif(p_receiver_doc_number,''),'0'),
    p_receiver_name, coalesce(p_receiver_vat_condition, 5), v_order.total, v_net, v_vat,
    v_vat_breakdown,
    auth.uid(), p_client_request_id
  ) returning * into v_result;
  return v_result;
end $$;

revoke all on function public.staff_settlement_expected_cash(uuid, uuid) from public, anon;
revoke all on function public.submit_staff_cash_settlement(uuid, uuid, uuid, numeric, text, uuid) from public, anon;
revoke all on function public.review_staff_cash_settlement(uuid, text, text) from public, anon;
revoke all on function public.queue_fiscal_document(uuid, uuid, integer, text, text, integer, uuid) from public, anon;
grant execute on function public.staff_settlement_expected_cash(uuid, uuid) to authenticated;
grant execute on function public.submit_staff_cash_settlement(uuid, uuid, uuid, numeric, text, uuid) to authenticated;
grant execute on function public.review_staff_cash_settlement(uuid, text, text) to authenticated;
grant execute on function public.queue_fiscal_document(uuid, uuid, integer, text, text, integer, uuid) to authenticated;

create or replace function public.register_payment_evidence(
  p_settlement_id uuid,
  p_payment_id uuid,
  p_storage_path text,
  p_original_filename text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null,
  p_sha256 text default null
)
returns public.payment_evidence
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_settlement public.staff_cash_settlements;
  v_payment public.payments;
  v_result public.payment_evidence;
begin
  select * into v_settlement from public.staff_cash_settlements
   where id = p_settlement_id;
  if not found then raise exception 'rendicion_no_encontrada'; end if;
  if v_settlement.submitted_by <> auth.uid()
     and not private.tiene_rol(v_settlement.tenant_id, array['owner','manager','cashier']) then
    raise exception 'sin_permiso_para_comprobante';
  end if;
  if v_settlement.status not in ('submitted','observed') then
    raise exception 'rendicion_bloqueada';
  end if;
  if p_storage_path not like v_settlement.tenant_id::text || '/' || v_settlement.id::text || '/%' then
    raise exception 'ruta_de_comprobante_invalida';
  end if;
  select * into v_payment from public.payments
   where id = p_payment_id
     and tenant_id = v_settlement.tenant_id
     and cash_session_id = v_settlement.cash_session_id;
  if not found then raise exception 'pago_no_encontrado'; end if;
  insert into public.payment_evidence (
    tenant_id, branch_id, settlement_id, payment_id, order_id, storage_path,
    original_filename, mime_type, size_bytes, sha256, uploaded_by
  ) values (
    v_settlement.tenant_id, v_settlement.branch_id, v_settlement.id, v_payment.id,
    v_payment.order_id, p_storage_path, p_original_filename, p_mime_type,
    p_size_bytes, p_sha256, auth.uid()
  ) returning * into v_result;
  return v_result;
end $$;

create or replace function public.verify_payment_evidence(
  p_evidence_id uuid,
  p_approved boolean,
  p_reason text default null
)
returns public.payment_evidence
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_result public.payment_evidence;
begin
  select * into v_result from public.payment_evidence where id = p_evidence_id for update;
  if not found then raise exception 'comprobante_no_encontrado'; end if;
  if not private.tiene_rol(v_result.tenant_id, array['owner','manager','cashier'])
     or not private.alcanza_branch(v_result.tenant_id, v_result.branch_id) then
    raise exception 'sin_permiso_para_verificar';
  end if;
  if not p_approved and length(btrim(coalesce(p_reason, ''))) < 4 then
    raise exception 'motivo_de_rechazo_requerido';
  end if;
  update public.payment_evidence set
    status = case when p_approved then 'verified' else 'rejected' end,
    verified_by = auth.uid(), verified_at = now(),
    rejection_reason = case when p_approved then null else btrim(p_reason) end
   where id = p_evidence_id returning * into v_result;
  update public.payments set verification_status = v_result.status
   where id = v_result.payment_id;
  return v_result;
end $$;

create or replace function public.report_cash_exception(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_kind text,
  p_title text,
  p_description text default null,
  p_severity text default 'approval',
  p_cash_session_id uuid default null,
  p_settlement_id uuid default null,
  p_order_id uuid default null,
  p_payment_id uuid default null,
  p_context jsonb default '{}'::jsonb,
  p_client_request_id uuid default null
)
returns public.cash_exceptions
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_result public.cash_exceptions;
begin
  if p_tenant_id not in (select private.current_user_tenants())
     or not private.alcanza_branch(p_tenant_id, p_branch_id) then
    raise exception 'sucursal_fuera_de_alcance';
  end if;
  if p_client_request_id is not null then
    select * into v_result from public.cash_exceptions
     where tenant_id = p_tenant_id and client_request_id = p_client_request_id;
    if found then return v_result; end if;
  end if;
  insert into public.cash_exceptions (
    tenant_id, branch_id, cash_session_id, settlement_id, order_id, payment_id,
    kind, severity, title, description, context, reported_by, client_request_id
  ) values (
    p_tenant_id, p_branch_id, p_cash_session_id, p_settlement_id, p_order_id,
    p_payment_id, p_kind, p_severity, btrim(p_title), p_description,
    coalesce(p_context, '{}'::jsonb), auth.uid(), p_client_request_id
  ) returning * into v_result;
  return v_result;
end $$;

create or replace function public.resolve_cash_exception(
  p_exception_id uuid,
  p_resolution text,
  p_dismiss boolean default false
)
returns public.cash_exceptions
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_result public.cash_exceptions;
begin
  select * into v_result from public.cash_exceptions where id = p_exception_id for update;
  if not found then raise exception 'incidencia_no_encontrada'; end if;
  if not private.tiene_rol(v_result.tenant_id, array['owner','manager','cashier'])
     or not private.alcanza_branch(v_result.tenant_id, v_result.branch_id) then
    raise exception 'sin_permiso_para_resolver';
  end if;
  if v_result.status in ('resolved','dismissed') then return v_result; end if;
  update public.cash_exceptions set
    status = case when p_dismiss then 'dismissed' else 'resolved' end,
    resolved_by = auth.uid(), resolved_at = now(), resolution = btrim(p_resolution)
   where id = p_exception_id returning * into v_result;
  return v_result;
end $$;

revoke all on function public.register_payment_evidence(uuid, uuid, text, text, text, bigint, text) from public, anon;
revoke all on function public.verify_payment_evidence(uuid, boolean, text) from public, anon;
revoke all on function public.report_cash_exception(uuid, uuid, text, text, text, text, uuid, uuid, uuid, uuid, jsonb, uuid) from public, anon;
revoke all on function public.resolve_cash_exception(uuid, text, boolean) from public, anon;
grant execute on function public.register_payment_evidence(uuid, uuid, text, text, text, bigint, text) to authenticated;
grant execute on function public.verify_payment_evidence(uuid, boolean, text) to authenticated;
grant execute on function public.report_cash_exception(uuid, uuid, text, text, text, text, uuid, uuid, uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.resolve_cash_exception(uuid, text, boolean) to authenticated;

create or replace function public.cash_session_blockers(p_session_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select jsonb_build_object(
    'open_tables', (
      select count(*) from public.orders o
       where o.branch_id = cs.branch_id and o.resource_id is not null
         and o.status in ('new','preparing','active')
    ),
    'pending_settlements', (
      select count(*) from public.staff_cash_settlements s
       where s.cash_session_id = cs.id and s.status <> 'closed'
    ),
    'critical_exceptions', (
      select count(*) from public.cash_exceptions e
       where e.cash_session_id = cs.id and e.severity = 'critical'
         and e.status in ('open','in_review')
    )
  )
  from public.cash_sessions cs
  where cs.id = p_session_id
    and cs.tenant_id in (select private.current_user_tenants())
$$;

create or replace function public.close_cash_session(
  p_session_id uuid,
  p_closing_amount numeric,
  p_notes text default null
)
returns public.cash_sessions
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_session public.cash_sessions;
  v_expected numeric;
  v_blockers jsonb;
begin
  select * into v_session from public.cash_sessions
   where id = p_session_id
     and tenant_id in (select private.current_user_tenants())
   for update;
  if not found then raise exception 'turno_no_encontrado'; end if;
  if v_session.status = 'closed' then return v_session; end if;
  select public.cash_session_blockers(p_session_id) into v_blockers;
  if coalesce((v_blockers->>'open_tables')::int, 0) > 0 then
    raise exception 'hay_mesas_abiertas';
  end if;
  if coalesce((v_blockers->>'pending_settlements')::int, 0) > 0 then
    raise exception 'hay_rendiciones_pendientes';
  end if;
  if coalesce((v_blockers->>'critical_exceptions')::int, 0) > 0 then
    raise exception 'hay_incidencias_criticas';
  end if;
  v_expected := public.cash_session_expected(p_session_id);
  update public.cash_sessions set
    status = 'closed', closed_at = now(), closed_by = auth.uid(),
    closing_amount = coalesce(p_closing_amount, 0), expected_amount = v_expected,
    difference = coalesce(p_closing_amount, 0) - v_expected,
    notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes)
   where id = p_session_id returning * into v_session;
  return v_session;
end $$;

create or replace function public.force_close_cash_session(
  p_session_id uuid,
  p_closing_amount numeric,
  p_override_reason text,
  p_notes text default null
)
returns public.cash_sessions
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.cash_sessions;
  v_expected numeric;
begin
  select * into v_session from public.cash_sessions where id = p_session_id for update;
  if not found then raise exception 'turno_no_encontrado'; end if;
  if not private.tiene_rol(v_session.tenant_id, array['owner']) then
    raise exception 'solo_owner_puede_forzar_cierre';
  end if;
  if length(btrim(coalesce(p_override_reason, ''))) < 8 then
    raise exception 'motivo_de_override_requerido';
  end if;
  if v_session.status = 'closed' then return v_session; end if;
  select public.cash_session_expected(p_session_id) into v_expected;
  update public.cash_sessions set
    status = 'closed', closed_at = now(), closed_by = auth.uid(),
    closing_amount = coalesce(p_closing_amount, 0), expected_amount = v_expected,
    difference = coalesce(p_closing_amount, 0) - v_expected,
    notes = concat_ws(E'\n', nullif(btrim(coalesce(p_notes, '')), ''),
      'CIERRE FORZADO: ' || btrim(p_override_reason))
   where id = p_session_id returning * into v_session;
  return v_session;
end $$;

revoke all on function public.cash_session_blockers(uuid) from public, anon;
revoke all on function public.force_close_cash_session(uuid, numeric, text, text) from public, anon;
grant execute on function public.cash_session_blockers(uuid) to authenticated;
grant execute on function public.force_close_cash_session(uuid, numeric, text, text) to authenticated;

/* ---------------------- Evidencia privada en Storage ------------------ */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cash-evidence', 'cash-evidence', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_access_cash_evidence(p_name text, p_write boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public, private, storage, pg_temp
as $$
  select exists (
    select 1
      from public.staff_cash_settlements scs
     where scs.tenant_id::text = split_part(p_name, '/', 1)
       and scs.id::text = split_part(p_name, '/', 2)
       and scs.tenant_id in (select private.current_user_tenants())
       and private.alcanza_branch(scs.tenant_id, scs.branch_id)
       and (
         scs.submitted_by = auth.uid()
         or private.tiene_rol(scs.tenant_id, array['owner','manager','cashier'])
       )
       and (not p_write or scs.status in ('submitted','observed'))
  )
$$;

create policy cash_evidence_read on storage.objects for select using (
  bucket_id = 'cash-evidence' and private.can_access_cash_evidence(name, false)
);
create policy cash_evidence_insert on storage.objects for insert with check (
  bucket_id = 'cash-evidence' and private.can_access_cash_evidence(name, true)
);
create policy cash_evidence_delete on storage.objects for delete using (
  bucket_id = 'cash-evidence' and private.can_access_cash_evidence(name, true)
);

/* ----------------------- Auditoria de lo sensible --------------------- */

do $$
declare t text;
begin
  foreach t in array array[
    'staff_cash_settlements','payment_evidence','cash_exceptions',
    'fiscal_profiles','fiscal_documents'
  ] loop
    execute format('drop trigger if exists trg_auditar on public.%I', t);
    execute format(
      'create trigger trg_auditar after insert or update or delete on public.%I '
      'for each row execute function public.auditar()', t
    );
  end loop;
end $$;
