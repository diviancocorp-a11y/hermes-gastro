-- 0096 El alta de duenio escribe `roles`, no `role`.
-- Aplicada via MCP el 14/oct/2026 (schema_migrations 20261014200301,
-- `alta_de_duenio_con_roles`). Este archivo se escribio el 16/oct copiando
-- `statements` de esa fila tal cual: el SQL de abajo es lo que corre en la base.
--
-- ══════════════════ POR QUE ══════════════════
--
-- La 0050 paso tenant_members de un `role` texto a `roles` array y lo volvio
-- NOT NULL. `provision_owner` (0008) y `attach_owner` (0024) siguieron
-- insertando solo `role`: el alta de duenio fallaba por `roles` nulo. El
-- arreglo se aplico en la base y no se escribio en el repo, asi que hasta hoy
-- las migraciones decian que corria la version rota.
--
-- Lo encontro el 16/oct el historial de migraciones de la base: una fila sin
-- archivo. check-functions-drift no la veia porque las dos funciones no
-- estaban en CRITICAS y la firma no cambio. Ahora estan en CRITICAS.
--
-- ══════════════════ QUE CAMBIA ══════════════════
--
-- provision_owner: inserta `roles = array['owner']`.
-- attach_owner:    'owner' -> array['owner'], 'staff' -> array['manager'];
--                  el upsert va por tenant_members_una_fila_por_sucursal
--                  (la PK vieja (tenant_id, user_id) ya no es la clave).
-- Misma firma y mismos permisos (solo service_role) que antes.

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
