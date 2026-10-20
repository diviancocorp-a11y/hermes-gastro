-- 0107 Recetario del edificio. Aplicada via MCP el 20/oct/2026.
-- Sin fotos/bucket en esta entrega. visible_to no protege product_ingredients.
-- Manager solo guarda fichas que conserva permiso para leer; owner ve todo.

alter table public.products add constraint products_tenant_id_id_recetario_key unique (tenant_id, id);
create function private.valid_product_allergens(value text[]) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select cardinality(value) <= 50 and array_position(value, null) is null
    and not exists (select 1 from unnest(value) item where length(btrim(item)) not between 1 and 100)
$$;
revoke all on function private.valid_product_allergens(text[]) from public, anon;
grant execute on function private.valid_product_allergens(text[]) to authenticated, service_role;
alter table public.products add column allergens text[] not null default '{}';
alter table public.products add constraint products_allergens_recetario_check check (
  private.valid_product_allergens(allergens)
);

-- Un helper puro permite validar todos los elementos JSON sin subqueries en CHECK.
create function private.valid_recipe_card_steps(value jsonb) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select case when jsonb_typeof(value) <> 'array' then false
    else jsonb_array_length(value) <= 100 and not exists (
      select 1 from jsonb_array_elements(value) step
      where jsonb_typeof(step) <> 'object'
        or jsonb_typeof(step->'texto') is distinct from 'string'
        or length(btrim(step->>'texto')) not between 1 and 4000
        or step - 'texto' <> '{}'::jsonb
    ) end
$$;
revoke all on function private.valid_recipe_card_steps(jsonb) from public, anon;
grant execute on function private.valid_recipe_card_steps(jsonb) to authenticated, service_role;

create table public.recipe_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null unique,
  yield_qty numeric not null default 1 check (yield_qty > 0 and yield_qty <= 1000000000),
  yield_unit text not null default 'unidad' check (length(btrim(yield_unit)) between 1 and 50),
  time_minutes integer check (time_minutes >= 0),
  steps jsonb not null default '[]' check (private.valid_recipe_card_steps(steps)),
  notes text check (length(notes) <= 10000),
  visible_to text[] not null default array['owner','manager','kitchen'] check (
    cardinality(visible_to) between 1 and 3
    and visible_to <@ array['owner','manager','kitchen']::text[]
    and array_position(visible_to, null) is null
    and cardinality(visible_to) = (('owner' = any(visible_to))::int
      + ('manager' = any(visible_to))::int + ('kitchen' = any(visible_to))::int)
  ),
  is_archived boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_cards_product_same_tenant foreign key (tenant_id, product_id)
    references public.products(tenant_id, id) on delete cascade
);
create index recipe_cards_tenant_idx on public.recipe_cards(tenant_id);

create function private.stamp_recipe_card() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
       or new.product_id is distinct from old.product_id then
      raise exception 'La identidad de la ficha no se puede cambiar' using errcode = '23514';
    end if;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end
$$;
revoke all on function private.stamp_recipe_card() from public, anon, authenticated;
create trigger recipe_cards_stamp before insert or update on public.recipe_cards
  for each row execute function private.stamp_recipe_card();

alter table public.recipe_cards enable row level security;
revoke all on public.recipe_cards from anon, authenticated;
grant select, insert, update, delete on public.recipe_cards to authenticated;
grant all on public.recipe_cards to service_role;

create policy recipe_cards_select on public.recipe_cards for select to authenticated using (
  tenant_id in (select private.current_user_tenants()) and (
    private.tiene_rol(tenant_id, array['owner']) or (
      private.tiene_rol(tenant_id, array['manager','kitchen'])
      and private.tiene_rol(tenant_id, visible_to)
    )
  )
);
create policy recipe_cards_insert on public.recipe_cards for insert to authenticated with check (
  tenant_id in (select private.current_user_tenants()) and (
    private.tiene_rol(tenant_id, array['owner']) or (
      private.tiene_rol(tenant_id, array['manager']) and 'manager' = any(visible_to)
    )
  )
);
create policy recipe_cards_update on public.recipe_cards for update to authenticated using (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner','manager'])
) with check (
  tenant_id in (select private.current_user_tenants()) and (
    private.tiene_rol(tenant_id, array['owner']) or (
      private.tiene_rol(tenant_id, array['manager']) and 'manager' = any(visible_to)
    )
  )
);
create policy recipe_cards_delete on public.recipe_cards for delete to authenticated using (
  tenant_id in (select private.current_user_tenants())
  and private.tiene_rol(tenant_id, array['owner'])
);
