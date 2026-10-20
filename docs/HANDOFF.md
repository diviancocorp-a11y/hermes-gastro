# HANDOFF — Dico, plataforma multi-rubro (para seguir en code)

> Punto de entrada para continuar. **Las secciones van de mas nueva a mas
> vieja: leer la primera.** Docs largos: `PLAN-ERP.md` (el plan vivo del ERP),
> `docs/plataforma/PLAN-MULTI-RUBRO.md`, `docs/plataforma/ARQUITECTURA-MODULAR.md`. SQL en `platform/`.
>
> Para retomar en un chat nuevo: **`/dico`**. Para cerrar: **`/cerrardico`**.
>
> Quedan las ultimas 5 secciones. Las anteriores estan en
> `historico/HANDOFF-anterior.md`; las mueve `npm run handoff:archivar`.

---

## 19/oct/2026 — La Nona Pato: manual de marca aplicado (Codex)

- Solo configuracion y assets del tenant `la-nona-pato`, sin cambios de
  JSX/CSS, schema, precios, stock u otros tenants. El manual v3 y sus archivos
  originales viven en Biblioteca de empresas/CLIENTES/LA NONA PATO.
- Subidos a `tenant-images/<tenant_id>/marca-20261019/` el retrato preparado
  para DICO, favicon 64 px e imagen social 1200x630. Eslogan:
  **Porque el amor tambien se come** (con tilde en el dato). Tema `carbon`,
  el existente mas cercano al fondo crema; terracota `#A83715` conservado.
- Imagen social guardada en `og_image_url` y `cover_url`: `api/og.js` consume
  este ultimo; la home actual no lo usa como portada visible. HTTP 200 como
  facebookexternalhit confirma titulo, eslogan e imagen nueva para compartir.
- Seis fotos propias asociadas a productos coincidentes: alfajores de maicena,
  picada, tortilla y las tres brusquetas. Las fotos de surtidos de canastitas
  y empanadas no identifican sabor; quedan fuera. Siguen 43 productos activos,
  ahora 6 con foto y 37 sin ella. Nueve originales publicos verificados por
  lectura HTTP y SHA256; fuentes y URLs en
  `docs/operacion/la-nona-pato-marca-20261019.json`.
- Horarios vigentes 09-21 todos los dias, WhatsApp provisional, direccion/pin
  y alias `pato.jhs` preservados por readback del catalogo. Se ignoro el horario
  7-18 anterior del manual en favor de la confirmacion reciente de Ricky.
- /diseno: constructor `disenador` reviso assets y asociaciones; auditor
  independiente `auditor-diseno` inspecciono catalogo y detalle en produccion
  1280x720: 0 regresiones P0-P3. Antes/despues: marca/fotos 0 -> 3/6;
  detector estatico 17 warnings y 6 advisory sin cambio, gate verde.
  Movil 390, contraste calculado y foco: no verificados, IAB no ofrece viewport.
- Instagram `lanonapato.ar` confirmado por Ricky y guardado en el tenant;
  readback del catalogo publico verificado. La ficha de marca de la biblioteca
  conserva la indicacion anterior de no confirmado; no se modifico ese archivo.
- Pendiente: el manifest de
  instalacion PWA sigue generando la inicial L: es una limitacion del sistema,
  mientras favicon, icono de Apple y marca del catalogo ya usan el retrato.
  Tarifas/condiciones de envio y fotos individuales restantes siguen pendientes.
- Temporales fuera de src/docs/platform/scripts: solo `.preview/nona-marca/`,
  ignorado, para subida e inspeccion; se elimina al terminar. Sin archivos en
  carpetas hermanas ni modificaciones a la biblioteca de origen.
- Pendientes heredados de k6 que siguen vigentes al archivar su seccion:
  Ricky debe hacer Run now de la tarea quincenal; `mp-status` diferido espera
  su ok; faltan escenario de panel y CI para ramas. No retirar la worktree
  cool-fermat sin revisar su .codex. Accesibilidad de SkipToContent, side-tabs,
  demora de crons y contenido/contacto de la landing siguen sin resolver aqui.
  Detalle: `docs/operacion/CARGA-K6.md` y la seccion archivada de 17-19/oct.

