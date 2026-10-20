-- 0100_diagnosticos_de_la_landing.sql
-- Aplicada via MCP el 19/oct/2026 (ok de Ricky en el chat).
--
-- El diagnostico de la landing (divianco.app/diagnostico) reemplaza al "dejanos
-- tu email": la persona cuenta que tipo de establecimiento tiene, por donde
-- vende, su escala, como controla hoy costos y resultados y cual es su
-- principal desafio; Dico le devuelve como lo resuelve y que plan le conviene.
-- Cada diagnostico queda guardado para saber quien llego, que le duele y si
-- despues se dio de alta.
--
-- Quien escribe: la edge function publica `diagnostico` (verify_jwt=false,
-- rate limit por IP con check_rate_limit, validacion de cada campo) con el
-- service role. Nadie del front inserta directo: la tabla no tiene policy de
-- insert.
-- Quien lee: solo el staff de Divianco (mismo patron que organizations, 0058).
-- Sin tenant_id en la policy: es un dato de la plataforma, no de un negocio.
-- No guarda email, telefono ni nombre de persona.

create table if not exists public.diagnosticos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  vertical text not null
    check (vertical in ('gastronomia', 'comercio', 'servicios', 'otro')),
  -- Solo para gastronomia; en las otras verticales queda nulo.
  establecimiento text
    check (establecimiento in ('restaurante', 'parrilla', 'cafeteria',
      'panaderia_pasteleria', 'bar_cerveceria', 'dark_kitchen')),
  -- Canales de venta, varios a la vez.
  canales text[] not null default '{}'
    check (canales <@ array['salon', 'mostrador', 'delivery_propio',
      'apps_delivery', 'catalogo_online']::text[]),
  locales text not null
    check (locales in ('uno', 'dos_tres', 'cuatro_o_mas')),
  equipo text
    check (equipo in ('hasta_5', 'de_6_a_15', 'mas_de_15')),
  gestion_actual text not null
    check (gestion_actual in ('planillas', 'registro_manual', 'otro_sistema',
      'contador', 'sin_control')),
  desafio text not null
    check (desafio in ('rentabilidad', 'costos', 'costo_laboral',
      'mermas_caja', 'pedidos')),
  plan_recomendado text not null
    check (plan_recomendado in ('digital', 'local', 'cadena')),
  nombre_negocio text check (char_length(nombre_negocio) <= 80),
  origen text check (char_length(origen) <= 200),   -- utm o referer, recortado
  tenant_id uuid references public.tenants(id) on delete set null,
  vinculado_at timestamptz,
  constraint diagnosticos_establecimiento_solo_gastro
    check (establecimiento is null or vertical = 'gastronomia')
);

comment on table public.diagnosticos is
  'Diagnosticos de la landing. Escribe la edge function diagnostico (service '
  'role); lee el staff de Divianco. tenant_id se completa si la persona se da '
  'de alta despues (vincular_diagnostico).';

create index if not exists diagnosticos_created_at_idx
  on public.diagnosticos (created_at desc);

alter table public.diagnosticos enable row level security;

drop policy if exists diagnosticos_staff_lee on public.diagnosticos;
create policy diagnosticos_staff_lee on public.diagnosticos
  for select to authenticated
  using (private.es_staff_divianco());

-- Al terminar el alta (Bienvenido), el duenio recien creado vincula su
-- diagnostico a su negocio. Solo un diagnostico sin vincular y de los ultimos
-- 7 dias, y solo hacia un negocio del que el usuario ya es parte.
create or replace function public.vincular_diagnostico(p_diagnostico uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant uuid;
begin
  select t into v_tenant from private.current_user_tenants() as t limit 1;
  if v_tenant is null then
    return false;
  end if;

  update public.diagnosticos
     set tenant_id = v_tenant, vinculado_at = now()
   where id = p_diagnostico
     and tenant_id is null
     and created_at > now() - interval '7 days';

  return found;
end;
$$;

revoke all on function public.vincular_diagnostico(uuid) from public, anon;
grant execute on function public.vincular_diagnostico(uuid) to authenticated;
