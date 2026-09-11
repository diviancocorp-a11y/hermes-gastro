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
y un Vercel cada uno). Esos negocios hoy son tenants dentro del edificio. Los
proyectos viejos siguen existiendo, estan `INACTIVE` y no reciben deploys.
Todo documento que describa ese mundo vive en `docs/historico/` y no cuenta.

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

### Multi-tenant: edificio vs legacy

Conviven dos formas de resolver el tenant y hay que saber en cual estas:

- **Edificio (lo vigente):** el tenant sale del hostname en RUNTIME.
  `src/lib/tenantHost.js` lo resuelve y el aislamiento lo da RLS por
  `tenant_id`. Toda tabla nueva lleva `tenant_id` y una policy con el patron
  `tenant_id in (select private.current_user_tenants())`.
- **Legacy (los tres catalogos):** el tenant se hornea en BUILD con
  `CLIENT=<slug>`, y `__CLIENT__` es un global inyectado. Si ves el literal
  `__CLIENT__` sin reemplazar, el build esta mal. Sentry taggea `tenant` con
  ese valor.

Los **slugs reservados viven en 2 lugares**: `src/lib/tenantHost.js` y la
funcion SQL `is_reserved_slug`. Hay un test que los compara parseando la
migracion; si agregas uno, tocas los dos y actualizas a que migracion apunta
`src/test/reservedSlugsSync.test.js`.

Toda edge function publica va con **`verify_jwt=false`**: las keys
`sb_publishable_` no son JWT y el gateway las rechaza. La proteccion real es
rate-limit mas validacion interna.

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
- ESLint con max-warnings 200
- `vite build` local (atrapa imports rotos)

## Comandos utiles

`NODE_ENV=production` esta seteada global en la maquina de Ricky y se come las
devDependencies. **Prefijar todo con `NODE_ENV=` vacio.**

```bash
NODE_ENV= npm run build                      # build del edificio
NODE_ENV=test npx vitest run --pool=threads  # suite completa
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
NODE_ENV= CLIENT=hermes-cochi npm run build  # build de un catalogo legacy
npm run schema:sync                          # regenera los snapshots
npm run schema:sync -- --check               # no escribe: falla si difiere
```

`schema:sync` necesita `PLATFORM_SUPABASE_URL` +
`PLATFORM_SUPABASE_SERVICE_ROLE_KEY` exportadas; sin credenciales saltea sin
fallar. El lado legacy (`--target=legacy`, con los `LEGACY_*`) esta pausado y
no se va a despausar: esos proyectos se dan de baja.

## Antes de razonar sobre una RPC, traela

**La funcion DESPLEGADA puede no ser la que dice la migracion.** Paso con
`signup_tenant()`: la de produccion era mas nueva que cualquier archivo del
repo y leia un campo que no escribe nadie. Ningun gate lo detecta, porque
`check-schema-freshness.mjs` compara hasta que migracion dice estar al dia el
snapshot, no si lo desplegado coincide con lo que esa migracion produce.

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

- **El panel del edificio cubre productos, pedidos, caja y salon.** El resto
  del ERP (recetas, stock, compras, gastos, CRM, P&L) sigue siendo exclusivo
  del panel legacy. Los dos conviven y los decide `business.platform` en la
  ruta `/admin`: no comparten ni una tabla, no intentes unificarlos.
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
- Habla en español argentino. El codigo va en español (sin tildes en comments
  por temas de encoding)

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

Ojo: los tres proyectos Vercel legacy siguen linkeados a este mismo repo, asi
que **un push a `main` tambien los redeploya**. Desconectarlos es tarea
pendiente de Ricky en el panel de Vercel.

Para saber que hay publicado de verdad, comparar el SHA del ultimo deployment
de produccion de `hermes-platform` contra `HEAD` con el MCP de Vercel.
**Nunca leerlo del HANDOFF**: esa fila se escribe antes de deployar y nadie la
corrige despues.