## 19/oct/2026 — Monare: imágenes, filtros y dirección de Boedo (Codex)

### Planilla para completar precios y revisar descripciones

- **20/oct, actualización:** Ricky pidió cargar las propuestas. Aplicadas las
  53 descripciones de la columna C de Descripciones a Monare, conservando las
  aclaraciones de imágenes/envases y los precios por bolsa y medios de pago
  del hielo. Readback: 53/53 textos coinciden; precios, imágenes y estados sin
  cambios (20 activos, 33 inactivos). `get_catalog('monare')` devuelve los 20
  activos con las descripciones nuevas. La planilla no se modificó.
- Google Sheets nativa: https://docs.google.com/spreadsheets/d/1fKf-okJoccHwbBhZopKl9OG6fQ_G9VObclGWq_0Z9uo/edit
- Pestaña Precios: 32 presentaciones sin precio y caja Ópalo Syrah x6 para
  confirmar/corregir los $48.600 informados. Los 33 precios confirmados están
  vacíos; celdas amarillas para completar, validación positiva en ARS y contador.
- Pestaña Descripciones: 53 propuestas con sabor y maridaje cuando hay ficha
  oficial; fuentes por fila y datos inciertos señalados. Son borradores en
  Drive: esta tarea no cambió descripciones ni precios de la base.
- Verificados los 33 registros de precios y las 53 descripciones contra lo
  redactado; contador probado al completar y luego vaciar una celda.
- `importacionmarcano@gmail.com` tiene permiso Editor, comprobado en Compartir;
  acceso general restringido. Se desactivó la notificación por correo al compartir.

### Aplicado y verificado en el edificio

- Solo datos de `monare` (`1367edee-7754-4169-a616-45310d98c045`): los 53
  productos tienen imagen asociada. Son 40 WebP públicos en `tenant-images`,
  prefijo `<tenant_id>/catalogo-20261019/`; 31 composiciones con fotos de
  bodega/PDF y 9 imágenes provisorias que cubren 14 productos. Registro técnico
  de fuentes, URLs y asociaciones: `docs/operacion/monare-imagenes-20261019.json`.
  El PNG del fondo maestro también está en Storage, URL en ese registro, para
  seguir incorporando productos con el mismo fondo.
- Fondo común basado en el manual de Monare de la Biblioteca de empresas:
  carbón, berenjena/bordó, luz cálida y logo original copa + MONARE dorado.
  Se descartó el logo M viejo. Generadas con ImageGen y convertidas a WebP
  sin recortar ni recomponer. Las referencias inciertas llevan texto
  `IMAGEN PROVISORIA` y aclaración en descripción; las cajas muestran la
  botella individual y los envases de 3 litros quedan por confirmar.
- Ricky autorizó usar referencias provisorias y reemplazarlas después.
  Pedir fotos de frente, etiqueta y capacidad de: Mumm; Freixenet Dulce;
  Cosecha Especial Rosé; Cosecha Tardía Rosé; Pulka Rosé (confirmar nombre);
  bolsas de hielo de 2 y 15 kg; Fantasía Criolla Tinta; Ancestral White Blend;
  Inspirado Chardonnay; Ópalo Semillón-Sauvignon Blanc; Skin Contact Viognier;
  Inspirado Cabernet Franc/Cabernet Cabernet/Blend de 3 litros.
- Se corrigió Louis -> **Lois Rosé** según la etiqueta oficial de Lorca, sin
  modificar precios. Siguen 20 activos, 32 inactivos sin precio actualizado
  y la caja de Ópalo Syrah pendiente. Stock sigue NULL en los 53.
- Nueva dirección indicada por Ricky: **Quintino Bocayuva 1130, Boedo, CABA**.
  Sucursal default `bb84f552-75e4-442e-a6e0-f3f8453e1498`, ahora Despacho Monare,
  coordenadas USIG CABA `-34.626682, -58.421350`. Reemplazada la dirección
  provisoria de Av. de los Incas en settings, sucursal, aviso de envío y
  `/info/compras-y-envios`. Sigue sin local de atención al público.
- Horario corregido por Ricky: **lunes a sábado 08:30–20:30**, domingo cerrado.
  WhatsApp e Instagram permanecen como confirmó antes.
