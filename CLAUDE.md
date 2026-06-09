# CLAUDE.md — Contexto para Claude en hermes-gastro

> Leer esto antes de tocar codigo. Te ahorra 30 min de descubrimiento.

---

## Que es esto

Multi-tenant SaaS para 3 dark kitchens argentinas:
- **la-nona-pato** (LNP) — Andres Chazarreta 1435
- **cochi**
- **mala-miga** (MM) — la del +18 (cookies cannabicas)

Cada tenant = 1 proyecto Supabase + 1 proyecto Vercel + 1 dominio. Mismo codigo, mismo schema, data separada.

## Stack

- **Frontend:** React 19 + Vite + JavaScript puro (NO TypeScript)
- **Estilos:** CSS plano con tokens (no Tailwind en src). Tokens viven en `--ac`, `--bg`, `--tx`, `--t2`, `--t3`, `--line`, `--b2`, `--b3`, `--font-heading`
- **Backend:** Supabase (3 proyectos distintos) — Postgres + Auth + Edge Functions Deno + Storage
- **Build:** Vite con `CLIENT=<slug>` env var. `__CLIENT__` es global inyectado
- **Hosting:** Vercel (3 proyectos, team `team_E5ATCc0AjW66Ej0axz7l5SSg`, IDs en `mcp__ac4fffd9-...__list_projects`)
- **Errores prod:** Sentry → edge function `sentry-to-telegram`
- **Push:** VAPID + service worker. Edge function `send-push` con target `{ role | user_id | phone }`

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
- **Para agregar col nueva:** 1) ALTER TABLE en 3 tenants, 2) agregar al Zod schema, 3) agregar al manifest, 4) actualizar `scripts/supabase-schema.json` con `npm run schema:sync`

### Phone-only auth (guestUser)
- Catalogo permite hacer pedidos sin signup via `localStorage.guestUser` + RPCs SECURITY DEFINER
- `useGuestUser()` en `src/lib/guestUser.js`. AuthContext une `user` (Supabase auth) + `phoneSession` (guest) en una sola `session`
- Historial via RPC `get_phone_customer_orders(phone_search)`
- Profile + customers se unificaron en `profiles` (con `nickname`) — NO existe mas `customerExtras` ni tabla `customers` separada para datos del usuario

### Catalog vs Admin
- `/` y `/info/:slug` = catalogo publico (catalog-pro)
- `/admin/*` = panel interno. Lazy-loaded como chunk `Admin-*.js`
- BrandModal en `src/components/admin/shared/` es la configuracion general del tenant

### Multi-tenant gotchas
- `__CLIENT__` se reemplaza en build, NO en runtime. Si ves el literal `__CLIENT__` en algun lado, el build esta mal
- Sentry tag `tenant` = `__CLIENT__`
- VAPID keys + Supabase keys son por tenant. El user las configura manualmente

## Bugs recurrentes (workarounds documentados)

### 1. Truncamiento Cowork↔Linux mount
**Sintoma:** archivos JSX se cortan al final despues de varios Edit. Pre-commit detecta con `scripts/check-file-integrity.mjs`.

**Fix:** restaurar desde HEAD:
```bash
head -n N file > /tmp/x
git show HEAD:file | sed -n 'M,$p' >> /tmp/x
mv /tmp/x file
```

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
- `check-supabase-columns.mjs` — cols en `.select()` existen en schema snapshot
- ESLint con max-warnings 200
- `vite build` local (atrapa imports rotos)

## Comandos utiles

```bash
npm run schema:sync          # regenera scripts/supabase-schema.json desde DB
CLIENT=la-nona-pato vite build  # build de un tenant especifico
```

## MCPs conectados

- **Supabase** (`mcp__6897d04b-fbfc-4725-8cd7-781371d4b8d5__*`) — los 3 proyectos via list_projects
- **Vercel** (`mcp__ac4fffd9-1da6-4512-8868-9dc6b8907e90__*`) — team_E5ATCc0AjW66Ej0axz7l5SSg
- **GitHub** repo: `diviancocorp-a11y/hermes-gastro` (publico)

## Tareas pendientes

**El backlog vivo esta en PLAN-DE-ACCION.md** (Sprint 0 completado el 9/jun/2026: address + delivery_cost persisten, verify_jwt fix, deps fantasma removidas). Proximos: Sprint 1 (seguridad: roles admin, adjust_stock anon, send-push auth) → Sprint 2 (multi-tenant) → Sprint 3 (limpieza) → Sprint 4 (vendible).

Pendientes heredados (ahora en Sprint 4/5 del plan): Sentry sourcemaps + Seer, refactor check-schema-sync para leer supabase-schema.json directo, pre-commit UTF-8 strict.

## Preferencias del usuario (Ricky)

- **Tono:** breve, objetivo, mas honestidad menos condescendencia
- **Siempre ofrecer una mejora al proceso que esta haciendo**
- **No pegar secrets en el chat** (especialmente service role)
- Habla en español argentino. El codigo va en español (sin tildes en comments por temas de encoding)

## Estado actual

Branch: `main`. Ultimo commit: `cce766a Fix UTF-8 corruption + reaplicar desglose propina/total en step 2`. **Pendiente: `git push` desde la terminal del user.**
