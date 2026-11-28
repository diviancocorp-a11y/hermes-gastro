-- PENDIENTE de aplicar (la aplica el director via MCP con ok de Ricky)
-- 0152 — Plantilla exclusiva `cochi`: el nombre nuevo entra a la lista y solo el
-- tenant con slug 'cochi' puede usarla.
--
-- Por que: el disenador externo de Cochi trabaja en un fork, en
-- src/catalog-pro/plantillas/cochi/. Esa portada solo la ve Cochi; para que
-- ningun otro tenant la pueda elegir (ni desde el panel ni con una llamada
-- directa a la API) la regla vive en la base y no solo en el editor.
--
-- 1. Se amplia settings_catalog_template_check ('default','pop' -> + 'cochi').
--    Nadie pierde nada: todo valor valido de antes lo sigue siendo.
-- 2. private.plantilla_exclusiva_del_tenant() + trigger before insert or update
--    of catalog_template: si la plantilla es 'cochi' y el slug del tenant no es
--    'cochi', rechaza con 42501. Corre SIEMPRE, tambien sin sesion (service_role,
--    migraciones, MCP): a diferencia de 0145, aca no se salta nada.
--
-- Lo viejo sigue andando: el codigo desplegado no conoce 'cochi' y no lo escribe.
-- La activacion de Cochi (dato) es la 0153, DESPUES del deploy del front.
-- La lista de nombres se compara contra src/lib/plantillaListas.js en
-- src/test/plantillaConfigSync.test.js. Test de la base: platform/tests/plantilla_exclusiva.sql

alter table public.settings
  drop constraint settings_catalog_template_check,
  add constraint settings_catalog_template_check
    check (catalog_template is null or catalog_template in ('default','pop','cochi'));

create or replace function private.plantilla_exclusiva_del_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_slug text;
begin
  if new.catalog_template = 'cochi' then
    select t.slug into v_slug from public.tenants t where t.id = new.tenant_id;
    if v_slug is distinct from 'cochi' then
      raise exception 'plantilla_exclusiva: la plantilla cochi es solo del negocio cochi'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.plantilla_exclusiva_del_tenant() from public, anon, authenticated;

drop trigger if exists settings_plantilla_exclusiva on public.settings;
create trigger settings_plantilla_exclusiva
  before insert or update of catalog_template on public.settings
  for each row execute function private.plantilla_exclusiva_del_tenant();