- Readback SQL: 53/53 imágenes, 20 activos, stock NULL; `get_catalog('monare')`
  emite 20 imágenes, `catalogo_activo=true`, coordenadas nuevas y domingo cerrado.
  Los 40 objetos se comprobaron por HTTP HEAD al cargarlos.
  Playwright contra producción: 26 elementos de imagen del nuevo prefijo
  cargados, cero errores JS; la página pública de compras muestra Boedo,
  lunes a sábado y domingo cerrado (exit 0).

### Filtros publicados y verificados

- 15 grupos en `settings.cat_groups`: Cajas, Espumantes, Vinos tintos,
  Vinos blancos, Hielo, Mauricio Lorca, Chandon, Salentein, Mumm, Freixenet,
  Malbec, Cabernet Sauvignon, Chardonnay, Syrah, Rosé. Categorías hoja por
  producto/presentación permiten pertenecer a varios grupos sin duplicarlo.
- El catálogo ignoraba `settings.cat_groups`; corregido en PR #38, integrado
  en main `905be1370a92757c152f57707aff320e8dd35977` con OK explícito de Ricky.
  Solo UI/helpers/tests: Catalog.jsx, HomeScreen.jsx, catalogCategories.js y
  catalogCategories.test.js. El fallback del edificio no cambió en ese PR.
- Preview Vercel READY `dpl_4tYS8NJMF1M15oMWzL6AaJmxiLei`, rama temporal
  `codex/monare-catalogo-preview`, SHA `0349939225657a2dada04395eb85d46206244f75`:
  https://hermes-platform-rkb3vflej-diviancocorp-a11ys-projects.vercel.app/
  Misma UI revisada, más un cambio temporal de fallback Cochi -> Monare para
  ver ese tenant en `*.vercel.app`. **No mergear la rama de preview.**
  Usar MCP `get_access_to_vercel_url` para un enlace de revisión sin login;
  no guardar el secreto del enlace en este repo público.
- Verificación: 94 pruebas (categorías/utils/schemas), typecheck, build y
  `check:diseno` pasan. CI del PR sobre `7276762` pasó lint/typecheck/tests,
  build, audit y Playwright. Luego rebase a main `8073f2d` para preservar
  cambios paralelos (recetario/RLS y La Nona Pato); sin cambio en la UI.
- Auditoría independiente final en preview, móvil 390x844 y escritorio
  1280x800: cero hallazgos nuevos P0–P3, cero desborde, 16 chips de 48 px,
  aria-pressed y foco de teclado. Todos 20, Cajas 4, Hielo 4, Espumantes 9.
  Sin imágenes rotas en la vista de Hielo. Detector de archivos tocados [];
  global 17 -> 17 (deuda previa). Sin pedido ni pago de prueba.
- CI final del PR `0840512`: lint, typecheck,  unit tests, audit, build y
  Playwright aprobados. Vercel producción READY
  `dpl_FRtUES9XsmF99QTTGRh9YwAyznaH`, SHA `905be137`.
  Verificado ahora en `monare.divianco.app`: version.json buildId `905be137`,
  Cajas 4 / Hielo 4 / Espumantes 9 / Todos 20, chips 48 px y selección correcta;
  26 imágenes cargadas, cero desborde y cero errores JS. Dirección y horario
  correctos en la página pública de compras (Playwright exit 0).
- Eliminadas worktree y ramas propias de revisión/preview después del merge,
  sin tocar las de los demás chats. Temporales de imágenes limpios; los 40
  WebP finales y el fondo maestro permanecen en Storage. La URL de preview
  anterior queda solo como registro de la revisión; la tienda ya es pública.
- Falta de negocio: 32 precios, precio de caja Ópalo, fotos definitivas y
  datos bancarios reales. No se inventaron. Sin recetas.
- Archivos temporales en `.preview/monare-assets/` (ignorado) y temp del sistema
  durante el armado; los originales de ImageGen quedan en su caché por regla
  de la herramienta. Ninguna dependencia nueva ni schema ni migración.
- Pendientes heredados de GerenteDico que se archivan: cerrar issue #29 de
  prueba; próxima etapa issue `gerentedico` -> PR/preview. No tratados acá.

