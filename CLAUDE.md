# CLAUDE.md — Contexto para Claude en Dico

> Leer esto antes de tocar codigo. Te ahorra 30 min de descubrimiento.

---

## Que es esto

**Dico**, la plataforma multi-rubro de **Divianco** (gastro, barberia, retail).
Divianco es la empresa, Dico es el producto: en textos legales va Divianco, en
marketing y producto va Dico.

> **La unica verdad de hoy es el edificio**: UNA base Supabase con RLS por
> `tenant_id`, UN proyecto Vercel, UN dominio. El tenant se resuelve en RUNTIME
> por hostname: cada negocio vive en `<slug>.divianco.app`.

Lo que **NO** es, aunque quede escrito en muchos lados: no hay un proyecto por
cliente. Esa era la era legacy (la-nona-pato, cochi, mala-miga con un Supabase
y un Vercel cada uno). El 27/sep/2026 se borraron esos proyectos, sus carpetas
de `clients/` y los tenants que los reemplazaban en el edificio: los negocios
se vuelven a cargar desde cero como tenants del edificio.
Todo documento que describa ese mundo vive en `docs/historico/` y no cuenta.

## Negocio: clientes y nombres (actualizado 13/oct/2026)

- **El producto se llama DICO.** Antes se llamo Hermes. Las carpetas, el repo
  (`hermes-gastro`) y el proyecto Vercel (`hermes-platform`) mantienen el
  nombre viejo a proposito: no se ven al publico y renombrarlos rompe cosas.
  **No renombrar nada de `hermes` a `dico`** salvo que Ricky lo pida.
- Divianco arma los nombres de producto con divianco, magnus, dante y paris.
  DICO = "di" + "co" de Divianco. Diconomy = DICO + economia (repo `FOCUS`).
- **Clientes que corren sobre DICO** (cada uno es un tenant del edificio, no
  un proyecto aparte). Todos pagan un porcentaje de la ganancia neta despues
  de gastos, al cierre de cada mes:
  - **La Nona Pato** (panaderia) — 33%. Activo.
  - **MiaEstudio** — 33%. Activo.
  - **Monare** (licores, mayorista y minorista, sin local; duena Mariana
    Marcano, CABA) — 13% durante 9 meses contados desde que el sistema tiene
    todos los datos cargados; despues paga la mensualidad normal.
    Implementacion $0. Cierre el dia 1, vence el dia 13; con mora se bloquea
    a partir del mes siguiente. Sin modulo de recetas.
  - **Crazy Miga** (gastro, marca de Ricky) — tenant `crazy-miga`, activo en
    el edificio desde el 27/sep/2026 (primer pedido 9/oct). Delivery Zona
    Norte, tema `noche`, sin local fisico. Condiciones comerciales: sin
    definir aca. Hay un workspace dedicado: los cambios van solo a este
    tenant y tocar Dico u otros tenants requiere autorizacion de Ricky.
  - **Cochi** — pausado. El legacy esta cerrado; va a vivir aca cuando Ricky
    le de curso.
- **Mascota DICO:** el personaje vigente se hizo con ChatGPT y se va a conectar
  a la API de Claude para que tenga vida dentro de la app. El diseno anterior
  (sistema de poses nativo, estados de cara) **ya no esta vigente**: no
  retomarlo.
- Proyectos cerrados que no hay que revivir: Pandora/Thor (ASGARD), la oficina
  virtual integrada a DICO, Mala Miga (el proyecto legacy; la marca ahora es
  Crazy Miga y vive como tenant del edificio).

## Orden de archivos (regla de Ricky, 13/oct/2026)

Ricky no quiere archivos regados. Cumplir siempre:

- **Nada fuera del repo.** No escribir en `C:\Users\ricar\Proyectos` ni en
  ninguna carpeta hermana: ni bundles, ni zips, ni patches, ni backups.
- **Un respaldo es una rama**, no un archivo: `git branch respaldo/<tema>-<fecha>`
  y push. Nunca `git bundle`, nunca zip de una worktree.
- **Temporales en el temp del sistema** (`os.tmpdir()`, `/tmp`), nunca en la
  raiz del repo. Si un script necesita una carpeta de salida dentro del repo,
  tiene que estar en `.gitignore` y se vacia al terminar.
- **Worktrees:** solo en `.claude/worktrees/`. Al cerrar la sesion, si la rama
  ya se mergeo, `git worktree remove` + `git worktree prune`.
- **Docs de negocio** (propuestas, contratos, Word) no van al repo: van a
  Google Drive.
- Al cerrar con `/cerrardico`, decir en el resumen si se creo algun archivo
  fuera de `src/`, `docs/`, `platform/` o `scripts/`, y por que.

## Donde esta escrito todo

`docs/` es la carpeta madre. Se empieza por **`docs/README.md`**, que dice
donde vive cada cosa, y por **`docs/HANDOFF.md`**, que es el estado entre
sesiones y se lee de arriba para abajo (lo mas nuevo primero).

En la raiz solo quedan tres markdown, y es porque las herramientas los leen de
ahi: `CLAUDE.md` (este), `AGENTS.md` (el mismo, para Codex) y `README.md`.

## Stack

- **Frontend:** React 19 + Vite + JavaScript puro (NO TypeScript)
- **Estilos:** CSS plano con tokens. Los del catalogo publico viven en
  `src/styles/dico-tokens.css` (`--ac`, `--bg`, `--tx`, `--t2`, `--t3`,
  `--line`, `--b2`, `--b3`, `--font-heading`, mas los `--ds-*` del design
  system). Tailwind v4 esta y **es infraestructura, no deuda**: el bloque
  `@theme` de `src/index.css` mapea los `--ds-*` y sacarlo rompe el design
  system entero
