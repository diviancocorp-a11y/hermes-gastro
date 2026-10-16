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

## 16/oct/2026 — La base y el repo vuelven a decir lo mismo; morning-health vigila lo que no veía (Claude)

**Publicado.** Todo en `main`, de `b0c3416` a `cd82ca5`, en commits de un
solo tema. Producción de `hermes-platform` `READY` en `cd82ca5` (verificado
por MCP de Vercel).

### Hecho

- **Reglas nuevas en `CLAUDE.md`/`AGENTS.md`**:
  - "la escalera" antes de escribir código (adaptada de Ponytail);
  - criterio de entrada para skills/plugins/MCPs de terceros, con tabla de
    las 12 ya evaluadas (no reabrir sin motivo nuevo);
  - migraciones "expandir y después contraer" (Vercel ya es blue-green, la
    base no vuelve con el rollback) y patrón para sumar un argumento a una RPC
    (`drop` + `create` con `default`, como la 0068; **no** `create or replace`
    con otra firma: deja dos vivas);
  - "cómo se aplica una migración": archivo en el mismo commit; lo
    destructivo lo aplica Ricky desde el panel (por MCP el `drop` se cuelga a
    los 60s, pasó 3 veces);
  - "qué se hace sin preguntar" y qué pide el ok de Ricky.
- `/cerrardico` suma un paso: proponer reglas a partir de correcciones
  repetidas (adaptado de Task Observer).
- **`check:expandir`** (`scripts/check-migraciones-compatibles.mjs`,
  pre-commit + CI): frena drop/rename/`set not null`/cambio de tipo desde la
  0096 salvo `-- contraer: <motivo>`; reconoce solo el cambio de firma
  compatible buscando la firma vieja en las migraciones anteriores.
- **`check-functions-drift.mjs`** ahora compara cuerpo **y** firma de las 83
  funciones de `public`, no solo las críticas. `CRITICAS` (9) quedan como las
  que no pueden faltar. Encuentra también `create function` sin `or replace`.
- **`check-migraciones-sin-archivo.mjs`** (nuevo, en morning-health): toda
  fila de `supabase_migrations.schema_migrations` tiene que tener archivo.
  Lee vía el RPC `migrations_snapshot` (**0097**, definer, solo
  `service_role`). Lo histórico que no coincide por nombre (24) está en
  `scripts/migraciones-sin-archivo.json` con el veredicto de cada una.
- **Base**:
  - **0062** aplicada por Ricky desde el panel: queda una sola
    `sumar_staff(text,text)`.
  - **0097** aplicada por MCP.
- **Rescatadas al repo** (lo que corría en la base sin archivo, copiado de
  `schema_migrations`):
  - **0096**: `provision_owner`/`attach_owner` escriben `roles`. La versión
    del repo fallaba por `roles` NOT NULL desde la 0050.
  - **0018**: el cron `release-dormant-tenants`.
  - **0079**: `schema_snapshot` con vistas. El original vive en la worktree
    `claude/recursing-gauss-acdbb9` (`08f82ba`): si se mergea, tiene que ser
    igual; si difiere, vale el del repo.
  - **0098**: `register_waste`/`register_purchase` que asientan en el libro.
    El repo decía que corría la de la 0040.
- `_migrations_through` en `0098`.

### Verificado

- Contra producción (MCP, solo lectura): las 83 firmas de `public` coinciden
  con el repo. Los 83 cuerpos también: el único que daba distinto
  (`crear_sectores_tipicos`) es idéntico con el normalizador real. Era un
  artefacto de normalizar en Postgres, donde `[a-z]` incluye letras con tilde.
- Coinciden con el repo: constraint `entry_time_valid`, índices
  `inv_mov_client_request_uniq` y `suppliers_tenant_name_uniq`, policies de
  `sales`/`expenses`/`suppliers`.
- **No** se compararon una por una las policies del resto de las tablas que
  tocan las `roles_*`: solo se sabe que `check:rls` las da cerradas.
- Tests de los checks (103) y pre-commit completo con build en cada commit.
- **CI**: lint, tests, typecheck, build y los checks nuevos en verde. El job
  **Security Audit da rojo y ya daba rojo antes** de esta sesión: `npm audit`
  marca 4 high, `braces` (via `lint-staged`, el fix es lint-staged 16.4.0,
  major) y `source-map-js` (`npm audit fix` sin breaking). No se tocó:
  cambiar dependencias pide ok.
- Los checks nuevos de morning-health **no corrieron todavía contra la base**
  desde CI: ver bloqueado.

### Bloqueado por Ricky

