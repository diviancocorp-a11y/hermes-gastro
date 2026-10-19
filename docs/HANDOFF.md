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
- Pendiente para terminar la configuracion comercial: horarios, WhatsApp,
  medios/cuentas de pago y condiciones de envio. Siguen vacios; no se
  inventaron valores. Sin horarios el catalogo muestra Abierto por defecto.
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

## 17-19/oct/2026 — Prueba de carga con k6, skill /carga cada 15 días (Claude)

**Publicado.** PR #33 (`prueba/k6`, merge `fe95296`) y PR #32 (regla del
orquestador, merge `693fb2f`), los mergeó Ricky el 19/oct. Producción `READY`
en `fe95296` = `HEAD`. El CI se mide sobre el commit de este HANDOFF, que viene encima de `fe95296` (el push cancela la corrida anterior de `main`). No toca `src/`, la base
ni edge functions.

### Hecho

- **`scripts/carga/catalogo.js`** (k6) + **`scripts/carga/correr.mjs`** +
  `npm run carga:catalogo`. Repite una visita real al catálogo, medida en el
  navegador sobre crazy-miga: `get_catalog` + `mp-status` en paralelo.
  **Solo lecturas**, porque un pedido de prueba es un pedido real (comandera,
  push, Telegram, stock). El front no se prueba: es CDN de Vercel y no dice
  nada del sistema. El wrapper lee la key publicable del `.env` del edificio y
  corta si la URL no es `wwwzdgprsooyjgkuyoav`. `--sin-mp` simula la visita sin
  `mp-status`; `visita_ms` es lo que espera la visita.
- **Resultados** (detalle e historial en `docs/operacion/CARGA-K6.md`): con 20,
  50 y 100 usuarios, 0 errores; `get_catalog` med ~112 ms, p95 204 → 261 ms.
  En Postgres 2,6–3 ms por llamada y el máximo no se movió: **hasta 100
  usuarios la base no es el cuello de botella**, el tiempo es red + PostgREST.
  Picos aislados de 3,6 y 6,7 s que no salen de la base (comprobado); que sean
  red o gateway es deducción.
- **Incidente de red el 17/oct:** una corrida dio 19% de visitas rotas por
  TCP cortado contra las IPs de Cloudflare de Supabase (no 429 ni 5xx). La
  siguiente y la repetición dieron 0. Documentado; la skill sabe clasificarlo.
- **`mp-status` en cada visita** (`src/pages/Catalog.jsx:304`): es una edge
  function por visita y `mpConnected` solo lo usa el paso de pago. Medido con
  100 usuarios: con él 1736 requests / 868 invocaciones / visita p95 340 ms;
  sin él 880 / 0 / 183 ms. **Ojo:** la home no espera a `mp-status`, así que
  lo que se gana es cuota y una conexión menos, no render. Propuesta A
  (pedirlo con el primer producto en el carrito) escrita en el chat del 17/oct,
  **sin aplicar**: Ricky dijo "lo vemos después".
- **Skill `/carga`** (`.claude/skills/carga/SKILL.md`): 20/50/100 usuarios,
  cruce con `pg_stat_statements`, clasificación de errores, comparación
  contra `## Historial` y commit de la fila nueva solo si el checkout está en
  `main` sin cambios ajenos en el doc.
- **Tarea programada `dico-prueba-de-carga`** de la app de Claude: días 1 y 16
  a las 10:00, primera el **1/nov**. Vive fuera del repo, en
  `C:\Users\ricar\.claude\scheduled-tasks\dico-prueba-de-carga\SKILL.md`.
- **Orquestador:** regla `carga` en `scripts/hooks/orquestador-reglas.json`
  ("prueba de carga", "k6", "cuántos usuarios aguanta"…) + 2 prompts de
  ejemplo en el test + fila en la tabla de rutas de `CLAUDE.md`/`AGENTS.md`.
- **k6 instalado** en `C:\Program Files\k6\k6.exe` (v2.2.0, winget; pidió
  UAC). Si una PC no tiene admin: zip del release + checksum + `K6_BIN`.
- Fila de k6 en la tabla de herramientas evaluadas ("en prueba").

### Verificado

- Las corridas son reales contra producción (lecturas). `get_catalog` es
  `stable` sin DML y `mp-status` solo hace selects: no ensuciaron datos.