- **Backend:** Supabase `wwwzdgprsooyjgkuyoav` — Postgres + Auth + Edge
  Functions Deno + Storage. Es free tier y **se auto-pausa por inactividad**
- **Hosting:** Vercel `hermes-platform` (nombre viejo; renombrarlo rompe
  deploys a cambio de nada y no lo ve ningun cliente). Publica solo en cada
  push a `main`, por integracion de GitHub
- **Dominio:** `divianco.app` + wildcard `*.divianco.app` en Cloudflare. El
  registro `A *` va en DNS only (nube gris): el plan free no proxea wildcards
- **Correo:** Resend, dominio `send.divianco.app`, SMTP en Supabase Auth
- **Errores prod:** Sentry. El release se arma en UN solo lugar,
  `src/lib/release.js`, formato `dico@<BUILD_ID>`
- **Push:** VAPID + service worker. Edge function `send-push` con target
  `{ role | user_id | phone }`
- **Alias de build:** `@dico/core` apunta a `src/`

## Convenciones criticas (leer antes de tocar)

### Tema del catalogo (cp-root es obligatorio)
- 3 temas: `ambar` (default), `noche`, `carbon`
- CSS scoped: `body[data-cp-theme="X"] .cp-root { --ac: ...; }`
- **Cualquier componente del catalogo-pro DEBE tener `className="cp-root"`** o no recibe los tokens del tema
- Si agregas un componente nuevo y los colores no se aplican, esto es la causa
- **Al reves en el panel:** `cp-root` en el admin pinta fondo blanco e Inter y
  tapa los `--ag-*` (en tema oscuro dejo la supervision de Caja a 1.17:1).
  ESLint lo rechaza en `src/components/admin/`, `src/pages/admin/` y
  `PlatformAdmin.jsx` (`no-restricted-syntax` en `eslint.config.js`)

### Schema Zod === DB columns (Settings, Recipes, etc.)
- `src/lib/schemas/index.js` define `SettingsInputSchema`, `RecipeInputSchema`, etc.
- Zod hace **strip-mode** por default → campos no declarados se descartan silenciosamente
- **Si agregas una columna a DB y la usas en `set(...)` desde la UI pero olvidas agregarla al Zod → el upsert NO la persiste y NO da error**
- Bug recurrente: paso ya 4 veces (#54, #56, #96, ultimo). Ahora hay pre-commit que lo agarra
- Manifest: `scripts/db-columns-manifest.json` lista las cols que el Zod DEBE conocer. Pre-commit corre `scripts/check-schema-sync.mjs`
- **Para agregar col nueva:** 1) migracion en `platform/migrations/` aplicada al edificio (MCP `apply_migration`), 2) agregar al Zod schema, 3) agregar al manifest, 4) `npm run schema:sync` para regenerar el snapshot

### Phone-only auth (guestUser)
- Catalogo permite hacer pedidos sin signup via `localStorage.guestUser` + RPCs SECURITY DEFINER
- `useGuestUser()` en `src/lib/guestUser.js`. AuthContext une `user` (Supabase auth) + `phoneSession` (guest) en una sola `session`
- Historial via RPC `get_phone_customer_orders(phone_search)`
- Profile + customers se unificaron en `profiles` (con `nickname`) — NO existe mas `customerExtras` ni tabla `customers` separada para datos del usuario

### Catalog vs Admin
- `/` y `/info/:slug` = catalogo publico (catalog-pro)
- `/admin/*` = panel interno. Lazy-loaded como chunk `Admin-*.js`
- Navegacion del admin (rediseno 12/jun): bottom nav = Inicio · Pedidos ·
  Recetas · Stock · Ventas. Menu hamburguesa (desplegable del boton morph) =
  Compras, Gastos, CRM, Merma, Proveedores, Push, Usuarios. Burbuja de perfil
  (avatar elegible) = Personalizacion (BrandModal asPage), paginas de config
  Operacion/Finanzas/Zona de riesgo (Settings con prop `section`) y logout.
- Cuentas de pago: UNICA verdad en config Finanzas → "Cuentas y medios de pago"
- En Settings: NO usar dynamic imports de servicios (HERMES-GASTRO-G: chunk
  viejo tras deploy → "e is not a function"). Imports estaticos.

### Multi-tenant: el tenant sale del hostname

- **Edificio:** el tenant sale del hostname en RUNTIME.
  `src/lib/tenantHost.js` lo resuelve y el aislamiento lo da RLS por
  `tenant_id`. Toda tabla nueva lleva `tenant_id` y una policy con el patron
  `tenant_id in (select private.current_user_tenants())`.
  `npm run check:rls` lo verifica contra la base (y morning-health, cada
  manana): tabla sin RLS, policy abierta, vista sin `security_invoker` o
  funcion `SECURITY DEFINER` llamable desde el front sin aprobar. Funcion
  definer nueva: o `revoke execute ... from anon, authenticated`, o se suma
  a `DEFINER_APROBADAS` en `scripts/check-rls.mjs` con el motivo. El
  pre-commit y el CI lo exigen leyendo las migraciones (`npm run check:definer`).
- **El build (`CLIENT`):** quedan dos, `clients/edificio` (produccion, el
  default) y `clients/dico-qa-lite` (fixture local). Ninguno hornea el tenant:
  `business.slug` es solo el fallback de local y de las URLs `*.vercel.app`.
  `__CLIENT__` es un global inyectado; si ves el literal sin reemplazar, el
  build esta mal. Sentry taggea `tenant` con ese valor.

Los **slugs reservados viven en 2 lugares**: `src/lib/tenantHost.js` y la
funcion SQL `is_reserved_slug`. Hay un test que los compara parseando la
migracion; si agregas uno, tocas los dos y actualizas a que migracion apunta
`src/test/reservedSlugsSync.test.js`.