## 19/oct/2026 — La Nona Pato: acceso y ubicacion de despacho (Codex)

- El acceso fallaba por el enlace con doble n (`la-nonna-pato`). El tenant
  existente es `la-nona-pato`; catalogo y `/admin` muestran La Nona Pato.
  No se creo ni renombro ningun tenant. Estado `active`, 43 productos activos,
  sin imagenes y sin pedidos al consultar; Ricardo figura como owner.
- Solo datos de `c8e3de7e-2fc9-44ad-b7e4-03bb73a94cdb`: direccion de despacho
  confirmada por Ricky en `settings.store_address` y en la sucursal Principal
  (`10a833ea-0f8e-4b9f-9505-1259f30a15ba`). Coordenadas del pin que compartio
  Ricky: `-34.4097901, -58.857199`. La sucursal sigue activa y default.
- Verificado por readback SQL: direccion guardada, tenant activo y
  `get_catalog('la-nona-pato')` devuelve `catalogo_activo=true`, esas coordenadas
  y 43 productos. Browser de produccion muestra La Nona Pato y "Abierto".
  No se envio pedido de prueba ni se verifico una venta completa.
- Continuacion confirmada por Ricky: todos los dias (lunes a domingo),
  09:00-21:00, en los siete indices de `store_hours`. WhatsApp provisional
  `+5491172381841`, tambien guardado como telefono de la sucursal Principal.
  Efectivo disponible de forma implicita; cuenta de transferencia activa para
  checkout con alias `pato.jhs`. Sin titular ni CBU informados. El QR es fisico
  y Ricky pidio dejarlo fuera del catalogo. Readback del RPC publico confirma
  telefono, siete horarios, alias, catalogo activo y 43 productos.
- Pendiente: condiciones/tarifas de envio. No se cambiaron precios ni se
  enviaron pedidos de prueba. Reemplazar WhatsApp provisional cuando Ricky
  confirme el definitivo; completar titular de transferencia cuando lo informe.
- Sin cambios de codigo ni schema ni otros tenants. Solo documentacion en
  `docs/`; no se crearon archivos fuera de `src/`, `docs/`, `platform/` o
  `scripts/`. Preservados los archivos sin seguimiento y el trabajo paralelo.
- Pendientes que siguen vigentes de las secciones a archivar: primer error
  real desminificado de Sentry y existencia/alta de MiaEstudio no verificados
  en esta tarea. GerenteDico etapas 2/3 se describen en las secciones siguientes.

## 19/oct/2026 — Carga inicial de Monare (Codex)

### Hecho y verificado en el edificio

- Solo datos del tenant `monare` (`1367edee-7754-4169-a616-45310d98c045`),
  sin cambios de codigo, schema, otros tenants ni condiciones comerciales.
- 53 productos simples: 20 activos con precio, 32 del PDF inactivos por
  falta de precio actualizado y una caja de Opalo Syrah inactiva por confirmar.
  Incluyen 36 presentaciones de Mauricio Lorca, 8 espumantes, 5 cajas x6
  y 4 lotes de hielo. Louis Rose se tomo como el "Lois rose" del mensaje.
- Precios de los mensajes del 15/oct tienen prioridad sobre PDF e imagen:
  Louis Rose $17.390 / caja x6 $102.000; Lorca Joven Malbec $8.190 / $49.200;
  Opalo Syrah $13.290 / $48.600 (caja pendiente); Fantasia Chardonnay y
  Cabernet Sauvignon $9.490 / $54.590 cada caja x6. No se importaron
  los precios, costos ni promociones del PDF. Sin stock inventado.
- Hielo: lotes de 15/30 bolsas de 2 kg a $27.000/$51.000 y de 15 kg a
  $94.500/$180.000. Los importes publicados son por lote completo.
- Medios internos: transferencia, efectivo y credito segun acuerdo;
  MercadoPago desactivado. Cuenta de transferencia en checkout con datos
  a coordinar (sin alias, CBU ni titular inventados). La tarjeta solo queda
  como medio interno, no como pasarela online.