1. **Morning-health falla desde el 14/oct y no manda nada a Telegram**:
   `Telegram API error: 401 Unauthorized`. El `TELEGRAM_BOT_TOKEN` de los
   secrets de GitHub ya no es válido. Cargar el token del bot nuevo
   (GerenteDico) y su `TELEGRAM_CHAT_ID` en Settings → Secrets → Actions.
2. **`SMOKE_TENANTS`** (variable de Actions) dice
   `la-nona-pato,cochi,mala-miga`: `mala-miga` ya no existe (da "catálogo
   VACÍO" todos los días). Cambiar por los tenants vivos (al menos
   `crazy-miga`).
3. Ok para `npm audit fix` (sin breaking) y para subir `lint-staged` a 16.
4. Ok y `ANTHROPIC_API_KEY` (la carga él) para el bot GerenteDico.

### Pendiente inmediato

1. Después de 1 y 2: correr morning-health a mano (`workflow_dispatch`) y
   confirmar que llega y que los 3 checks nuevos dan verde.
2. GerenteDico (propuesta en el chat del 16/oct, no hay código):
   - etapa 1, el resumen de la mañana con los errores de Sentry explicados en
     castellano;
   - etapa 2, edge function `gerente-webhook` (solo el chat de Ricky,
     herramientas de solo lectura, Claude API);
   - etapa 3, "anotá que hay que arreglar X" → issue de GitHub → Claude Code
     abre el PR → link del preview para aprobar desde el teléfono.
3. Comparar una por una las policies de las tablas que tocan
   `roles_y_alcance_policies` / `roles_barrido_de_policies_viejas`.

## 15/oct/2026 — Gate de diseño, /diseno siempre activo y pulido de la landing de divianco.app (Claude)

**Publicado.** Ricky dio el OK y el PR #26 se mergeó a `main` como merge
commit `441c799`. El deploy de producción de `hermes-platform` quedó `READY`
en ese SHA. Son commits de un solo tema cada uno, revertibles por separado:

- `a29ba2a`: el gate.
- `d3e86fc`: la skill.
- `0d9a277`: la landing.
- `1081171`: `/diseno` siempre activo.

**`/diseno` siempre activo** (pedido de Ricky): toda mejora que toque UI pasa
por la skill, que maneja la línea de skills. Está en tres lugares, porque uno
solo se pierde:

- la regla en `CLAUDE.md`/`AGENTS.md`;
- un hook `UserPromptSubmit` en `.claude/settings.json`
  (`scripts/hooks/linea-diseno.mjs`) que la recuerda en cada turno;
- la skill, que se declara obligatoria aunque nadie la nombre y cierra pasando
  el link del preview de Vercel de la rama.

### Hecho

**Gate de diseño.**
- `scripts/check-diseno.mjs` (`npm run check:diseno`) corre `impeccable detect`
  sobre `src/` e `index.html` y lo compara contra `scripts/diseno-deuda.json`.
- Va en el pre-commit y en el CI.
- Tiene el mismo contrato que `llamadas-legacy-pendientes.json`: un hallazgo
  nuevo frena el commit y uno resuelto obliga a `-- --podar`.
- Cuenta por archivo y regla, no por línea, así editar arriba de un hallazgo
  viejo no lo vuelve nuevo.
- Nació con **17 hallazgos**: 12 bordes laterales de color, 4 bordes de acento
  sobre esquinas redondeadas e Inter cargada en `src/catalog-pro/tokens.css`,
  aunque el manual la excluye.
- `impeccable` entra como devDependency fija (4.5.2).

**Skill `/diseno` y subagentes.**
- Están en `.claude/skills/diseno/` y `.claude/agents/disenador.md` +
  `auditor-diseno.md`.
- Decisiones que no se deducen leyendo la skill:
  - **En este repo no se usa ui-ux-pro-max.** Su trabajo es inventar un sistema
    de diseño y DICO ya tiene uno en `docs/marca/`.
  - **Una sola skill estética por tarea**: taste-skill para pantallas nuevas,
    impeccable para pulir las existentes.
  - **El auditor es de solo lectura** y no ve el razonamiento del constructor.
- Las skills de terceros (`impeccable`, `design-taste-frontend`) **no se
  commitean**: están en `.gitignore` y las baja `npm run skills:diseno`
  fijadas a un commit.

**Landing (`src/pages/PlatformLanding.jsx` + `src/styles/platform-landing.css`).**
- **El monto de los planes salía a 14px en vez de 32px.** `.pl-card p` le
  ganaba en especificidad a `.pl-precio-monto`, y también a `.pl-pilar-sub`.