Toda edge function publica va con **`verify_jwt=false`**: las keys
`sb_publishable_` no son JWT y el gateway las rechaza. La proteccion real es
rate-limit mas validacion interna.

### Diseno: toda mejora de UI pasa por /diseno (regla de Ricky, 15/oct/2026)

- Toda mejora que toque UI (pantallas, componentes `.jsx`, CSS, `index.html`,
  la landing) se hace con la skill `/diseno` **antes de editar**. Ella maneja
  la linea de skills, no se elige a mano:
  1. autoridad de `docs/marca/`;
  2. linea base medida;
  3. UNA skill estetica (`impeccable` para pulir, `design-taste-frontend` para
     pantallas nuevas; `ui-ux-pro-max` nunca en este repo, DICO ya tiene
     sistema);
  4. subagente `disenador` construye, `auditor-diseno` audita en solo lectura;
  5. medicion antes/despues y link del preview de Vercel para que Ricky lo vea.
- La regla la recuerda el orquestador de skills (abajo): en una sesion larga
  lo escrito aca se pierde, el hook no.
- Codex no tiene hooks ni subagentes: lee `.claude/skills/diseno/SKILL.md`
  y sigue los mismos pasos, haciendo la auditoria como pasada aparte.
- Lo que no toca UI (migraciones, edge functions, scripts) no pasa por `/diseno`.

### Orquestador de skills: cual va y cuando (17/oct/2026)

Para que Ricky no tenga que activar ni acordarse de cada skill. Las reglas
viven en `scripts/hooks/orquestador-reglas.json` (regex sobre el prompt sin
tildes, sin LLM; se editan ahi) y las corre `scripts/hooks/orquestador.mjs`.
**Codex no tiene hooks**: estas mismas reglas, en texto, son las que tiene que
seguir solo.

| Si el pedido habla de... | Antes de hacer nada |
|---|---|
| UI: pantalla, componente, css, jsx, estilos, colores, botones, la landing | `/diseno`. Skill estetica: `design-taste-frontend` si es pantalla nueva o rediseno, `impeccable` si es pulir lo que hay |
| La base: RPC, tabla, migracion, columna, policy, RLS, trigger | `npm run mapa -- <nombre>` antes de razonar; migraciones con expandir y contraer |
| Cerrar la sesion, terminar por hoy, guardar el trabajo | `/cerrardico` |
| Retomar, en que quedamos, que hay pendiente | `/dico` |
| Competencia, un competidor | skill `analisis-competencia` |
| Prueba de carga, k6, cuantos usuarios aguanta | `/carga` (tambien cada 15 dias, tarea programada) |
| Sumar una skill, plugin, MCP o repo de terceros | El criterio de entrada (abajo): tabla de ya evaluadas, `gh api repos/<dueno>/<repo>` para licencia y ultimo push, instrucciones se copian, software va a `prueba/<herramienta>` |
| SEO, posicionamiento, palabras clave, sitemap, meta tags | skill `marketing:seo-audit`; si cambia `index.html` o la landing, ademas `/diseno` |
| Propuesta comercial, presentacion, deck, diapositivas | skill `propuesta-divianco` (o `pptx` si pide el archivo); no va al repo: Google Drive |

- **Ruteo** (hook `UserPromptSubmit`, `orquestador.mjs ruteo`): inyecta solo
  la indicacion que aplica; si no aplica ninguna, no dice nada. Una skill que
  ya se cargo en la sesion no se vuelve a pedir.
- **Candado** (hook `PreToolUse` sobre `Edit|Write|MultiEdit`,
  `orquestador.mjs candado`): al editar `src/**/*.jsx`, `src/**/*.css` o
  `index.html` (tests aparte) sin `/diseno` cargado en la sesion, le agrega
  al modelo el aviso de cargarla. Lo cargado sale del transcript leido como
  JSON por linea (tool `Skill`, su resultado o el `/diseno` que escribio
  Ricky), no de un grep: el texto aparece en cualquier salida que lo busque.
  Los subagentes `disenador` y `auditor-diseno` estan exentos.
- **Aviso y no bloqueo**: la deteccion es confiable en el hilo principal,
  pero un subagente que no sea de la linea de diseno no ve las skills del
  padre, y hay ediciones de UI chicas que Ricky pide sin la linea. Si se
  quiere que frene, `"modo": "bloqueo"` en el JSON y la edicion se rechaza
  hasta cargar la skill.
- Nunca rompe un turno: JSON roto, transcript ilegible o entrada rara terminan
  en salida vacia y exit 0. Tests en `src/test/orquestadorSkills.test.js`
  (los prompts de ejemplo de cada regla): si tocas una regla, corre ese test.

### Migraciones: expandir y despues contraer (16/oct/2026)

Vercel ya hace blue-green: cada deploy queda vivo y el Instant Rollback del
panel vuelve al anterior en segundos, sin build. Lo que no vuelve es la base:
hay UNA y la comparten todos los deploys, y ademas hay clientes con el chunk
viejo en cache (HERMES-GASTRO-G). Por eso:

- **Una migracion nunca rompe al codigo que esta en produccion.** Se aplica
  antes del push a `main`, asi que el deploy anterior corre contra ella un
  rato, y despues de un rollback, todo el tiempo que dure.
- **Renombrar o borrar** columna, tabla o RPC, cambiar una firma o volver algo
  `NOT NULL` va en dos pasos. Expandir: se agrega lo nuevo, el codigo lee lo
  nuevo y lo viejo, se hace el backfill. Contraer: lo viejo se borra en una
  migracion aparte, cuando el deploy que ya no lo usa lleva dias en produccion.
