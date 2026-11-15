-- 0134 — Cochi: isotipo y logo de footer en rojo.
-- Aplicada via MCP el 2026-11-15. Solo datos.
--
-- La 0133 uso las versiones crema (las del sitio de Cochi, que tiene fondo rojo
-- en intro y footer). La plantilla pop pinta la intro y el footer sobre el fondo
-- crema de la marca: crema sobre crema no se veia. Se cambian por las rojas.
--
-- Volver atras: poner de nuevo cochi-brand-cochi-isotipo-cream-63ae588c.png en
-- marca.isotipo y cochi-brand-cochi-logo-cream-69ae4a56.png en marca.logo_footer.

do $$
declare
  b text := 'https://wwwzdgprsooyjgkuyoav.supabase.co/storage/v1/object/public/tenant-images/27881a18-b49e-4ff4-831f-de7f5acf4aa5/';
  cfg jsonb;
begin
  select catalog_template_config into cfg from public.settings
   where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5';
  if cfg is null then raise exception 'cochi sin config de plantilla'; end if;

  cfg := jsonb_set(cfg, '{marca}', (cfg->'marca') || jsonb_build_object(
    'isotipo',     b || 'cochi-brand-cochi-isotipo-red-c47c3c71.png',
    'logo_footer', b || 'cochi-brand-cochi-logo-red-e98f19f2.png'));

  if not private.valid_template_config(cfg) then
    raise exception 'catalog_template_config de Cochi no valida';
  end if;

  update public.settings set catalog_template_config = cfg
   where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5';
end $$;