- Las llamadas nuevas de `pg_stat_statements` coinciden una a una con las
  visitas de k6.
- Test del orquestador: 32 en verde. Pre-commit completo en verde en los
  commits.
- El hook del orquestador corre en la máquina de Ricky: inyectó su aviso en
  cada prompt de esta sesión (era el pendiente 1 del 15/oct).
- **NO verificado:** la tarea programada nunca corrió. Arranca en el modo de
  permisos por defecto y puede frenar a pedir permiso.

### Pendiente inmediato

1. **Ricky: "Run now" una vez** en la tarea "DICO: prueba de carga quincenal
   (k6)" para aprobar los permisos que pide; si no, el 1/nov puede quedar
   esperando una aprobación. Tarda ~12 min y commitea una fila en `main`.
2. **Decidir `mp-status`** (opción A, un archivo de `src/`). Pide ok de Ricky.
3. **Escenario de panel (logueado)**: los advisors marcan 15
   `auth_rls_initplan` y 54 `multiple_permissive_policies` en `orders`,
   `order_items`, `profiles`, `staff`. No pegan en el catálogo (`get_catalog`
   es SECURITY DEFINER) pero sí en el panel, y no está medido.
4. **CI en ramas de trabajo**: `ci.yml` solo escucha `main`,
   `platform/runtime-tenant` y PRs; una rama `claude/**` o `prueba/**` no pasa
   por ningún gate hasta el PR. Propuesto, no hecho.
5. **Worktree `cool-fermat-5ba418`**: su rama ya está mergeada, pero es el
   `cwd` de la sesión "Orquestador de skills por hooks en DICO" (sin archivar)
   y su `.codex/` es distinto al de `main`. No se borró: archivar esa sesión,
   revisar `.codex/` y recién ahí `git worktree remove` + `prune`.
6. **Heredado del 15/oct** (esa sección se archiva hoy):
   - `SkipToContent.jsx` usa blanco sobre `#C45D3E` (4.21:1) y DM Sans; el
     `<main>` de `App.jsx` debería salir por ruta.
   - Los 12 `side-tab` del panel son el siguiente bloque para `/diseno`.
   - Los cron de GitHub (`morning-health` y el smoke) corrían ~8 h tarde el
     28/sep; mirar las últimas corridas antes de tocar nada.

### Bloqueado por Ricky

- El "Run now" de la tarea programada (punto 1) y el ok de `mp-status`.
- **Heredado del 15/oct, sigue vigente:** los números de ejemplo de la landing
  son inconsistentes entre sí (bife $1.200 con $340 de insumos vs. costo $520
  y margen 14%) y no cierran con el plan de $59.000/mes; y el WhatsApp del CTA
  es de EE. UU. (+1 786) para un público argentino
  (`src/pages/PlatformLanding.jsx`). Son contenido y decisión suya.

---

## 17/oct/2026 (tarde) — GerenteDico etapa 3: memoria de la charla y "anotar" (Claude)

**Publicado y verificado.** `2aadfe3` a `b119081`, CI verde en `b119081`.
Ricky cargó `GERENTE_GITHUB_TOKEN`, redeployó `gerente-webhook` e hizo la
prueba del paso D el 17/oct. El front no cambió.

### Hecho

- **0099 `gerente_memoria_y_notas`**, aplicada por MCP con ok de Ricky. Crea
  `gerente_mensajes` (la charla) y `gerente_notas` (los issues propuestos).
  Son tablas de plataforma, **sin `tenant_id`**: es la charla de Ricky con el
  bot, no datos de un negocio. RLS activa, cero policies y sin grants para
  anon/authenticated (verificado en la base). Snapshot del edificio al día
  hasta 0099.
- **Memoria:** a OpenAI le llegan los últimos 10 mensajes de las últimas 12 h.
  Se guarda solo el texto de Ricky y la respuesta final, nunca los resultados
  de las herramientas. Se borra lo de más de 30 días. `/olvidar` borra la
  charla.
