# Plantillas del catalogo publico (14/nov/2026)

Un tenant puede elegir una plantilla de catalogo y cargar su marca por
configuracion. Hoy hay dos: `default` (la portada de siempre, `HomeScreen`) y
`pop` (editorial, con cintas, flyers y secciones que se prenden o apagan).
La plantilla `pop` nacio del catalogo de Cochi (con permiso de Cochi), pero no
lleva nada de Cochi adentro: nombre, textos, colores, fuentes, logos y fotos
salen de la configuracion del tenant.

## Como se elige

| Donde | Que |
|---|---|
| `settings.catalog_template` | `null` o `default` = portada de siempre; `pop` = la plantilla. Cualquier otro valor cae a `default`. |
| `settings.catalog_template_config` | jsonb con la marca y el contenido (abajo). Lo valida `private.valid_template_config` (SQL, migracion 0128) y `PlantillaConfigSchema` (`src/lib/plantillaConfig.js`); `src/test/plantillaConfigSync.test.js` compara las listas. |
| `get_catalog` | emite ambas claves, mas `currency` y `secondary_currency` del tenant. |
| `src/catalog-pro/plantillas/HomeConPlantilla.jsx` | unico switch. Reemplaza a `HomeScreen` en `Catalog.jsx`. |

`catalog_profile` (gastro, bebidas, comercio, barberia) es OTRA cosa: clasifica
el rubro (facetas y filtros). La plantilla es ortogonal al rubro.

**Si la config esta rota o la plantilla lanza al renderizar**, el catalogo cae a
`HomeScreen` y reporta a Sentry (`source: plantilla-catalogo`). Nunca queda en
blanco. La plantilla es un chunk aparte: los tenants en `default` no lo bajan.

## Contrato de marca (claves planas, listas cerradas)

Pensado para que un editor del panel cargue un manual de marca sin inventar
estructura. Todo es opcional; lo que falta lo hereda del tema del tenant
(`ambar`, `noche`, `carbon`).

| Clave | Valores |
|---|---|
| `marca.primario`, `marca.fondo`, `marca.texto`, `marca.acento2` | `#rrggbb` |
| `marca.fuente_titulo`, `marca.fuente_texto` | lista cerrada: Montserrat, Inter, DM Sans, Poppins, Playfair Display, Source Serif 4, Instrument Serif, DM Serif Display, Bebas Neue, Lora |
| `marca.radio` | `recto`, `suave`, `pildora` |
| `marca.logo_header`, `marca.logo_footer`, `marca.isotipo` | `https://...` o ruta que empieza con `/` (bucket `tenant-images`) |
| `secciones` | `[{id, on}]`; ids: `hero cinta favoritos flyers menu submarca banda testimonios historia`. El ORDEN de la lista es el de pantalla; `on:false` la saca. El menu no se puede apagar. Sin `secciones`, valen todas en ese orden. |
| `textos.*` | 25 claves fijas (`hero_titulo`, `menu_titulo`, `historia_texto`...), hasta 400 caracteres |
| `anuncios`, `cinta` | hasta 12 frases de hasta 80 caracteres |
| `intro` | `true`/`false` (intro de ~2 s, saltable, apagada con movimiento reducido) |
| `flyers` | hasta 8: `titulo texto imagen badge link desde hasta activo` (fechas `AAAA-MM-DD`, en la zona del negocio) |
| `testimonios` | hasta 8: `texto nombre` |
| `submarca` | `nombre categoria eyebrow titulo texto fondo color logo isotipo` (la categoria enlaza los productos) |

Una seccion sin datos se oculta sola (flyers vencidos, testimonios vacios...).

### Como se mapea a los tokens

`marcaATokens(marca, tema)` (`src/catalog-pro/plantillas/marcaATokens.js`)
devuelve variables CSS para el wrapper de la plantilla (no `:root`):

- `primario` -> `--ac` (y `--ac2`, `--al`); `fondo`/`texto` -> `--bg`, `--tx` y
  derivados `--b2 --b3 --line --t2 --t3`; `acento2` -> `--pop-acento`.
- `fuente_*` -> `--font-heading` / `--font-body`; `radio` -> `--rs --r --rl`.
- Siempre se calcula `--on-ac` (texto sobre el primario) y `--ac-text` (primario
  usable como texto) para cumplir 4.5:1; si el primario no llega sobre el fondo,
  cae al color de texto. Los temas base se copian de `tokens.css` y un test
  verifica que coincidan.

### Datos por producto (`products.catalog_attributes`)

Se suman a los de la 0114/0118: `tag` (etiqueta corta, 24), `featured` (bool),
`coming_soon` (bool), `days` (dias 0-6, 0 = domingo, en que se ofrece). La
fase 4 suma sus claves al lado.

### Doble moneda

Moneda y formato salen de `tenant.currency` / `secondary_currency` y de
`src/lib/moneda.js`; la tasa, de `get_exchange_rate` (`useTasaCatalogo`). Los
componentes no escriben simbolos. Tasa vencida (mas de 3 dias) = aviso visible.

## Ejemplo completo (Cochi)

El fixture `src/test/fixtures/cochi-plantilla.js` trae la config completa de
Cochi, los 30 productos y la tasa; `src/test/plantillaFixture.test.js` verifica
que cumpla el contrato. Resumen de la config:

```json
{
  "marca": { "primario": "#eb140c", "fondo": "#f5f0dc", "texto": "#211e1a", "acento2": "#e6e0bf",
             "fuente_titulo": "Montserrat", "fuente_texto": "Montserrat", "radio": "suave" },
  "intro": true,
  "anuncios": ["EL ANTOJO TIENE NOMBRE", "ARMA TU PEDIDO"],
  "cinta": ["GRANDE EL ANTOJO", "CON ACTITUD"],
  "textos": { "hero_titulo": "HOY SE COME BRUTAL.", "menu_titulo": "EL MENÚ.", "historia_titulo": "NO ES SOLO COMER. ES COCHI." },
  "flyers": [ { "titulo": "Agrégale papas a tu shawarma", "badge": "OFERTA", "link": "#menu", "activo": true } ],
  "submarca": { "nombre": "Cochi Dulce", "categoria": "Postres", "fondo": "#f1d6df", "color": "#4b2928" }
}
```

## Alta de un tenant con plantilla

1. Cargar productos y, por producto, `catalog_attributes` (`featured`, `tag`...).
2. Subir logos y fotos al bucket `tenant-images` y usar sus URLs en la config.
3. `update settings set catalog_template = 'pop', catalog_template_config = '<json>'`
   para el tenant (la base valida el contrato; si lo rechaza, el mensaje de
   `check` dice que clave sobra).
4. Mirar `https://<slug>.divianco.app` en 390 px y en escritorio. Sin editor en
   el panel todavia: el contrato esta pensado para sumarlo despues.

## Lo que NO es la plantilla

Carrito, checkout, ficha de producto y pedidos son los de siempre (fases
siguientes del trabajo de Cochi). No incluye mascota ni SVG a medida: la intro
usa el isotipo del tenant.
