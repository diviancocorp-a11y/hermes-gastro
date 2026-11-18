-- 0145 — Solo el duenio cambia la plantilla del catalogo.
-- Aplicada via MCP el 2026-11-18
--
-- La policy settings_update (0050) deja escribir a duenio Y encargado. El editor
-- de marca (fase 7) es solo del duenio: la pantalla lo esconde, y este trigger
-- lo hace cumplir en la base. Solo mira catalog_template y
-- catalog_template_config: el resto de settings sigue como estaba.
-- Sin sesion (service_role, migraciones, MCP: auth.uid() null) no frena.

create or replace function private.solo_duenio_cambia_plantilla()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.catalog_template is distinct from old.catalog_template
      or new.catalog_template_config is distinct from old.catalog_template_config)
     and not private.tiene_rol(new.tenant_id, array['owner']) then
    raise exception 'solo_duenio: solo el duenio puede cambiar la plantilla del catalogo'
      using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.solo_duenio_cambia_plantilla() from public, anon, authenticated;

drop trigger if exists settings_plantilla_solo_duenio on public.settings;
create trigger settings_plantilla_solo_duenio
  before update on public.settings
  for each row execute function private.solo_duenio_cambia_plantilla();
