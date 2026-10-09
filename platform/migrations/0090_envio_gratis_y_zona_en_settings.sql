-- 0090 — Envio gratis y zona de entrega, editables desde Personalizacion.
--
-- 0087/0088 hicieron que get_catalog emitiera free_delivery_over y
-- delivery_zone, pero ambos viven SOLO en tenants.settings (jsonb), que se
-- cargaba a mano. Personalizacion edita la tabla `settings`, asi que:
--   - no habia donde editarlos (ni campo, ni columna), y
--   - delivery_pricing de la tabla estaba en NULL aunque tenants.settings
--     tenia los escalones reales: la pantalla mostraba los de fabrica
--     (500/1000/1800...) en vez de los del negocio.
-- Esto agrega las dos columnas, trae lo ya cargado a la tabla (el catalogo no
-- cambia: el espejo devuelve lo mismo a tenants.settings) y hace que el
-- espejo las copie.

alter table public.settings
  add column if not exists free_delivery_over numeric,
  add column if not exists delivery_zone jsonb;

update public.settings s
   set delivery_pricing  = coalesce(s.delivery_pricing,  t.settings->'delivery_pricing'),
       free_delivery_over = coalesce(s.free_delivery_over, nullif(t.settings->>'free_delivery_over', '')::numeric),
       delivery_zone     = coalesce(s.delivery_zone,     t.settings->'delivery_zone')
  from public.tenants t
 where t.id = s.tenant_id;

create or replace function public.espejar_settings_a_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tenants t
     set settings = coalesce(t.settings, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
       'biz_name',         new.biz_name,
       'logo_color',       new.logo_color,
       'logo_url',         new.logo_url,
       'cover_url',        new.cover_url,
       'slogan',           new.slogan,
       'catalog_theme',    new.catalog_theme,
       'prep_time_min',    new.prep_time_min,
       'deal_pct',         new.deal_pct,
       'min_order_amount', new.min_order_amount,
       'daily_deals',      new.daily_deals,
       'cat_groups',       new.cat_groups,
       'delivery_pricing', new.delivery_pricing,
       'payment_accounts', new.payment_accounts,
       'whatsapp',         nullif(trim(new.whatsapp), ''),
       'instagram',        nullif(trim(new.instagram), ''),
       'facebook',         nullif(trim(new.facebook), ''),
       'tiktok',           nullif(trim(new.tiktok), ''),
       'youtube',          nullif(trim(new.youtube), ''),
       'twitter',          nullif(trim(new.twitter), ''),
       'telegram',         nullif(trim(new.telegram), ''),
       'free_delivery_over', new.free_delivery_over,
       'delivery_zone',    new.delivery_zone
     ))
   where t.id = new.tenant_id;
  return new;
end $$;