- **Edge functions**: se deployan aparte (`npm run deploy:functions`); misma
  regla con los campos que reciben y devuelven.
- **Si hay que volver atras**, rollback en Vercel, no revert + push: el revert
  rebuildea y tarda; el rollback es cambiar a donde apunta el dominio.
- **Lo frena `npm run check:expandir`** (pre-commit y CI): drop, rename,
  `set not null` o cambio de tipo en una migracion desde la 0096. El paso de
  contraer se declara en el archivo con `-- contraer: <por que ya no lo usa
  nadie>`. De la 0001 a la 0095, 6 migraciones lo habrian necesitado.

**Sumar un argumento a una RPC** es el caso mas comun, y no hace falta partirlo
en dos deploys ni marca: `check:expandir` lo reconoce solo, buscando la firma
vieja en las migraciones anteriores. El patron es el de la 0068
(`register_payment`):

```sql
drop function if exists public.register_payment(uuid, uuid, uuid, numeric, uuid);
create function public.register_payment(
  p_tenant_id uuid, p_order_id uuid, p_method_id uuid, p_amount numeric,
  p_reference text default null,          -- nuevo, con default
  p_client_request_id uuid default null
) returns public.payments ...
```

- **`drop` + `create` en la misma migracion** (en cualquier orden): corre en
  una transaccion, no hay un momento sin funcion.
- **NO `create or replace` sin el `drop`**: con otros argumentos crea una
  SEGUNDA firma al lado, y la llamada vieja falla por ambigua (Postgres
  "is not unique", PostgREST `PGRST203`). `npm run mapa` sin argumentos lista
  las funciones con mas de una firma viva.
- **Es compatible solo si** cada argumento nuevo tiene `default`, los viejos
  conservan nombre y tipo (PostgREST llama por nombre, asi que el orden no
  importa) y lo que devuelve no cambia de forma.
- Si no se cumple alguna (sacar un argumento, renombrarlo, cambiar el
  retorno): funcion nueva con otro nombre, el front migra, y la vieja se borra
  despues con su `-- contraer:`.

**Como se aplica una migracion (16/oct/2026):**

- **Archivo y base en la misma sesion.** Todo SQL que se aplica al edificio
  (MCP, panel, script) tiene su archivo en `platform/migrations/` en el mismo
  commit, con la cabecera `-- Aplicada via <MCP|panel> el <fecha>`. El 16/oct
  aparecio `alta_de_duenio_con_roles` (14/oct) aplicada sin archivo: el repo
  decia que `provision_owner` y `attach_owner` eran la version rota. Se
  rescato como 0096 copiando `statements` de `supabase_migrations.schema_migrations`.
- **Lo destructivo (`drop`, el paso de contraer) lo aplica Ricky desde el
  editor SQL del panel.** Por MCP un `drop` se cuelga a los 60s sin aplicar
  (paso 3 veces con la 0062). El agente prepara el SQL exacto, verifica antes
  (quien lo usa: repo, `pg_proc.prosrc`, vistas, triggers, policies) y despues
  (`pg_proc` o la tabla), y actualiza la cabecera del archivo.
- **Lo aditivo** (create, add column, create or replace) va por MCP
  `apply_migration` como siempre.
- **Lo vigila morning-health** (`check-migraciones-sin-archivo.mjs`, via el
  RPC `migrations_snapshot`, 0097): toda fila de
  `supabase_migrations.schema_migrations` tiene que tener archivo, comparando
  sin el numero adelante. Las 24 historicas que no coinciden por nombre estan
  en `scripts/migraciones-sin-archivo.json`, revisadas una por una el 16/oct
  (ninguna deja la base distinta del repo); solo se achica (`--podar`).

## Bugs recurrentes (workarounds documentados)

### 1. Corrupcion Cowork↔Linux mount (REGLA DURA)
**Sintoma:** archivos que se truncan o quedan con bloques insertados al medio
despues de escribir POR EL MOUNT. Paso 3 veces el 12/jun (python sobre
Settings.jsx, `cat >>` sobre admin-topbar.css).

**REGLA:** NUNCA escribir/append via el mount Linux (`cat >>`, `sed -i`,
python sobre /sessions/...). Editar SOLO con Edit/Write tools (lado Windows)
o scripts node/python ejecutados EN WINDOWS via Desktop Commander. El mount
es SOLO LECTURA en la practica — y aun leyendo puede mostrar contenido viejo
o "binary file matches": verificar siempre del lado Windows.

**Fix si paso:** `git checkout -- <file>` y rehacer con herramientas Windows.

### 2. UTF-8 cortado a mitad de caracter multi-byte
**Sintoma:** Vercel build falla con `[UNLOADABLE_DEPENDENCY] stream did not contain valid UTF-8`. Hoy paso con CheckoutScreen.jsx (commit 30aa94c).

**Causa:** `sed`/`cat`/Edit no respetan bordes de caracteres UTF-8. Cuando cortas un archivo con `─` (3 bytes 0xe2 0x94 0x80), podes cortar a mitad.

**Fix:** usar Python con `encoding='utf-8'` strict para ediciones grandes. Verificar antes de commit:
```bash
python3 -c "open('FILE','rb').read().decode('utf-8','strict')"
```

### 3. NULL bytes
**Sintoma:** archivo aparece como "binary" en `grep`. Pre-commit lo bloquea.

**Fix:** `tr -d '\000' < file > /tmp/x && mv /tmp/x file`

### 4. Archivos especialmente problematicos
- `src/catalog-pro/CheckoutScreen.jsx` — se corrompe siempre. **Preferir Python heredoc en vez de Edit tool**
- `src/components/admin/shared/BrandModal.jsx` — grande, se trunca facil
- `scripts/supabase-schema.json` — JSON sensible a comas/strings cortados