- **`.pl-mono` pedía JetBrains Mono, que no está autoalojada** (en
  `public/fonts/dico` solo hay Overused y Butler). Unas 40 etiquetas caían en
  la mono del sistema, que es el "fallback accidental" del manual 02.
  - Pasaron a `.pl-etiqueta`, en Overused a `--ds-type-xs`.
  - Los textos largos van en caja normal.
  - Los números van en Overused con `tabular-nums`, siguiendo la regla de
    métricas del DS v0.1.
- **`--pl-t3` subió de 0.42 a 0.56 de opacidad** (contraste de 3.8:1 a ~6:1).
- **Sin eyebrows ni índices 01/02/03.** El craft floor de impeccable los
  prohíbe y la nav ya nombra las secciones.
- **Táctil, foco y superficies del navegador.**
  - Targets de 44px bajo `@media (pointer: coarse)` y no por ancho, así cubre
    también las tablets.
  - Foco en oro, `::selection` y `color-scheme: dark` mientras se ve la
    landing. Se restaura al salir.
- **El `<main>` de la landing pasó a `<div>`**, porque `App.jsx` ya envuelve
  todo en `<main id="main-content">`.
- **Único cambio de texto**: la etiqueta del plan Digital pasó de "Gratis" a
  "Para empezar", porque repetía el monto "Gratis".

### Verificado

- Pre-commit completo en verde al commitear la landing, **incluido el gate
  nuevo**.
- `check:diseno`: 17 → 17, ninguno nuevo. La landing tenía 0 hallazgos del
  detector antes y después: sus defectos salieron de mirarla renderizada, no
  del detector.
- Build en verde, y **1560/1560 tests** con `--pool=threads`. Los 7 rojos
  preexistentes de la sección del 7-9/oct ya no fallan sobre esta rama.
- Renderizada en Chromium headless a 320, 390, 768, 1024 y 1280:
  - sin scroll horizontal;
  - sin monospace dentro de `.pl-root`;
  - montos a 32px;
  - con puntero táctil emulado a 390 y 820, ningún target por debajo de 44px;
  - el móvil quedó 532px más corto.
- **Auditoría independiente**: 0 P0, 1 P1 (tamaños y espacios a mano fuera de
  la escala `--ds-*`) y 3 P2. Todo se corrigió en la segunda ronda del
  constructor. Esa segunda ronda la verificaron los gates y las capturas, **no
  una segunda auditoría**.
- **NO verificado**:
  - la página en producción, porque no está publicada;
  - un dispositivo táctil real;
  - `npx impeccable detect <url>`, porque su Chromium no corre como root en el
    sandbox.

### Pendiente inmediato

1. **Verificar que el hook corre en la máquina de Ricky** (Windows, Claude Code):
   la primera sesión en el repo tiene que mostrar el aviso de `/diseno`. Acá
   solo se probó el script a mano. Si Claude Code pide aprobar el hook del
   proyecto, aprobarlo.
2. **Números de ejemplo de la landing**: no se tocaron porque son contenido.
   - **Son inconsistentes entre sí.** El pilar dice bife a $1.200 con $340 de
     insumos. El aviso de Dico dice que el costo pasó a $520 y que el margen es
     14%; con esos números da ~41%.
   - **Están en una escala que no cierra con los precios del plan.** Una noche
     de $4.200 de venta contra un plan de $59.000 por mes.
   - Un gastronómico lo nota, y es justo la promesa de la página
     ("Sin suposiciones. Números"). Hay que alinearlos a precios de 2026.
3. **WhatsApp del CTA con número de EE. UU. (+1 786)** para un público
   argentino. Es decisión de Ricky.
4. **Fuera de alcance, preexistentes**:
   - `SkipToContent.jsx` usa blanco sobre `#C45D3E`, que da 4.21:1, y está en
     DM Sans.
   - El `<main>` de `App.jsx` debería salir por ruta.
5. **Deuda del gate**: los 12 `side-tab` del panel son el siguiente bloque
   natural para `/diseno`, y cada uno que se resuelve se poda.
6. **Heredado del 28/sep, no verificado en esta sesión**: los cron de GitHub
   (`morning-health` y el smoke) corrían unas 8 h tarde. Mirar las últimas
   corridas antes de tocar nada.

### Bloqueado por Ricky

- Los números de ejemplo y el WhatsApp de la landing (puntos 2 y 3).

---

## 7-9/oct/2026 — Crazy Miga: del alta a vender por Telegram (Claude)

