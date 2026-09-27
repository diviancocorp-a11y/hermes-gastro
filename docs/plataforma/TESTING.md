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

There are three Playwright configs, and they do not overlap:

| Config | What it runs |
|---|---|
| `playwright.config.ts` | The general suite under `e2e/`. Today it only holds `delivery-persistence.spec.ts`, which still talks to the **legacy** schema (`recipes`, `orders.customer`) and is skipped unless the `E2E_SUPABASE_*` vars are set. **It does not cover the edificio yet.** |
| `playwright.qa-lite.config.ts` | DICO-QA-Lite: a local DOM/visual parity gate (Docker + local Supabase). The general config ignores `e2e/qa-lite/`. Run it with `npm run qa:lite:compare` — see `platform/qa-lite/README.md`. |
| `playwright.smoke.config.ts` | The edificio in production (`smoke/`), after each deploy. See "Smoke del edificio" below. |

The legacy suites `order-flow`, `admin-flow` and `multi-client` were removed
on 27/sep/2026. They targeted the per-client Vercel deploys (mala-miga, cochi,
la-nona-pato), which now answer 404, and kept E2E red on `main` from 20/may.

### One-time setup

1. Copy `.env.e2e.example` to `.env.e2e` and fill in the `E2E_SUPABASE_*`
   vars. The service role is a secret: **never commit it.**

2. Install Playwright browsers (one time):
   ```bash
   npx playwright install --with-deps chromium
   ```

### Running locally

`playwright.config.ts` auto-loads `.env.e2e`, so:

```bash
npx playwright test                        # general suite (qa-lite excluded)
npx playwright test delivery-persistence   # one spec
npx playwright test --ui                   # interactive runner
```

After every run, `cleanupE2EOrders()` deletes any row in `orders` whose
`customer` starts with `e2e-`. The staging DB stays tidy.

### CI

`.github/workflows/e2e.yml` runs the general suite on every PR to `main` and
on every push to `main`; `ci.yml` has no E2E job of its own. The spec that is
left reads these secrets from **Repo Settings → Secrets and variables →
Actions**:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY` (not set today, so the spec is skipped)
- `E2E_SUPABASE_SERVICE_ROLE`

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