### 5. NODE_ENV=production global en Windows de Ricky
**Sintoma:** `npm install` instala ~59 paquetes (omite devDeps, borra vite/husky de node_modules). `npm test` falla masivo con `React.act is not a function`.

**Fix:** `npm install --include=dev` y `set NODE_ENV=test&& npm test`. De fondo: sacar NODE_ENV de las env vars del sistema.

### 6. Keys sb_publishable_ + verify_jwt=true = guest checkout roto
**Sintoma:** edge function devuelve `UNAUTHORIZED_INVALID_JWT_FORMAT` para guests. Paso en mala-miga desde su creacion (detectado 9/jun/2026).

**Causa:** las keys nuevas de Supabase (`sb_publishable_...`) NO son JWT; el gateway con `verify_jwt=true` las rechaza. Solo sesiones logueadas pasaban (mandan access token JWT). LNP ya tenia el fix en create-payment-preference (v8) pero nunca se propago a Cochi/MM.

**Fix aplicado:** funciones publicas (`submit-order`, `validate-coupon`, `create-payment-preference`, `mp-*`) con `verify_jwt=false` en los 3 tenants — la proteccion real es rate-limit + validacion interna. Toda function publica nueva: verify_jwt=false.

## Pre-commit hooks (lo que YA corre)

- `check-file-integrity.mjs` — EOF, NULL bytes, lineas truncadas
- `check-schema-sync.mjs` — Zod schemas vs DB manifest
- `check-schema-freshness.mjs` — el snapshot del edificio declara hasta que
  migracion esta al dia (`_migrations_through`); si hay una posterior, falla y
  te dice las dos salidas validas (regenerar o subir el marcador).
- `check-supabase-columns.mjs` — cols en `.select()` existen en el schema snapshot.
  Hay DOS snapshots porque hay dos bases: `scripts/supabase-schema.json` (legacy)
  y `scripts/platform-schema.json` (edificio). Cual se usa lo decide
  `PLATFORM_PATHS` dentro del script — archivo nuevo que le hable al edificio,
  sumalo ahi. Si un archivo consulta una tabla que solo existe del otro lado,
  el check avisa que esta mal clasificado en vez de dar un error confuso.
- `check-edificio-alcanzable.mjs` (`npm run check:alcanzable`) — primero valida con `scripts/check-hooks.mjs` que los comandos de `.claude/settings.json` que referencian `scripts/` apunten a archivos existentes (sin ejecutarlos); falla si falta uno. Luego recorre los
  imports desde `src/main.jsx` y exige que cada `.from()`, `.rpc()` y
  `functions.invoke()` alcanzable exista en `platform/migrations` o
  `platform/functions`. Lo roto al nacer esta en
  `scripts/llamadas-legacy-pendientes.json`, que solo se achica (`-- --podar`
  saca lo resuelto). Nacio porque el catalogo tiraba 9 consultas legacy por
  visita que caian en un fallback y ningun gate veia.
- `check-diseno.mjs` (`npm run check:diseno`) — corre `impeccable detect`
  sobre `src/` e `index.html` y compara contra `scripts/diseno-deuda.json`,
  que solo se achica (`-- --podar` saca lo resuelto). Nacio el 15/oct con 17
  hallazgos (bordes laterales de color, Inter en el catalogo) que ningun test
  veia. El flujo completo de diseno es la skill `/diseno`; las skills de
  terceros que usa se bajan con `npm run skills:diseno`.
- `check-migraciones-compatibles.mjs` (`npm run check:expandir`) — ninguna
  migracion nueva rompe al deploy anterior. Ver "Migraciones: expandir y
  despues contraer".
- ESLint con max-warnings 200
- `vite build` local (atrapa imports rotos)

## Comandos utiles

`NODE_ENV=production` esta seteada global en la maquina de Ricky y se come las
devDependencies. **Prefijar todo con `NODE_ENV=` vacio.**

```bash
NODE_ENV= npm run build                      # build del edificio
NODE_ENV=test npx vitest run --pool=threads  # suite completa
npm run mapa -- cerrar_ticket_de_cocina      # que migracion la define y quien la llama
npm run pantalla -- stock                    # mira una pantalla sin levantar la app
npm run pantalla:acciones -- viejo.jsx nuevo.jsx   # que se perdio al portarla
```

Las dos ultimas son para rehacer una pantalla desde un render. El orden
completo esta en `docs/plataforma/PORTAR-UNA-PANTALLA.md`, y conviene leerlo
antes de la primera linea: la primera vez se porto la lista de Stock y se
olvido el alta de insumos, con el build y los 1338 tests en verde.

**Siempre `--pool=threads`.** Con el pool `forks` vitest cuelga workers en
Windows, no ejecuta archivos enteros y **sale exit 0 igual**. Si el numero de
archivos o de tests baja sin motivo, es eso. Y si un test falla por
`Test timed out in 15000ms`, corrarlo aislado antes de darlo por roto: bajo
carga la maquina flakea y falla en archivos distintos en cada corrida.

```bash
NODE_ENV= CLIENT=edificio npm run build      # el build del edificio, a mano
npm run schema:sync                          # regenera los snapshots
npm run schema:sync -- --check               # no escribe: falla si difiere
```

`schema:sync` necesita `PLATFORM_SUPABASE_URL` +
`PLATFORM_SUPABASE_SERVICE_ROLE_KEY` exportadas; sin credenciales saltea sin
fallar. El lado legacy (`--target=legacy`, con los `LEGACY_*`) ya no tiene
contra que correr: esos proyectos se borraron.

## Antes de escribir codigo nuevo: la escalera (16/oct/2026)

