-- 0146 — Plantilla de catalogo: tres interruptores de marca y cinco textos mas.
-- Aplicada via MCP el 2026-11-19
--
-- Aditiva: private.valid_template_config acepta un superset de lo que aceptaba
-- (misma firma, `create or replace`), asi que el codigo viejo sigue andando.
--   marca.menu_oscuro      seccion del menu sobre fondo de tinta, titulo en claro
--   marca.titulo_acento    la ultima palabra de los titulos va en el color primario
--   marca.anuncios_acento  la barra de anuncios va en el color primario
--   textos.historia_cta, footer_nav, footer_titulo, footer_boton, footer_lema
-- Las listas se comparan con src/lib/plantillaListas.js en plantillaConfigSync.test.js.

create or replace function private.valid_template_config(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $valid$
declare
  k text; v jsonb; item jsonb; ik text; iv jsonb;
  top_keys text[] := array['secciones','marca','textos','anuncios','cinta','intro','flyers','testimonios','submarca'];
  seccion_ids text[] := array['hero','cinta','favoritos','flyers','menu','submarca','banda','testimonios','historia'];
  marca_colores text[] := array['primario','fondo','texto','acento2'];
  marca_urls text[] := array['logo_header','logo_footer','isotipo'];
  marca_bools text[] := array['menu_oscuro','titulo_acento','anuncios_acento'];
  fuentes text[] := array['Montserrat','Inter','DM Sans','Poppins','Playfair Display','Source Serif 4','Instrument Serif','DM Serif Display','Bebas Neue','Lora'];
  texto_keys text[] := array['hero_eyebrow','hero_titulo','hero_lead','hero_cta','hero_nota','hero_sello','intro_caption',
    'favoritos_eyebrow','favoritos_titulo','favoritos_aside','flyers_eyebrow','flyers_titulo','menu_eyebrow','menu_titulo','menu_lead',
    'banda_eyebrow','banda_titulo','banda_texto','banda_imagen','testimonios_eyebrow','testimonios_titulo',
    'historia_eyebrow','historia_titulo','historia_texto','historia_sello',
    'historia_cta','footer_nav','footer_titulo','footer_boton','footer_lema'];
  submarca_keys text[] := array['nombre','categoria','eyebrow','titulo','texto','fondo','color','logo','isotipo'];
  flyer_keys text[] := array['titulo','texto','imagen','badge','link','desde','hasta','activo'];
  quote_keys text[] := array['texto','nombre'];
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'object' or length(value::text) > 16384 then return false; end if;
  for k, v in select * from jsonb_each(value) loop
    if not (k = any (top_keys)) then return false; end if;
    if k = 'secciones' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 12 then return false; end if;
      for item in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'object' or not (item ? 'id') then return false; end if;
        for ik, iv in select * from jsonb_each(item) loop
          if ik = 'id' then
            if jsonb_typeof(iv) <> 'string' or not ((iv #>> '{}') = any (seccion_ids)) then return false; end if;
          elsif ik = 'on' then
            if jsonb_typeof(iv) <> 'boolean' then return false; end if;
          else return false; end if;
        end loop;
      end loop;
    elsif k = 'marca' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      for ik, iv in select * from jsonb_each(v) loop
        if ik = any (marca_colores) then
          if jsonb_typeof(iv) <> 'string' or (iv #>> '{}') !~ '^#[0-9a-fA-F]{6}$' then return false; end if;
        elsif ik in ('fuente_titulo','fuente_texto') then
          if jsonb_typeof(iv) <> 'string' or not ((iv #>> '{}') = any (fuentes)) then return false; end if;
        elsif ik = 'radio' then
          if jsonb_typeof(iv) <> 'string' or (iv #>> '{}') not in ('recto','suave','pildora') then return false; end if;
        elsif ik = any (marca_bools) then
          if jsonb_typeof(iv) <> 'boolean' then return false; end if;
        elsif ik = any (marca_urls) then
          if jsonb_typeof(iv) <> 'string' or length(iv #>> '{}') > 500 or (iv #>> '{}') !~ '^(https://|/)' then return false; end if;
        else return false; end if;
      end loop;
    elsif k = 'textos' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      for ik, iv in select * from jsonb_each(v) loop
        if not (ik = any (texto_keys)) or jsonb_typeof(iv) <> 'string' or length(iv #>> '{}') > 400 then return false; end if;
        if ik = 'banda_imagen' and (iv #>> '{}') !~ '^(https://|/)' then return false; end if;
      end loop;
    elsif k in ('anuncios','cinta') then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 12 then return false; end if;
      for item in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 80 then return false; end if;
      end loop;
    elsif k = 'intro' then
      if jsonb_typeof(v) <> 'boolean' then return false; end if;
    elsif k = 'flyers' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 8 then return false; end if;
      for item in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'object' then return false; end if;
        for ik, iv in select * from jsonb_each(item) loop
          if not (ik = any (flyer_keys)) then return false; end if;
          if ik = 'activo' then
            if jsonb_typeof(iv) <> 'boolean' then return false; end if;
          elsif jsonb_typeof(iv) <> 'string' or length(iv #>> '{}') > 400 then return false;
          elsif ik = 'imagen' and (iv #>> '{}') !~ '^(https://|/)' then return false;
          elsif ik in ('desde','hasta') and (iv #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false;
          end if;
        end loop;
      end loop;
    elsif k = 'testimonios' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 8 then return false; end if;
      for item in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(item) <> 'object' then return false; end if;
        for ik, iv in select * from jsonb_each(item) loop
          if not (ik = any (quote_keys)) or jsonb_typeof(iv) <> 'string' or length(iv #>> '{}') > 400 then return false; end if;
        end loop;
      end loop;
    elsif k = 'submarca' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      for ik, iv in select * from jsonb_each(v) loop
        if not (ik = any (submarca_keys)) or jsonb_typeof(iv) <> 'string' or length(iv #>> '{}') > 400 then return false; end if;
        if ik in ('fondo','color') and (iv #>> '{}') !~ '^#[0-9a-fA-F]{6}$' then return false; end if;
        if ik in ('logo','isotipo') and (iv #>> '{}') !~ '^(https://|/)' then return false; end if;
      end loop;
    end if;
  end loop;
  return true;
end $valid$;