- Pagina `/info/compras-y-envios`: horario informado 8:30-20:30, pagos,
  CABA y Provincia, entrega gratis en CABA para pedidos mayores a $95.000
  en 24 horas; express cotizado por zona (Flex/Uber). No se activo el umbral
  global de envio gratis porque tambien aplicaria a Provincia.
- `settings.has_physical_store=false` ya existia, pero el espejo del tenant
  no tenia esa clave: `get_catalog` devolvia true. Se alineo la clave del JSON
  a false sin cambiar el trigger compartido. Pendiente del sistema: el
  trigger `espejar_settings_a_tenant` no copia esa columna.
- La cuenta existente de `importacionmarcano@gmail.com` ya era owner.
  Se configuro por Supabase Auth Admin la clave pedida y se verifico login;
  no se guarda la clave en archivos ni en este documento.
- Readback SQL: 53 filas, 20 activas, 33 inactivas, 0 diferencias contra los
  datos preparados, 0 activas a $0 y todo el stock NULL. RPC como anon:
  20 productos y `has_physical_store=false`. Browser de produccion muestra
  los 20 productos con precios; sigue "Cerrado: todavia no toma pedidos".
- Continuacion confirmada por Ricky: todos los dias (lunes a domingo),
  08:30-20:30, guardados en `store_hours` (indices 0-6). WhatsApp
  `+5491123901855`. `store_address` = CABA, explicitamente provisorio;
  actualizado tambien el texto de `/info/compras-y-envios` y el aviso de
  entrega en CABA y Provincia. Readback de tabla y RPC publico coinciden.
- Ricky eligio dejar pendiente la caja x6 de Opalo Syrah; sigue inactiva.
- Actualizacion posterior: Instagram `monare.boutique`; despacho provisorio
  autorizado en Av. de los Incas 4000, CABA. USIG normalizo esa direccion y
  devolvio lat/lng `-34.577830, -58.467925` (OSM coincide). Creada sucursal
  default activa "Despacho provisorio", con telefono y direccion marcados
  como provisorios. `get_catalog` como anon devuelve `catalogo_activo=true`;
  siguen 20 productos activos y no hay local de atencion al publico. Browser
  de produccion muestra "Abierto: 08:30 a 20:30" y los links correctos de
  Instagram y WhatsApp. No se envio ningun pedido de prueba.
- Envio sin tarifa automatica: con `delivery_pricing=NULL` el checkout usa
  tarifas genericas de $500 a $5.000 que Monare nunca informo. Se guardo un
  escalon con costo 0 y aviso explicito: el total online incluye productos;
  el envio se cotiza/cobra aparte segun zona y cantidad, coordinar antes de
  pagar. La pagina de condiciones lo explica; CABA > $95.000 conserva envio
  sin costo en 24 horas. Esto no implementa una cotizacion automatica por zona.

### Pendiente de datos de Ricky / Monare

- Reemplazar el despacho provisorio de Av. de los Incas 4000 por el real
  cuando Monare lo confirme (direccion y coordenadas de la sucursal default).
- Alias/CBU para transferencias.
- Caja x6 de Opalo Syrah a $48.600 frente a $13.290 por unidad: Ricky
  pidio dejarla pendiente, sin corregir ni publicar su precio.
- Precios actualizados de las otras 32 presentaciones del PDF. Los ejemplos
  de la planilla vacia de Drive NO son datos reales ni se importaron.
- Pendientes heredados sin verificar en esta sesion: primer error Sentry
  desminificado; diferencia de productos de Crazy Miga y existencia de
  MiaEstudio en el edificio. Las etapas 2/3 de GerenteDico y el barrido de
  policies tienen secciones posteriores a la de Sentry, consultar esas.

### Archivos y evidencia

- Solo documentacion en `docs/`. PDF e imagen del usuario se leyeron en sus
  ubicaciones originales. Imagenes temporales de inspeccion en el temp del
  sistema y `.preview/monare-import/` (ignorado), eliminadas al terminar.
- Codigo desplegado al iniciar: `5076010`, produccion READY en Vercel.
  La carga es de datos y no requiere deploy ni migracion.

## 17-19/oct/2026 — Orquestador de skills: ruteo por prompt y candado de /diseno (Claude)

