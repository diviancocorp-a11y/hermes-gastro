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
