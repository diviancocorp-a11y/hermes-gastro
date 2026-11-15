-- 0133 — Cochi: logos, isotipos, imagenes de flyers y fotos de producto.
-- Aplicada via MCP el 2026-11-15. Solo datos; no cambia esquema.
--
-- Los 14 archivos ya estan en el bucket tenant-images, carpeta del tenant cochi
-- (subidos por Ricky con el script de la sesion; nombre con hash del contenido).
-- Mezcla sobre la config de la 0129 con || y jsonb_set: no pisa textos, colores
-- ni secciones. Valida con private.valid_template_config antes de escribir.
--
-- Volver atras (quita solo lo de esta migracion):
--   update public.settings set catalog_template_config =
--     (catalog_template_config
--        #- '{marca,logo_header}' #- '{marca,logo_footer}' #- '{marca,isotipo}'
--        #- '{submarca,logo}' #- '{submarca,isotipo}')
--     || jsonb_build_object('flyers', (select jsonb_agg(f - 'imagen')
--          from jsonb_array_elements(catalog_template_config->'flyers') f))
--   where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5';
--   update public.products set image_url = null
--    where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5'
--      and name in ('Shawarma de Carne','Shawarma César','½ pollo asado','Pollo entero');

do $$
declare
  b text := 'https://wwwzdgprsooyjgkuyoav.supabase.co/storage/v1/object/public/tenant-images/27881a18-b49e-4ff4-831f-de7f5acf4aa5/';
  cfg jsonb;
begin
  select catalog_template_config into cfg from public.settings
   where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5';
  if cfg is null then raise exception 'cochi sin config de plantilla'; end if;

  cfg := jsonb_set(cfg, '{marca}', coalesce(cfg->'marca','{}'::jsonb) || jsonb_build_object(
    'logo_header', b || 'cochi-brand-cochi-logo-red-e98f19f2.png',
    'logo_footer', b || 'cochi-brand-cochi-logo-cream-69ae4a56.png',
    'isotipo',     b || 'cochi-brand-cochi-isotipo-cream-63ae588c.png'));

  cfg := jsonb_set(cfg, '{submarca}', coalesce(cfg->'submarca','{}'::jsonb) || jsonb_build_object(
    'logo',     b || 'cochi-brand-dulce-logo-chocolate-3af0854c.png',
    'isotipo',  b || 'cochi-brand-dulce-isotipo-chocolate-25858ac7.png'));

  cfg := jsonb_set(cfg, '{flyers}', (
    select jsonb_agg(
      case f->>'titulo'
        when 'Agrégale papas a tu shawarma' then f || jsonb_build_object('imagen', b || 'cochi-flyers-papas-shawarma-797ec9e5.webp')
        when 'Más contornos, más Cochi'     then f || jsonb_build_object('imagen', b || 'cochi-flyers-contornos-3cef4b31.webp')
        when '¿Ya probaste Cochi?'          then f || jsonb_build_object('imagen', b || 'cochi-flyers-ya-probaste-2dfafda5.webp')
        else f end
      order by o)
    from jsonb_array_elements(cfg->'flyers') with ordinality as t(f, o)));

  if not private.valid_template_config(cfg) then
    raise exception 'catalog_template_config de Cochi no valida';
  end if;

  update public.settings set catalog_template_config = cfg
   where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5';

  update public.products p set image_url = b || v.f
    from (values
      ('Shawarma de Carne', 'cochi-food-shawarma-carne-papas-5cb6c53e.webp'),
      ('Shawarma César',    'cochi-food-shawarma-cesar-98eedd38.webp'),
      ('½ pollo asado',     'cochi-food-pollo-asado-30f4b3d4.webp'),
      ('Pollo entero',      'cochi-food-pollo-asado-30f4b3d4.webp')
    ) as v(name, f)
   where p.tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5' and p.name = v.name;
end $$;