Adaptada de Ponytail (`DietrichGebert/ponytail`) sin instalar el plugin: son
solo instrucciones, y aca las leen Claude y Codex. Primero se lee el codigo que
el cambio toca y se sigue el flujo real; despues se sube en orden y se frena en
el primer escalon que resuelve:

1. **Hace falta?** Si se resuelve sin codigo (config, un dato en la base,
   borrar algo), no se escribe.
2. **Ya existe en el repo?** `npm run mapa -- <rpc o tabla>` para la base,
   grep en `src/lib/`, `src/components/` y `platform/functions/` para el resto.
   Una RPC o un helper que duplica uno vivo es deuda desde el primer dia.
3. **Lo da el lenguaje o la plataforma?** JS y Web APIs; Postgres (constraint,
   default, trigger, policy); Supabase (Auth, Storage).
4. **Lo hace una dependencia ya instalada?** Mirar `package.json`. Sumar una
   dependencia nueva se le pregunta a Ricky.
5. **Recien ahi, lo minimo que funciona.**

Lo que NO se recorta para escribir menos: validacion en el borde de confianza
(RLS, `tenant_id`, edge functions publicas), manejo de errores que pierde
datos, seguridad y accesibilidad.

## Cambios quirurgicos y nada de "listo" sin evidencia (19/oct/2026)

Adaptado sin instalar de dos fuentes: las guias de Karpathy
(`multica-ai/andrej-karpathy-skills`; el repo no tiene licencia, asi que se
reescribe y no se copia) y `verification-before-completion` de Superpowers
(`obra/superpowers`, MIT). El resto de Superpowers se pisa con la escalera,
`/code-review`, `/simplify` y las reglas de worktrees.

- **Supuestos a la vista.** Si el pedido admite dos lecturas, se dicen las dos
  antes de elegir. Si algo no cierra, se pregunta antes de escribir, no
  despues de romper.
- **Cada linea cambiada sale del pedido.** No se "mejora" codigo vecino, ni
  comentarios, ni formato; se respeta el estilo del archivo. Codigo muerto
  ajeno se menciona, no se borra. Lo que tu cambio deja huerfano (imports,
  variables, funciones) si se saca.
- **Criterio de exito antes de empezar.** "Arreglar el bug" se vuelve "un test
  que lo reproduce, y que pase"; en una tarea de varios pasos, cada paso dice
  con que se verifica.
- **Sin evidencia no hay "listo".** Antes de decir que algo funciona, pasa,
  esta aplicado o esta publicado: correr AHORA el comando que lo prueba (el
  test, `npm run ci:esperar`, un `select` contra la base, el SHA del deploy en
  Vercel), leer la salida entera y el exit code, y recien ahi afirmarlo. Si no
  se pudo comprobar, se dice "no verificado" y por que. Paso seis veces que se
  reporto una deduccion como hecho; la ultima, una migracion en `main` que
  nunca se aplico a la base.
- **Senales de que se esta por afirmar sin evidencia:** "deberia andar",
  "seguramente", "ya quedo", o dar por bueno el reporte de un subagente o de
  otra sesion sin mirar el diff.

## Skills, plugins y MCPs de terceros: criterio de entrada

Antes de sumar una herramienta, responder:

- **Que bug o friccion documentada resuelve** (HANDOFF, "Bugs recurrentes")?
  Si no resuelve ninguna, no entra.
- **Se pisa con algo que ya hay** (`/diseno`, `npm run mapa`, los `check:*`,
  `/code-review`, `/simplify`)? Si se pisa, no entra, o reemplaza lo viejo y
  se dice cual.
- **Si son solo instrucciones**, se copian aca y en `AGENTS.md` en vez de
  instalarlas (asi tambien las usa Codex).
- **Si es software**, se prueba en una rama `prueba/<herramienta>` con una
  tarea real y se compara el diff contra la misma tarea sin ella.
- **Nunca** un proxy o gateway de modelos que vea prompts o guarde credenciales.

Ya evaluadas (no reabrir sin un motivo nuevo):

