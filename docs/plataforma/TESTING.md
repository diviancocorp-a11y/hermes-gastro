# Testing — Hermes Gastro

## Unit tests (vitest)

```bash
npm test          # runs once
npm run test:watch
```

All unit suites live under `src/test/`. Coverage runs against `src/lib`,
`src/services`, `src/hooks`, `src/components/ui` with a 70% statements floor
(see `vite.config.js`).

## End-to-end tests (Playwright)

The E2E suite (under `e2e/`) hits the **mala-miga** staging deployment by
default and is split into three suites:

| Suite | What it checks |
|---|---|
| `order-flow.spec.ts` | Customer can add product, complete checkout, see confirmation |
| `admin-flow.spec.ts` | Admin can log in, navigate tabs, no fatal console errors |
| `multi-client.spec.ts` | Each Vercel deploy (mala-miga / cochi / la-nona-pato) shows the correct title and manifest |

### One-time setup

1. Copy `.env.e2e.example` to `.env.e2e` and fill in:
   - `E2E_SUPABASE_SERVICE_ROLE` — from Supabase Dashboard of the staging
     project → Project Settings → API → `service_role` secret. **Never commit.**
   - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` — create a dedicated test
     admin in Supabase Dashboard → Authentication → Users → Add user.
     Email is auto-confirmed. Password ≥ 12 chars.

2. Install Playwright browsers (one time):
   ```bash
   npx playwright install --with-deps chromium
   ```

### Running locally

`playwright.config.ts` auto-loads `.env.e2e`, so:

```bash
npx playwright test               # all suites
npx playwright test order-flow    # one suite
npx playwright test --ui          # interactive runner
```

After every run, `cleanupE2EOrders()` deletes any row in `orders` whose
`customer` starts with `e2e-`. The staging DB stays tidy.

### CI

`.github/workflows/e2e.yml` runs the full suite on every PR to `main` and
on every push to `main`. It needs these secrets configured at
**Repo Settings → Secrets and variables → Actions**:

- `E2E_TARGET_URL`
- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_SUPABASE_SERVICE_ROLE`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

On failure, the workflow uploads `playwright-report/` as an artifact so
you can download the HTML report with screenshots/video of the failed step.

### What the suite intentionally DOES NOT cover

- Push notifications (Twilio creds required, not on critical path)
- Magic link / OAuth (requires captcha bypass)
- Offline / PWA install (manual QA)
- WhatsApp deep-links (no headless way to verify external app open)

## Smoke del edificio (produccion)

`smoke/edificio.spec.ts` abre produccion como un cliente, con su propio config
(`playwright.smoke.config.ts`) para no mezclarse con la suite de los PRs:

- la landing de `divianco.app` renderiza;
- el catalogo de cada negocio real de `SMOKE_TENANTS`: `get_catalog`
  responde con productos, el titulo
  es el `biz_name` de ese negocio, el tema salio de los settings reales y hay
  un producto a la vista;
- las fotos de esos productos responden (test aparte);
- con credenciales, el panel de un negocio de prueba (login y panel);
- en todos, que no haya errores JS sin atrapar.

Solo lectura: no crea pedidos. No prueba el codigo de un PR sino lo publicado,
por eso `.github/workflows/smoke-edificio.yml` corre despues de cada deploy de
produccion y una vez por dia, no en los PRs.

```bash
SMOKE_TENANTS=cochi,mala-miga npm run test:smoke
```

`SMOKE_TENANTS` no tiene valor por defecto. En CI sale de la **variable** del
repo con ese nombre (**Settings → Secrets and variables → Actions →
Variables**), separada por comas. Vacia, los catalogos se saltean con aviso y
quedan la landing y el admin: cargala cuando los negocios esten de nuevo en el
edificio.

El test del admin necesita tres secrets en GitHub (**Settings → Secrets and
variables → Actions**): `SMOKE_ADMIN_SLUG`, `SMOKE_ADMIN_EMAIL` y
`SMOKE_ADMIN_PASSWORD`. Tienen que ser de un usuario de prueba de un negocio de
prueba, nunca de un cliente real. Sin ellos ese test se saltea.
