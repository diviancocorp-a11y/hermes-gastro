-- 0096 provision_owner y attach_owner hablan el modelo de roles de 0050.
--
-- Visto el 14/oct/2026 al crear el tenant monare:
--
-- 1) provision_owner (0008) insertaba solo role='owner'. Desde 0050 el trigger
--    tenant_members_sync_role DERIVA `role` desde `roles`, cuyo default es
--    array['attendant']: el duenio recien creado quedaba role=staff,
--    roles=['attendant']. Ahora inserta roles=array['owner'].
--
-- 2) attach_owner (0024) usaba ON CONFLICT (tenant_id, user_id), una constraint
--    que 0050 reemplazo por UNIQUE NULLS NOT DISTINCT (tenant_id, user_id,
--    branch_id). Fallaba con "there is no unique or exclusion constraint
--    matching the ON CONFLICT specification". Ahora apunta a la constraint
--    tenant_members_una_fila_por_sucursal, con branch_id null (todas las
--    sucursales, el caso del duenio), y actualiza `roles`, que es la verdad.
--    'staff' se mapea a 'manager', igual que el backfill de 0050.
--
-- Firmas, grants y search_path no cambian.

create or replace function public.provision_owner(
  p_user_id uuid, p_email text, p_name text, p_vertical text, p_slug text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant uuid;
begin
  insert into public.tenants(slug, name, vertical)
    values (p_slug, coalesce(p_name, p_slug), p_vertical)
    returning id into v_tenant;
  insert into public.tenant_members(tenant_id, user_id, roles)
    values (v_tenant, p_user_id, array['owner']);
  insert into public.profiles(id, tenant_id, full_name, email)
    values (p_user_id, v_tenant, p_name, p_email);
  return v_tenant;
end $$;

revoke all on function public.provision_owner(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.provision_owner(uuid,text,text,text,text) to service_role;

create or replace function public.attach_owner(
  p_user_id uuid, p_slug text, p_role text default 'owner'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant uuid;
begin
  if p_role not in ('owner', 'staff') then
    raise exception 'rol invalido: % (owner|staff)', p_role;
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'no existe usuario con id %', p_user_id;
  end if;

  select t.id into v_tenant from public.tenants t where t.slug = p_slug;
  if v_tenant is null then
    raise exception 'no existe tenant con slug %', p_slug;
  end if;

  insert into public.tenant_members(tenant_id, user_id, roles)
    values (v_tenant, p_user_id,
            case when p_role = 'owner' then array['owner'] else array['manager'] end)
    on conflict on constraint tenant_members_una_fila_por_sucursal
    do update set roles = excluded.roles;

  insert into public.profiles(id, tenant_id, full_name, email)
    select p_user_id, v_tenant, u.raw_user_meta_data->>'full_name', u.email
    from auth.users u where u.id = p_user_id
    on conflict (id) do nothing;

  return v_tenant;
end $$;

revoke all on function public.attach_owner(uuid, text, text) from public;
revoke all on function public.attach_owner(uuid, text, text) from anon;
revoke all on function public.attach_owner(uuid, text, text) from authenticated;
grant execute on function public.attach_owner(uuid, text, text) to service_role;
