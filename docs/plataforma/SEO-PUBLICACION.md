# Publicacion y descubrimiento de la landing

29/oct/2026. Ricky autorizo publicar la landing en divianco.app. La skill
marketing:seo-audit no esta instalada; autorizo usar las fuentes oficiales
listadas abajo sin instalar dependencias.

## Resultado comprobado

- PR52 y PR58 fusionados. Produccion3973675 READY, CI/E2E/smoke aprobados.
- Home200 con HTML completo para navegador, Googlebot y OAI-SearchBot;
  visible sin JavaScript. Escritorio1440 y movil390 sin desborde ni errores,
  diagnostico abre sin enviar datos durante la prueba.
- Robots, sitemap, llms, OG y clave IndexNow200; registro noindex. Catalogo
  crazy-miga200 sin canonical de plataforma. /landing308 hacia /.
- IndexNow respondio202 el29/oct: aviso recibido, no prueba indexacion.
- Redireccion exacta de la raiz www agregada tras detectar que el comodin
  redirigia subrutas pero no la raiz. Se mantiene tambien la regla general.
- No se agregaron dependencias ni cambios en base. Search Console no tiene
  propiedad verificada disponible en esta sesion; el titular puede solicitar
  rastreo y consultar informes con su acceso.

## Que se configura

- `scripts/seo-platform.mjs` genera `dist/plataforma.html` a partir de los
  componentes reales de la landing, con React al compilar. No hay un texto
  distinto para bots: humanos y robots reciben el mismo HTML e interacciones.
- El render de compilacion sustituye el cliente de datos por una barrera que
  rechaza consultas: no necesita credenciales ni lee datos de visitantes.
- Solo la raiz de `divianco.app` se reescribe a ese archivo. Los subdominios de
  negocios reciben `app.html` y conservan su resolucion de tenant en runtime.
  No se emite `dist/index.html`: Vercel le da prioridad sobre el rewrite de
  la raiz, lo que impedia entregar el prerender. El preview local conserva
  el fallback al shell y la auditoria de release verifica su identidad. El
  fixture QA no genera la landing prerenderizada.
- Titulo y descripcion descriptivos, canonical a la raiz, Open Graph y Twitter
  con imagen1200x630, idioma es-AR y JSON-LD de Organization/WebSite/
  SoftwareApplication. Sin resenas ni calificaciones inventadas.
- `www` redirige al dominio principal; `/landing` en el dominio principal
  redirige a `/`. Las previews mantienen su ruta de revision.
- Sitemap solo con la home indexable. Paneles/formularios usan X-Robots-Tag
  noindex; robots permite recursos publicos y buscadores. No se cambia la
  seguridad de las rutas privadas ni se pretende reemplazarla con robots.
- `llms.txt` actualizado con precios reales publicados y funciones en
  desarrollo; es ayuda complementaria, no un requisito ni garantia de SEO.
- `public/indexnow-key.txt`: clave publica de verificacion de IndexNow para
  notificar la home luego de comprobar el despliegue. No es una credencial de
  base ni permite administrar el sitio.

## Verificacion antes de publicar

- Build genera HTML con titular, rubros y planes, canonical y JSON-LD valido.
- El HTML generico de tenants no incluye canonical ni contenido de plataforma.
- Prueba con JavaScript deshabilitado y prueba interactiva en el host raiz;
  diagnostico y responsive conservados. No se guardan leads/pedidos durante QA.
- Tests de SEO validan aislamiento por host, datos estructurados, bootstrap,
  sitemap y fixture; suite completa y CI deben pasar antes del merge.
- Tras publicar: verificar `/`, `/robots.txt`, `/sitemap.xml`, imagen OG y
  `/version.json`, y leer el mismo HTML como Googlebot/OAI-SearchBot. Comprobar
  tambien un catalogo existente con GET, sin escribir datos.

## Despues de publicar

Enviar solo https://divianco.app/ a IndexNow usando keyLocation del archivo
publico. Una respuesta200/202 indica recepcion, no que ya este indexada.

Google puede descubrir la home por sitemap y enlaces. Para solicitar rastreo
manual y ver informes hace falta la propiedad verificada de Search Console;
no se fabrican codigos de verificacion ni se promete posicion o fecha de
aparicion. Revisar igualmente Bing Webmaster Tools si se dispone del acceso.

## Fuentes oficiales

- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed
- https://developers.openai.com/api/docs/bots
- https://www.indexnow.org/documentation
- https://vite.dev/guide/ssr
