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

There are two Playwright configs, and they do not overlap:

| Config | What it runs |
|---|---|
| `playwright.config.ts` | The general suite under `e2e/`. Today it only holds `delivery-persistence.spec.ts`, which still talks to the **legacy** schema (`recipes`, `orders.customer`) and is skipped unless the `E2E_SUPABASE_*` vars are set. **It does not cover the edificio yet.** |
| `playwright.qa-lite.config.ts` | DICO-QA-Lite: a local DOM/visual parity gate (Docker + local Supabase). The general config ignores `e2e/qa-lite/`. Run it with `npm run qa:lite:compare` — see `platform/qa-lite/README.md`. |

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