| Herramienta | Decision | Por que |
|---|---|---|
| Ponytail | Adaptada (escalera de arriba) | Solo instrucciones; ataca el codigo duplicado |
| OmniRoute | No | Gateway que ve prompts y credenciales; el respaldo ya es Codex |
| Graphify | No | Se pisa con `npm run mapa` y `check:alcanzable`; el grafo envejece |
| Agent Skills (addyosmani) | No | Se pisa con `/diseno`, `/code-review`, `/simplify`, `/cerrardico` |
| claude-mem (memoria persistente) | No | Se pisa con HANDOFF + `/dico`/`/cerrardico`; Codex no la ve y gasta tokens comprimiendo |
| Task Observer | Adaptada (paso en `/cerrardico`) | Solo instrucciones: convertir correcciones repetidas en reglas |
| Headroom | No (por ahora) | Reescribe lo que ve el modelo; ahorro en codigo chico (15-20%, autodeclarado) |
| claude-code-setup (oficial) | Correrlo una vez, no dejarlo | Solo recomienda; cada recomendacion pasa por este criterio |
| Blue-green (concepto) | Adaptado (expandir y contraer) | Vercel ya lo hace; lo que faltaba era la regla de la base compartida |
| Anti-slop (varias) | No | Se pisa con `impeccable` + `check:diseno` |
| Thermos (ports de Cursor) | No | Se pisa con `/code-review`; ports no oficiales |
| ECC (everything-claude-code) | No | Cientos de skills y hooks: ruido de contexto y superficie de hooks ajenos |
| k6 (Grafana, carga) | En prueba (rama `prueba/k6`) | Mide la carga sobre Supabase; no se pisa con ningun check. Binario aparte, no toca `package.json`. Ver `docs/operacion/CARGA-K6.md` |
| Superpowers (`obra/superpowers`) | Adaptada (solo `verification-before-completion`) | Ataca "comprobar antes de afirmar"; lo demas se pisa con la escalera, `/code-review`, `/simplify` y worktrees |
| Karpathy skills (`multica-ai/andrej-karpathy-skills`) | Adaptada (cambios quirurgicos) | Cuatro reglas, reescritas porque el repo no tiene licencia |
| Claude Octopus | No | 54 comandos y 63 skills (el motivo de ECC); el segundo modelo ya es Codex |
| I Have ADHD | No | No hay repo verificable; respuestas breves ya es preferencia de Ricky (output style de la app) |
| Opencode | No | Agente de codigo: ya estan Claude y Codex |
| Harper | No | Corrector pensado para ingles; Ricky escribe en espanol |
| Vane (ex-Perplexica) | No | Se pisa con WebSearch y `deep-research`; un servidor mas para mantener |
| agenticSeek | No | Se pisa con el navegador integrado y Claude in Chrome; GPL |
| Presenton / ppt-master | No | Se pisa con `propuesta-divianco`, `pptx` y Slides (regla del orquestador); las propuestas van a Drive |
| ai-website-cloner-template | No | Plantilla Next.js (el stack es Vite); se pisa con `design-taste-frontend` |
| Awesome Design | No | Lista de links, sin cambios desde 2024 |
| Duix-Avatar | No | Avatar de una cara humana con licencia propia; la mascota DICO va por la API de Claude |
| YouTube Agent Skill | No | No es del repo; se reabre si Divianco arma un canal |
| Meetily | Fuera del repo (opcional para Ricky) | Notas de reuniones en local; no le sirve al orquestador |
| CompAI CRM | No (por ahora) | El CRM interno de Divianco se mira con 3+ clientes pagos (plan de la consola); sirve de referencia para el CRM de DICO |
| Open-SEO | No (por ahora) | Primero `marketing:seo-audit` (regla del orquestador); Open-SEO es una app mas para hostear |
| PaddleOCR | No (por ahora) | Python pesado sin donde correr (las functions son Deno); facturas y listas de precios (alta de Monare) primero con Claude y vision |
| Scrapling | No (por ahora) | `analisis-competencia` con el navegador alcanza para pocos sitios; leads por scraping roza terminos de uso y datos personales |
| changedetection.io | No (por ahora) | Pide Docker, que en la maquina de Ricky se traba; vigilar la competencia va mejor como tarea programada que llama a `analisis-competencia` |
| Web Design Guidelines (`vercel-labs/agent-skills`) | En prueba (rama `prueba/web-design-guidelines`) | Copia fija como pasada final de `auditor-diseno`. En Caja sumo dos bugs reales (doble envio, hora UTC), pero mezclada se comio el de montos. Falta repetir en otra pantalla. Ver `docs/operacion/PRUEBA-WEB-DESIGN-GUIDELINES.md` |
| Image to Code (`Leonxlnx/imagegen-skills`) | No | No lee una imagen tuya: genera imagenes y maqueta sitios de marketing para Codex. Claude Code no genera imagenes; la landing ya la cubre `design-taste-frontend` |
| Clonadores de sitios (`drshailesh88/ui-cloner-skill`, `JCodesMore/ai-website-cloner-template`) | No | El primero no tiene licencia (5 estrellas, sin push desde marzo); el segundo es Next.js y ya estaba evaluado. Hacen lo mismo que leer el codigo del sitio con el navegador integrado, y copiar 1:1 el sitio de otro es copiar su codigo y su diseno: se estudia la tecnica y se rehace con `/diseno` |

## Antes de razonar sobre una RPC, traela

Primero `npm run mapa -- <rpc o tabla>`: dice que migraciones la tocan, en
cual de las dos bases, que firma quedo vigente y que codigo la llama. Sin
argumentos lista lo que el repo no cierra: RPC que ninguna migracion define y
funciones con mas de una firma viva. Es lectura de archivos, no de la base.

**La funcion DESPLEGADA puede no ser la que dice la migracion.** Paso con
`signup_tenant()`: la de produccion era mas nueva que cualquier archivo del
repo y leia un campo que no escribe nadie. `check-functions-drift.mjs` lo mira
cada manana en morning-health: el cuerpo y la firma de TODAS las funciones
de `public` (desplegadas vs las que dejan vivas las migraciones; el 16/oct
dio 83 de 83 despues de rescatar 4 que no coincidian). Una firma de mas en la base es una migracion sin aplicar o algo
aplicado fuera del repo. Para una funcion puntual, lo directo:

```sql
select pg_get_functiondef('public.signup_tenant'::regproc);
```

## MCPs conectados

- **Supabase** (`mcp__6897d04b-...__*`) — el edificio es
  `wwwzdgprsooyjgkuyoav`. Es free tier: si `get_project` dice `INACTIVE`, hay
  que `restore_project` y esperar unos minutos
- **Vercel** (`mcp__ac4fffd9-...__*`) — team `team_E5ATCc0AjW66Ej0axz7l5SSg`,
  el proyecto del edificio es `hermes-platform`
- **GitHub** repo: `diviancocorp-a11y/hermes-gastro` (publico)

## Donde esta el backlog

El backlog vivo esta en **`docs/HANDOFF.md`** (seccion 0) y en
`docs/plataforma/PLAN-ERP.md`. Alta de cliente: `docs/plataforma/ONBOARDING.md`.
Lo que solo puede hacer Ricky a mano: `docs/TAREAS-MANUALES.md`.

Deploy de functions: `npm run deploy:functions` (apunta solo al edificio).
Alta de tenant: `npm run create-owner`. `npm run create-client` ya no existe
como alta: quedo como guard que falla y explica por que.