**En main y con CI verde.** PR #31 (`7c8bd44`, `d0e6e01`, `8bf93cc`), merge
`2374959`; CI verde en `8bf93cc` y en `2374959`. La regla de `/carga` entró
aparte (`386e826`, PR #32). No toca el front ni la base.

### Hecho

- **`scripts/hooks/orquestador.mjs`**, un solo script con dos modos,
  registrado en `.claude/settings.json`. Reemplaza a `linea-diseno.mjs`
  (borrado), que inyectaba el mismo texto en cada turno sin leer el prompt.
  - `ruteo` (UserPromptSubmit): las reglas de
    `scripts/hooks/orquestador-reglas.json` (regex sobre el prompt en
    minúsculas y sin tildes, sin LLM) inyectan **solo** la indicación que
    aplica: UI → `/diseno` con `design-taste-frontend` (pantalla nueva o
    rediseño) o `impeccable` (pulir); base → `npm run mapa`; cierre →
    `/cerrardico`; arranque → `/dico`; competencia → `analisis-competencia`;
    carga → `/carga`. Si no aplica ninguna, no dice nada. Una skill que ya se
    cargó en la sesión no se vuelve a pedir.
  - `candado` (PreToolUse `Edit|Write|MultiEdit`): editar `src/**/*.jsx`,
    `src/**/*.css` o `index.html` sin `/diseno` cargado le agrega al modelo
    el aviso de cargarla. Los subagentes `disenador` y `auditor-diseno`
    están exentos, y los tests quedan afuera.
- **Por qué se lee el transcript como JSON por línea y no con grep:** el texto
  `Launching skill: diseno` aparece en la salida de cualquier comando que lo
  busque, y pasó en la misma sesión que lo construyó. Cuentan tres señales:
  el tool_use `Skill`, `toolUseResult.commandName` y `<command-name>/x</command-name>`
  en un mensaje de Ricky.
- **Por qué avisa y no bloquea:** un subagente que no es de la línea de
  diseño no ve las skills del padre, y hay ediciones chicas de UI que Ricky
  pide sin la línea completa. Con `"modo": "bloqueo"` en el JSON pasa a
  rechazar la edición.
- Documentado en `CLAUDE.md` y `AGENTS.md` (la tabla de qué skill va con cada
  pedido; Codex no tiene hooks y sigue esas reglas leyendo el texto).

### Verificado

- `src/test/orquestadorSkills.test.js`: 30 tests, con 12 prompts de ejemplo,
  falsos positivos del transcript, el candado en aviso y en bloqueo, y el
  script corrido con stdin (entrada rota o modo desconocido → exit 0 y sin
  salida).
- Detección contra transcripts reales: la sesión `bca8550a` da `diseno`
  cargada y el candado calla. La sesión que lo construyó da solo
  `plugin-authoring`, aunque tenía greps con el texto.
- **En vivo, según la sesión de k6** (sección de abajo): el ruteo inyectó su
  aviso en cada prompt en la máquina de Ricky. En esta sesión no se vio: el
  harness siguió corriendo el hook viejo desde el checkout principal, que
  estaba en `prueba/k6`, incluso cuando `linea-diseno.mjs` ya no existía en
  la worktree. **El candado no se vio disparar en ninguna sesión.**

### Pendiente inmediato

1. **Ver el candado andando en una sesión sobre `main`**: editar un `.jsx`
   sin `/diseno` cargado tiene que traer el aviso. Si no llega nada, puede
   ser que esta versión de Claude Code no lea `additionalContext` en
   PreToolUse; en ese caso, pasar a `"modo": "bloqueo"`.
2. **Un gate para hooks rotos**: que morning-health o un `check:*` falle si
   `.claude/settings.json` apunta a un script de `scripts/hooks/` que no
   existe. Hoy un hook que apunta a un archivo borrado falla en silencio en
   cada turno.

### Bloqueado por Ricky

- Nada propio. Lo heredado de la landing está en la sección de k6.

### Archivos fuera de src/, docs/, platform/ o scripts/

- `.claude/settings.json`: registra los dos hooks, con ok de Ricky.
- `.agents/skills/` y `.codex/` aparecieron sin seguimiento en la worktree y
  en el checkout principal. No son de esta sesión y no se tocaron.

---
