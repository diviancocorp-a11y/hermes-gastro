-- 0147 — Cochi: estilo de impacto en la plantilla pop (solo datos).
-- Aplicada via MCP el 2026-11-19
--
-- Activa en Cochi lo que el sitio original tiene y la plantilla ahora sabe pintar:
--   marca.menu_oscuro, marca.titulo_acento, marca.anuncios_acento
--   textos de cierre y de la historia (los del sitio de Cochi)
--   logo del footer en crema (el footer ahora es oscuro; la 0134 lo habia puesto
--   en rojo para el footer crema)
--
-- Volver atras: quitar esas tres claves de marca y los cinco textos, y poner de
-- nuevo cochi-brand-cochi-logo-red-e98f19f2.png en marca.logo_footer.

do $$
declare
  t uuid := '27881a18-b49e-4ff4-831f-de7f5acf4aa5';
  b text := 'https://wwwzdgprsooyjgkuyoav.supabase.co/storage/v1/object/public/tenant-images/27881a18-b49e-4ff4-831f-de7f5acf4aa5/';
  cfg jsonb;
begin
  select catalog_template_config into cfg from public.settings where tenant_id = t;
  if cfg is null then raise exception 'cochi sin config de plantilla'; end if;

  cfg := jsonb_set(cfg, '{marca}', coalesce(cfg->'marca', '{}'::jsonb) || jsonb_build_object(
    'menu_oscuro', true, 'titulo_acento', true, 'anuncios_acento', true,
    'logo_footer', b || 'cochi-brand-cochi-logo-cream-69ae4a56.png'));
  cfg := jsonb_set(cfg, '{textos}', coalesce(cfg->'textos', '{}'::jsonb) || jsonb_build_object(
    'historia_cta', 'Vamos a elegir',
    'footer_nav', 'LA SIGUIENTE JUGADA',
    'footer_titulo', '¿Listo para pedir algo brutal?',
    'footer_boton', 'Arma tu pedido',
    'footer_lema', 'El antojo tiene nombre.'));

  if not private.valid_template_config(cfg) then
    raise exception 'catalog_template_config de Cochi no valida';
  end if;

  update public.settings set catalog_template_config = cfg where tenant_id = t;
end $$;