## Lo que todavia no existe (no lo reportes como roto)

- **No hay panel legacy.** `pages/Admin.jsx` (el ERP single-tenant) y las
  ramas `business.platform` del catalogo se borraron el 29/sep: `/admin` es
  solo `PlatformAdmin`. Lo que el ERP viejo tenia y el edificio no, no tiene
  pantalla. Lo legacy que todavia es alcanzable esta listado en
  `scripts/llamadas-legacy-pendientes.json`: se borra o se porta, no se
  esquiva con un `if`.
- **`unit_cost` va en 0**: el edificio no tiene modelo de costos, asi que el
  P&L no da.
- **No hay con que cobrarle al cliente**: hay planes y precios, pero el
  registro de cobros guarda `paga_hasta` y nada mas, y la suscripcion de
  MercadoPago no esta.

Antes de reportar cualquiera de estas como pendiente, **comprobalo**: son
todas verificables con un curl, un `ls` o una consulta. Esta lista ya dio por
rotas cosas que estaban hechas y costo sesiones enteras de planificar al pedo.

## Preferencias del usuario (Ricky)

- **Tono:** breve, objetivo, mas honestidad menos condescendencia
- **Siempre ofrecer una mejora al proceso que esta haciendo**
- **No pegar secrets en el chat** (especialmente service role). Las carga el
  en el panel que corresponda; nunca se las pidas
- **Cuando Ricky tiene que hacer algo en un panel externo** (Vercel, Sentry,
  Supabase, GitHub, Telegram): pasos numerados clic por clic, con el nombre
  exacto de cada boton, los valores listos para copiar (sin comillas) y que
  tiene que ver al final para saber que salio bien. Lo que olvida seguido
  (redeploy despues de una variable, un token no se edita: se crea otro) va
  marcado aparte. Nacio el 16/oct: las instrucciones de Sentry en prosa no
  alcanzaron y hubo que rehacerlas paso a paso
- Habla en español argentino. El codigo va en español (sin tildes en comments
  por temas de encoding)

## Que se hace sin preguntar (regla de Ricky, 16/oct/2026)

Para no frenar en cada "propongo -> dale". **Se hace, se verifica y se
reporta** (commit chico a `main`, con el SHA en el resumen):

- **Checks y gates que solo leen**: `scripts/check-*`, morning-health, sus
  tests, y ajustarlos cuando dan falso positivo.
- **Docs del repo**: `CLAUDE.md` + `AGENTS.md` (siempre los dos), `docs/`, y la
  tabla de herramientas evaluadas.
- **Rescatar al repo lo que ya corre en la base**: archivo de migracion
  copiado tal cual de `schema_migrations` o `pg_get_functiondef`, sin
  aplicarlo.
- **Consultas de solo lectura a la base** (MCP `execute_sql` con `select`).

**Pide el ok de Ricky antes:**

- **Todo lo que se aplica a la base**: migraciones y datos. Lo destructivo lo
  aplica el desde el panel (ver "Como se aplica una migracion").
- **Codigo que cambia lo que ve o hace un cliente**: `src/`, edge functions,
  `npm run deploy:functions`. La UI ademas pasa por `/diseno`.
- **Un tenant puntual** (Crazy Miga tiene su workspace), secrets, config de
  Vercel o Supabase, y dependencias nuevas.

Si algo no entra claro en ninguna de las dos listas, se pregunta.

**Despues de cada push a `main`, mirar el CI antes de dar el trabajo por
terminado**: `npm run ci:esperar` espera el run de `ci.yml` de ese SHA y
lista los jobs (sale 0 verde, 1 rojo, 2 sin veredicto: sin respuesta, o run
cancelado por un push posterior). Corre hasta 15 min y escribe una linea por
consulta: no envolverlo en `timeout` ni filtrarlo con `tail`, que lo hacen
parecer colgado y tiran el exit code. En la nube de
Claude Code: `NODE_USE_ENV_PROXY=1 npm run ci:esperar` (sin el proxy, Node
consulta sin token y el limite es 60 por hora). El pre-commit verde no alcanza: el 16/oct se
pushearon 12 commits sin mirarlo. Un rojo que ya estaba antes del primer
commit de la sesion no es de la sesion, pero se dice en el resumen. Desde el
16/oct (`6e055c8`) el CI esta entero en verde, *Security Audit* incluido.

## Como se trabaja entre dos agentes

Codex y Claude trabajan sobre el mismo repo, a veces al mismo tiempo.

- `docs/HANDOFF.md` es el canal comun. Se abre por ahi y se cierra con
  `/cerrardico`, que lo actualiza.
- **El HANDOFF no alcanza solo**: hay trabajo en worktrees paralelas que no se
  ve ni en `git log` ni en GitHub. Antes de editar o borrar, correr
  `git worktree list` y `git -C <cada-una> status --short`.
- Todo archivo modificado o sin seguimiento es trabajo vivo del otro hasta que
  entiendas su proposito. No lo reemplaces ni lo revuelvas para avanzar.
- **Commits chicos y de un solo tema**, para que el otro pueda revertir uno sin
  perder el resto. **Nunca `git add -A`**: rutas explicitas, o te llevas puesto
  el working tree del otro.

## Estado actual

Rama de trabajo y de publicacion: **`main`**. Cada push publica el edificio en
`divianco.app` por la integracion de GitHub.

Los tres proyectos Vercel legacy ya no existen: un push a `main` publica solo
`hermes-platform`.

Para saber que hay publicado de verdad, comparar el SHA del ultimo deployment
de produccion de `hermes-platform` contra `HEAD` con el MCP de Vercel.
**Nunca leerlo del HANDOFF**: esa fila se escribe antes de deployar y nadie la
corrige despues.