Crazy Miga es una dark kitchen (cookies) que cobra por alias o efectivo, sin la
API de MercadoPago. Su dueno es `@Crazymiga` en Telegram; el bot es
`@Crazymigabot`. Plan gratis. Detalle tecnico de Telegram en
`docs/plataforma/TELEGRAM.md`.

### Hecho

**El negocio.** No se creo un tenant: se **reutilizo el de `mala-miga`**
(`eb7a0184-bb22-4f70-a87f-abd7fa81f08d`) y se renombro. El nombre vive en TRES
lugares (`tenants.name`, `tenants.settings.biz_name`, `settings.biz_name`);
`get_tenant_brand` lee la tercera, y por eso la pestana del panel siguio
diciendo "Mala Miga" despues del primer renombre. Ahora lo hace
`rename_tenant(slug, nombre, slug_nuevo)` (0084, solo service role). Quedo en
modo `virtual`, canales `delivery/pickup/whatsapp`, slug `crazy-miga`. La URL
vieja `mala-miga.divianco.app` ya no resuelve (sin redireccion).

**El catalogo** (cargado por SQL, no por la UI): 7 productos activos (3 sabores
x grande y pack x4 de minis, mas **La Nave Crazy**, 16 minis: 5 choco, 5 blanco,
6 dulce de leche, $59.000), 19 insumos, recetas y costos tomados de la planilla
de costeo de Ricky (Drive, 8/oct). Los 11 productos viejos de Mala Miga quedaron
**archivados, no borrados**. Decisiones que no se deducen del codigo:
- La receta manda la **planilla**, no el JSON de recetas que paso primero
  (manteca 120 g por tanda, **sin melaza**, y las flores).
- **Flores a $10.000 por gramo**: Ricky confirmo que son caras. Bajaron de 2 g a
  **1,5 g cada 50 g de manteca** (3,6 g por tanda) para aliviar el costo.
- **Cookie grande de 35 g** (antes 45): una tanda rinde 19 grandes, no 15. El
  precio ($9.000) no se toco; deja ~$3.700 de margen vs ~$2.050 de la planilla.
- **Packaging como insumos** (categoria Packaging) dentro de cada receta, con
  la **merma del 10% aplicada a las cantidades** (una grande descuenta 1,1
  cajas), asi el costo coincide con la planilla y el stock cuenta las roturas.
- Papel parafinado 25x40 ($66,53) unifico el de las grandes y el del combo; la
  faja es $299,68 (papel kraft $49,68 + impresion $250 de Diseniobar, del
  propio relevamiento); caja del combo microcorrugada 20x17x5 ($266,99).
- La planilla da la cookie grande al 77% de costo con 45 g y flores a 2 g; hoy
  da ~58%. Los packs de minis estan en ~28%; **empujar packs y combo**.

**Telegram, tres etapas** (ver TELEGRAM.md):
1. Boton de menu del bot -> `https://crazy-miga.divianco.app` (sin codigo).
2. `src/lib/telegram.js` + `useTelegramMiniApp`: expandida, colores del negocio,
   Atras nativo (apoyado en `history.back()` y el evento `hg-layers` que emite
   `useAndroidBack`). El SDK se carga solo si se abrio desde Telegram.
3. Avisos: trigger `tg_avisar_pedido` en `orders` (0085) -> pg_net ->
   `tg-notificar`. **Se eligio el trigger y no tocar `submit-order`/`mp-webhook`**
   porque cubre cualquier origen del cambio de estado (checkout, panel, bot) y
   no exige redeployar la function critica. Nunca bloquea un pedido (todo en
   EXCEPTION) y no llama a nadie si el negocio no tiene chats activos.
   `tg-webhook` recibe `/start` y los botones Aceptar/Rechazar; `tg-vincular`
   valida el HMAC del `initData` y ata el chat al **telefono** (ultimos 10
   digitos). **El dueno nunca se auto-asigna**: `kind='owner'` se marca a mano.
   Rechazar un pedido pagado por MP desde el bot esta bloqueado; por
   transferencia se deja y se recuerda devolver a mano.
   Cada function lleva **su copia de `validar.ts`** (se despliegan solas y no ven
   la carpeta de otra); hay un test que falla si las copias difieren.