- **Herramienta `anotar`** (`platform/functions/gerente-webhook/anotar.ts`):
  el modelo no crea el issue. Deja una nota `pendiente` y el código muestra el
  título y el cuerpo exactos, con el pedido de "Contestá SI". El SI lo revisa
  el código (`esSi`), no el modelo. La nota vence a los 15 min y cualquier
  otro mensaje la descarta. El paso `pendiente` → `creando` es un update
  condicionado, así un SI repetido no crea dos issues. El issue lleva el label
  `gerentedico` (si GitHub lo rechaza, se crea sin label). **El repo es
  público**: el prompt prohíbe montos y datos de clientes, y la vista previa
  muestra todo antes del SI.
- Tests: `src/test/gerenteWebhook.test.js` (25, con historia, SI, cuerpo del
  issue y `crearIssue` con fetch simulado).

### Lo que tiene que hacer Ricky (en este orden)

**A. Crear el token de GitHub** (permisos mínimos, solo issues de este repo)

1. Entrá a https://github.com/settings/personal-access-tokens/new (es
   **Settings** → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**).
2. **Token name:** `GerenteDico issues`
3. **Resource owner:** `diviancocorp-a11y`
4. **Expiration:** **Custom** y elegí una fecha a un año. Anotala en el
   calendario: cuando vence, el bot contesta "GitHub rechazó el token".
5. **Repository access:** **Only select repositories** → elegí `hermes-gastro`.
6. **Permissions** → **Repository permissions** → **Issues** → **Access:
   Read and write**. *Metadata: Read-only* aparece solo; no toques nada más.
7. **Generate token** y copiá el valor (empieza con `github_pat_`). GitHub lo
   muestra **una sola vez**.

> Ojo: un token **no se edita**. Si se vence o se pierde, se crea otro y se
> reemplaza el secret. Si `diviancocorp-a11y` es una organización, puede
> quedar "pending approval": se aprueba en la organización → **Settings** →
> **Personal access tokens** → **Pending requests**.

**B. Cargarlo en Supabase**

1. Entrá a
   https://supabase.com/dashboard/project/wwwzdgprsooyjgkuyoav/functions/secrets
   (**Edge Functions** → **Secrets**).
2. En **Add new secret**:
   - **Name:** `GERENTE_GITHUB_TOKEN`
   - **Value:** el token del paso A
3. **Save**. Tiene que aparecer en la lista `GERENTE_GITHUB_TOKEN`, al lado de
   `GERENTEDICOBOT` y `DICO_BRAIN`.

**C. Redeployar la function** (en la terminal del repo, en `main` actualizado)

```bash
node platform/scripts/deploy-functions.mjs --only gerente-webhook
```

Tiene que terminar con `gerente-webhook (no-verify-jwt) ... ok`. **No** hace
falta volver a registrar el webhook: sigue recibiendo los mismos mensajes.

**D. Probarlo en Telegram, con GerenteDico**

1. `/ayuda` → la bienvenida ahora menciona "anotar" y `/olvidar`.
2. `como viene crazy-miga?` y después `y cuantos productos tiene?` → la segunda
   respuesta tiene que hablar de crazy-miga sin que lo repitas (memoria).
3. `anota que hay que probar el anotar de GerenteDico` → te muestra
   "Issue para anotar en GitHub", el título, el cuerpo y "Contesta SI…".
4. `SI` → contesta `Anotado: issue #N` con el link. En GitHub, el issue tiene
   el label `gerentedico`. Cerralo: era de prueba.
5. `/olvidar` → "Listo, me olvide de la charla".

Si en el paso 3 dice "falta el secret GERENTE_GITHUB_TOKEN", el paso B no
quedó guardado. Si en el 4 dice "no tiene permiso de Issues", el paso A.6 o
A.5 quedaron mal: hay que crear un token nuevo.

### Verificado (en producción)

- `gerente_notas`: una nota `creada`, "Probar la función anotar", con
  `issue_number` 29. El issue #29 existe en GitHub con el label `gerentedico`
  y el cuerpo esperado (detalle, pedido original citado, pie con la fecha).
- `gerente_mensajes` vacía después del `/olvidar` del final, como corresponde.
  La memoria (paso D.2) no se puede ver en la base por eso; Ricky la probó en
  el chat.
- `function_logs` de 04:56 a 05:01 UTC: solo boot/shutdown, ningún warning de
  guardado ni error de OpenAI o GitHub.

### Pendiente

1. Cerrar el issue #29 (era de prueba).
2. Próxima etapa: que un issue `gerentedico` se convierta en PR y preview sin
   pasar por una sesión a mano.
