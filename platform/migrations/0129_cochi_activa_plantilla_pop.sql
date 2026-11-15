-- 0129 — Cochi activa la plantilla de catalogo "pop" (sin imagenes todavia).
-- Aplicada via MCP el 2026-11-14. Solo datos; no cambia esquema.
--
-- settings: catalog_template = 'pop' + catalog_template_config (marca, secciones,
-- textos, anuncios, cinta, flyers sin imagen, sub-marca Cochi Dulce, intro).
-- Sin logos ni fotos: la plantilla cae a la letra del negocio y el hero va sin
-- imagen. La 0130 suma logos, isotipos, flyers con imagen y image_url.
-- products: catalog_attributes (featured, days) mezclado con lo existente, por
-- nombre exacto de la base. No toca precios ni nombres.
--
-- Volver atras:
--   update public.settings set catalog_template = null, catalog_template_config = null
--    where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5';
--   (los catalog_attributes son inertes con la portada de siempre)

do $$
declare cfg jsonb := $cfg${
  "marca": {
    "primario": "#eb140c",
    "fondo": "#f5f0dc",
    "texto": "#211e1a",
    "acento2": "#e6e0bf",
    "fuente_titulo": "Montserrat",
    "fuente_texto": "Montserrat",
    "radio": "suave"
  },
  "intro": true,
  "anuncios": [
    "EL ANTOJO TIENE NOMBRE",
    "TRABAJAMOS DE VIERNES A DOMINGO",
    "ARMA TU PEDIDO",
    "COCHI, SIN COMPLICACIONES"
  ],
  "cinta": [
    "GRANDE EL ANTOJO",
    "SIN COMPLICACIONES",
    "CON ACTITUD",
    "CON FUEGO"
  ],
  "textos": {
    "hero_eyebrow": "DARK KITCHEN · SABOR CON ACTITUD",
    "hero_titulo": "HOY SE COME BRUTAL.",
    "hero_lead": "Shawarmas que se roban la escena, costillas con carácter y ese antojo que no se queda en \"después veo\".",
    "hero_cta": "Ver el menú",
    "intro_caption": "EL ANTOJO TIENE NOMBRE",
    "favoritos_eyebrow": "LA PRIMERA MORDIDA",
    "favoritos_titulo": "Los que se antojan.",
    "flyers_eyebrow": "LO NUEVO EN COCHI",
    "flyers_titulo": "Ofertas y novedades.",
    "menu_eyebrow": "ELIGE TU JUGADA",
    "menu_titulo": "EL MENÚ.",
    "banda_eyebrow": "DOMINGOS CON SABOR",
    "banda_titulo": "EL DOMINGO TIENE PLAN.",
    "banda_texto": "El pollo asado está indicado para los domingos. Revisa su disponibilidad en el menú antes de sumarlo al pedido.",
    "historia_eyebrow": "ESTA ES LA ACTITUD",
    "historia_titulo": "NO ES SOLO COMER. ES COCHI.",
    "historia_texto": "Una identidad con fuego, sabores que llaman la atención y una experiencia fácil para elegir lo que te provoca.",
    "historia_sello": "COCHI DESDE EL PRIMER BOCADO"
  },
  "flyers": [
    {
      "titulo": "Agrégale papas a tu shawarma",
      "texto": "Por solo $1 en lugar de $1.50. Elige tu shawarma y marca la opción de papas.",
      "badge": "OFERTA",
      "link": "#menu",
      "activo": true
    },
    {
      "titulo": "Más contornos, más Cochi",
      "texto": "Elige entre papas, yuca o ensalada por +$2 y agrega otra ración. Pollo asado solo los domingos o por encargo.",
      "badge": "DOMINGOS",
      "link": "#menu",
      "activo": true
    },
    {
      "titulo": "¿Ya probaste Cochi?",
      "texto": "Shawarmas, costillas y más. Arma tu pedido desde el menú.",
      "link": "#favoritos",
      "activo": true
    }
  ],
  "submarca": {
    "nombre": "Cochi Dulce",
    "categoria": "Postres",
    "eyebrow": "UNA PAUSA MÁS DULCE",
    "titulo": "EL POSTRE NO SE NEGOCIA.",
    "texto": "Conoce el lado más dulce de Cochi. La marquesa de chocolate es la invitada de hoy; y esto apenas comienza.",
    "fondo": "#f1d6df",
    "color": "#4b2928"
  },
  "testimonios": []
}$cfg$::jsonb;
begin
  if not private.valid_template_config(cfg) then
    raise exception 'catalog_template_config de Cochi no valida';
  end if;

  update public.settings
     set catalog_template = 'pop', catalog_template_config = cfg
   where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5';

  if not found then raise exception 'cochi sin fila en settings'; end if;
end $$;

update public.products p
   set catalog_attributes = coalesce(p.catalog_attributes, '{}'::jsonb) || v.attrs
  from (values
    ('Ración individual de Ribs a las BBQ', '{"featured":true}'::jsonb),
    ('Shawarma de Carne', '{"featured":true}'::jsonb),
    ('Shawarma César', '{"featured":true}'::jsonb),
    ('Bandeja 3 carnes', '{"featured":true}'::jsonb),
    ('½ pollo asado', '{"featured":true,"days":[0]}'::jsonb),
    ('Pollo entero', '{"days":[0]}'::jsonb),
    ('Marquesa de chocolate', '{"featured":true}'::jsonb)
  ) as v(name, attrs)
 where p.tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5'
   and p.name = v.name
   and private.valid_catalog_attributes(coalesce(p.catalog_attributes, '{}'::jsonb) || v.attrs);