**Catalogo y envio** (migraciones 0083 a 0088; todas reescriben `get_catalog` y
cada una es identica a la anterior mas una linea):
- **0083 aplicada hoy** (ver "Correccion" abajo).
- **0086** emite `has_physical_store` (el checkout solo oculta el retiro con
  `=== false` y la funcion nunca lo mandaba: `undefined` contaba como "tiene
  local"). Default `true`: nadie mas cambia. Crazy Miga solo entrega.
- **0087** emite `free_delivery_over`; envio gratis si el subtotal **supera**
  $60.000 (los $60.000 justos no). `esEnvioGratis` en `origenDelEnvio.js`.
- **0088** emite `delivery_zone = {partidos, notice}`. `evaluarZona` mira
  `county`, `state_district` y `municipality` (Nominatim no es consistente: San
  Isidro lo trae en county, Pilar en state_district) y la Capital por
  `state`/`ISO3166-2-lvl4 = AR-C`. **Solo 'fuera' bloquea**; si Nominatim no da
  un partido reconocible se deja pasar (fail-open), porque un geocodificador
  incompleto no puede dejar sin venta a quien si esta en zona. Cubre texto, GPS
  y direcciones guardadas (antes dos de los tres caminos se saltaban la regla).
- Datos de Crazy Miga: punto base **San Fernando** (-34.4420, -58.5590, centro
  aproximado), **$3.700 cada 10 km** en bloques (10/20/30/40 km y "el resto"
  $18.500), partidos Vicente Lopez, San Isidro, San Fernando, Tigre y Pilar, y
  un aviso visible ("de General Paz a Pilar, no dentro de villas").

### Correccion: la 0083 nunca se habia aplicado

Afirme que "la base rechaza los pedidos sin ubicacion" leyendo el comentario de
la 0083. **No estaba aplicada** (no existia `private.tiene_ubicacion` ni el
trigger) y, peor, el front publicado exige `catalogo_activo === true` y
`get_catalog` no lo devolvia: **ningun negocio podia tomar pedidos en
produccion**, no solo Crazy Miga. La aplique tal cual estaba en el repo. Efecto:
**cochi y la-nona-pato siguen sin poder pedir hasta cargar su ubicacion**, y
ahora tambien lo impide la base. Dos rarezas del registro de migraciones: la
0083 figura con version posterior a la 0085 (se aplico despues), y la base
tiene aplicada la **0079** cuyo archivo **no esta en `main`**: vive en la
worktree paralela `claude/recursing-gauss-acdbb9` (commit `08f82ba`, sin
mergear). No se toco.

### Verificado

- **En produccion, con un pedido real** (envio, efectivo, $12.700 con $3.700 de
  envio): el trigger llamo a `tg-notificar` tres veces, las tres **HTTP 200 con
  `enviados: 1`** (nuevo -> dueno; preparando y listo -> cliente). Ricky reporto
  que pasaron las tres pruebas de checkout: direccion de Pilar (pasa), de
  Palermo (frena) y pedido de mas de $60.000 (envio gratis).
- Tests: 26 de Telegram, 6 de envio gratis/tramos, 10 de zona; typecheck, build
  y los 87 de humo del pre-commit en verde en cada commit.
- **NO verificado**: que Ricky haya visto llegar los mensajes en el celular
  (Telegram los acepto, nada mas); una transferencia por alias; el boton
  **Rechazar**; el Atras nativo y el color de la barra dentro de Telegram; nada
  se vio en el navegador (no hay tests que rendericen el checkout).
- **Rojos que ya estaban**: 7 tests fallan igual sobre `HEAD` limpio (se
  comprobo con un stash): `origenDelEnvio` (5, esperan un campo `propio` que el
  codigo no devuelve), `dicoPanel` (1) y `dicoIdentidad` (1). No se tocaron.

### Pendiente inmediato

1. **`SMOKE_TENANTS` (variable de GitHub) todavia dice `mala-miga`**: el smoke y
   el reporte de la manana dan 404 en ese negocio. Hay que cambiarla a
   `crazy-miga` (esta en `TAREAS-MANUALES.md`). `smoke-pedido.yml` ya se
   corrigio. Ojo: el `slug` por defecto de ese workflow es `cochi`, que **hoy no
   puede pedir** (sin ubicacion); y si se corre contra `crazy-miga`, el pedido
   de prueba dispara los avisos de Telegram al dueno.
2. **`submit-order` no revalida zona, retiro ni envio gratis**: el costo y la
   zona se deciden en el cliente (el geocoding es client-side) y la function solo
   acota el costo al escalon mas caro. Alguien que la llame a mano se los
   saltea. Cerrarlo exige tocarla y redeployarla.
3. **El numero de ticket sale vacio en los mensajes** (`ticket_number` es null en
   pedidos del catalogo): dicen "Pedido nuevo " sin numero. Cosmetico; usar los
   ultimos caracteres del id como respaldo.
4. **Telegram Web no abre la mini app**: `vercel.json` manda
   `X-Frame-Options: SAMEORIGIN` y `frame-ancestors 'self'`. Celular y
   escritorio no se ven afectados. Relajarlo toca la seguridad de todos los
   negocios; no se decidio.
5. Las villas no se excluyen por geografia (no hay poligonos): solo el aviso y el
   criterio del dueno al aceptar. Si se quiere, una lista de barrios por nombre.
6. Los 7 tests rojos de arriba.
7. **Heredados de secciones archivadas que no se revisaron hoy**:
   `e2e/delivery-persistence.spec.ts` habla con el schema legacy y se saltea
   siempre; la `0075_la_comanda_sale_por_papel` no figura en las migraciones
   aplicadas pero sus funciones existen; el panel legacy es codigo muerto;
   Dependabot abrio PRs de versiones mayores (#3 a #11) y la idea era solo
   parches de seguridad; la propuesta (sin respuesta) de que un push de solo
   docs no publique (Ignored Build Step).

### Bloqueado por Ricky

- **Variable `SMOKE_TENANTS`** en GitHub: `la-nona-pato,cochi,crazy-miga`.
- **Confirmar que le llegaron los mensajes** del bot, con el texto y los botones
  bien, y probar **Rechazar** y una **transferencia por alias**.
- **Fotos de los 7 productos y stock inicial de los 19 insumos.**
- **Usuario `ricardoars13@gmail.com`** (Menu → Usuarios): crearlo requiere la
  service role o el panel; no se hizo.
- **Confirmar la lista de partidos** (hoy 5; quiza San Martin, Malvinas
  Argentinas, Escobar, Tres de Febrero) y el punto exacto de San Fernando.
- **Ubicacion de cochi y la-nona-pato**, o no pueden tomar pedidos.
- Las **credenciales** (token del bot, service role) las cargo siempre Ricky;
  el alias/CBU tambien: es un dato bancario y no se ingresa desde aca. El deploy
  de las edge functions (`node platform/scripts/deploy-functions.mjs --only ...`)
  y el registro del webhook (`platform/scripts/telegram-webhook.mjs`) los corre
  el, porque el clasificador bloquea el primero.

---

## 28/sep/2026 — Sala de control Dico y launcher silencioso (Codex)

### Lo que pidio Ricky

Que la pose `thinking` deje de sentirse como un GIF rapido y que el HTML
`Dico PANTALLA.html` pase a ser una pantalla final dentro de Dico: un lugar
persistente para avisos y acciones recomendadas que no se resolvieron al
instante.

### Hecho

- Se agrego `DicoPanel` a la navegacion de `PlatformAdmin` como pantalla Sala
  de control. El nombre aparece una sola vez dentro del card; el pequeno Dico
  acompana la bienvenida del chat.
  Toma los avisos 2D de `avisosDe`, las oportunidades y las intervenciones
  3D, con el lenguaje visual del boceto: presencia 3D, chat y grupos de
  pendientes. Se retiro el selector "Con avisos / Al dia": eran estados del
  ejemplo, no una funcion de la pantalla final.
- Las decisiones viven en `localStorage` con la clave
  `dico:centro-decisiones:v1`: una intervencion cerrada queda pendiente en la
  pantalla hasta que se resuelve, se pasa a tarea, se pospone o se descarta.
  El historial de intervenciones 3D se conserva en
  `dico:intervenciones:v1` desde `PlatformAdmin`.
- El resumen superior dejo de mostrar ventas, margen, promedio y pedidos. Los
  KPIs de prioridad tambien se retiraron para dejar una lista unica de tareas,
  ordenada de prioridad alta a baja.
- La fila `espera` del atlas bajo de 7 a 4 fps y cada cuadro reinicia el
  crossfade de `physical.css`. En el panel, Dico permanece en `idle` y hace
  una rutina corta `idle -> thinking -> idle` con pausas largas; no queda
  trabado en thinking ni se muestra como un loop continuo.
- Se corrigio el titileo: los cuadros ya no recrean el nodo ni reinician su
  opacidad; solo cambia el recorte del atlas. El pequeno cambio de pose sigue
  teniendo transicion, pero el idle queda presente.
- Se abrio la referencia compartida `chatgpt.com/s/sharepet_...`: la Sala
  ahora usa Dico pequeno junto a "¿En que te puedo ayudar?" y la conversacion
  como foco. El chat usa una
  capsula oscura larga, boton circular y foco con pulso dorado, adaptado al
  stack JS/CSS del repo sin copiar el componente TypeScript del adjunto. Se
  agregaron botones Volt para archivos e imagenes, con seleccion local y chips
  removibles.
- La burbuja Dico 2D externa abre directamente la Sala de control: no muestra
  tarjeta ni contador y mantiene la cara neutral. Los avisos basicos quedan
  en la Sala; el caso de catalogo vacio dejo de disparar Dico 3D flotante.
- La composicion paso a una sola columna: el chat ocupa todo el ancho y las
  tareas quedan debajo, con el mismo orden en mobile.
- La segunda pasada de la Sala saco la descripcion bajo el titulo, los
  contadores redundantes, los chips de sugerencias y la recomendacion urgente
  del chat. El card conserva solo la bienvenida y el composer.
- Dico ya no tiene fondo propio en la bienvenida: al pasar el mouse por encima
  entra en la pose `explain` para saludar y al salir vuelve a su rutina.
- Las respuestas del composer aparecen con escritura incremental. Se elimino el
  desplazamiento de caminata: Dico tiene una sola presencia persistente dentro
  del chat, piensa mientras responde y queda idle al terminar. Al crecer el
  historial, esa presencia baja con el flujo sin crear mini Dicos por mensaje.
- El texto escrito es blanco y el focus del composer deja solo un contorno
  dorado exterior, sin recuadro interno ni glow. El boton de enviar conserva
  su foco circular, pero no agrega un segundo rectangulo al input.
- La caminata de respuesta usa las filas certificadas `correIzquierda` del
  atlas (ocho cuadros) y desplaza el contenedor en 1800 ms; despues Dico queda
  en idle al borde izquierdo. Durante la escritura queda en `thinking`. El
  primitive acepta una fila de animacion sin contaminar el vocabulario de
  poses publicas.
- La bienvenida no desaparece durante la respuesta. Arriba a la izquierda
  aparece `Nueva accion`, que corta la respuesta, limpia el composer y devuelve
  a Dico al centro. Se retiro de las tarjetas la metadata `Dico 2D`/`nuevo` y
  las acciones quedaron como burbujas redondeadas con simbolos: asignar,
  posponer y descartar; la pantalla de destino queda en dorado a la derecha.
- El composer tiene un saludo local para `hola`, con escritura progresiva
  blanca y sin fondo ni borde azul. Queda listo para reemplazar esa funcion por
  la respuesta de IA.
- La Sala conserva ahora el historial de la conversacion en
  `dico:sala-control:chat:v1`: mensajes del usuario alineados a la derecha y
  respuestas de Dico alineadas a la izquierda. Despues del primer mensaje, la
  presencia unica de Dico vive sobre el boton de enviar: queda idle esperando y
  pasa a thinking con pulso azul mientras responde.
- El composer ahora tiene solo un boton `+` a la izquierda; clip, camara y
  `Nuevo chat` viven en su menu, con microfono a la derecha y hasta cinco conversaciones archivadas como
  maximo en `dico:sala-control:conversaciones:v1`. Al crear un chat nuevo se
  archiva el actual y se reinicia la conversacion; si ya hay cinco archivadas,
  se descarta automaticamente la mas antigua. La camara usa
  `capture=environment` y el microfono aprovecha SpeechRecognition cuando el
  navegador lo soporta.
- El historial de Sala de control ahora guarda hasta 5 conversaciones en
  `dico:sala-control:conversaciones:v1`. Las conversaciones permanecen ocultas
  hasta abrir el boton `Historial de chats` y usan como titulo el primer
  mensaje del usuario.
- Cada montaje de Sala de control empieza un chat nuevo. Al salir se archiva
  la conversacion activa y se limpia el chat corriente; una recarga completa
  tambien recupera el chat pendiente antes de abrir el nuevo. Si el historial
  ya tiene 5 entradas, se descarta automaticamente la mas antigua al archivar
  otra.
- El chat queda por encima de las tareas. Se retiraron los KPIs y la lista de
  tareas se ordena de prioridad alta a baja. Cada tarea muestra la zona arriba
  del titulo y la descripcion a la izquierda; a la derecha queda la prioridad,
  el CTA y un menu de tres puntos con asignar, descartar y posponer. La
  prioridad alta usa un pulso rojo.
- Sala de control se ubica al final del sidebar, despues de los modulos del
  negocio; el mismo orden se conserva en la fuente compartida de navegacion.
- Se bajo el peso visual de los controles: `+`, microfono, iconos del menu y
  menu de acciones usan blanco; los tres puntos son verticales y sin burbuja.
  El bloque paso a llamarse `Tareas asignadas`, y se retiro el boton de
  historial del pie.
- La pantalla de Sala de control ahora se llama `Habla con Dico` y deja solo
  el chat y el bloque `Analisis Dico`. Las tareas asignadas viven en `Equipo`,
  con las vistas `Me asignaron` y `Asignadas por mi`; el mismo registro local
  conserva la jerarquia, el responsable directo, el estado del trabajo y la
  evaluacion, asi una recomendacion pasa a los empleados sin duplicar el
  flujo.
- `admin-dico.css` ahora sigue el boceto: fondo #09090B, superficies #18181B,
  borde #27272A, prioridades antes de la grilla y chat a la izquierda;
  mobile conserva el orden chat, prioridades, pendientes.
- Se agrego `src/test/dicoPanel.test.jsx` para validar el tablero, la tarea
  persistente y la intervencion historica.

### Verificado

- Tests dirigidos del panel y Equipo: 23/23 en verde con Vitest y
  `--pool=threads`.
- El hook de cierre pasó typecheck, 87 smoke tests, build de Vite, integridad,
  schema sync y `git diff --check`; commit local `84cddb3` creado.
- La migración local de ubicación quedó renumerada como `0083` porque `origin`
  ya usa `0081` y `0082` para seguimiento y cancelación de pedidos.
- QA Lite no quedó verificado en navegador en este cierre: Docker no está
  disponible en el PATH, por lo que no se pudo bootstrapear la membresía local.

### Pendiente inmediato

1. Iniciar Docker Desktop y ejecutar `node scripts/qa-lite/revision-phase4.mjs`
   para abrir una sesión local con acceso a QA Lite y validar visualmente
   `Habla con Dico` y `Equipo`.
2. Revisar el merge resultante y publicar a `origin/main` cuando QA Lite esté
   disponible; no se hizo deploy desde este cierre.

### Bloqueado por Ricky

Docker Desktop no está instalado o no está en el PATH. Sin el Supabase local
de QA Lite no se puede generar una sesión autenticada de navegador ni hacer
la verificación visual final. La clave, si el bootstrap vuelve a ejecutarse,
seguirá quedando sólo en `.qa-lite/revision-phase4.txt` y
`~/.dico-qa-lite/owner-pass.txt`; no se copia al chat.

## 27/sep/2026 — Dico 3D sale del Slot y queda flotante (Codex)

### Lo que pidio Ricky

Sacar Dico 3D de la sidebar porque el Slot provocaba ciclos infinitos de
apertura y cierre; hacerlo aparecer centrado, moverlo para guiar acciones,
reusar la burbuja de Dico 2D, marcar objetivos con un pulso dorado y evitar
que la pose `thinking` se repita para siempre.

### Hecho

- `DicoPresence` ya no monta `DicoSlot` ni comparte el layout de la sidebar.
  `DicoFloatingPhysical` porta Physical a `document.body`, entra desde el
  centro y viaja hacia el nodo real de `objetivo` cuando la intervencion lo
  publica. Esto elimina la cadena hover -> resize de sidebar -> desplazamiento.
- `DicoFloatingPhysical` usa `MensajeDico`, el mismo componente de mensaje de
  Dico 2D. Los objetivos reales y los CTA reciben `.dico-guia-target` o
  `.dico-mensaje-accion--guiado`, con contorno y pulso dorado.
- `DicoPhysical` respeta `bucle: false`; la fila `espera` del atlas termina en
  su ultimo cuadro. El 3D no convive con Native durante una intervencion.
- `PlatformAdmin` dejo de suprimir Physical en mobile y dejo de reservar
  espacio para el Slot. Se retiraron las reglas de `.ag-sidebar .dico-slot`.

### Verificado

- 41/41 tests de Physical, Presence y expresiones.
- 67/67 tests Dico adicionales, incluyendo avisos, intervenciones, Slot y
  machineSoul.
- Build de Vite en verde.
- No se pudo inspeccionar el MP4 adjunto desde el sandbox; se implemento el
  cambio a partir del comportamiento y el codigo existentes.

### Pendiente inmediato

1. QA visual en QA Lite con una intervencion `catalogo-vacio` y otra de Caja,
   en desktop y mobile, para calibrar el destino y el tamano del conjunto.
2. Confirmar en navegador que el pulso dorado no tapa botones en pantallas
   chicas; si molesta, ajustar solo el offset del outline.

### Bloqueado por Ricky

El commit/push queda pendiente: el entorno rechazo la escritura de
`.git/index.lock`. El arbol sigue compartido con cambios concurrentes ajenos;
no se hizo `git add -A`, reset ni limpieza destructiva.
