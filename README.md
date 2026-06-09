# Hermes Gastro

Multi-tenant SaaS para dark kitchens. Mismo codigo, N clientes: cada tenant tiene su proyecto Supabase, su proyecto Vercel y su dominio.

**Tenants activos:** `la-nona-pato` · `cochi` · `mala-miga`

## Stack

- React 19 + Vite + JavaScript (sin TypeScript)
- CSS plano con design tokens (`--ac`, `--bg`, `--tx`, ...)
- Supabase: Postgres + Auth + Edge Functions (Deno) + Storage + Realtime
- Vercel (1 proyecto por tenant, build con `CLIENT=<slug>`)
- Sentry + edge function `sentry-to-telegram` para errores en prod

## Correr local

```bash
npm install
CLIENT=mala-miga npm run dev      # cualquier slug de clients/
CLIENT=mala-miga npm run build
npm test                          # vitest
npx playwright test               # e2e (ver TESTING.md)
```

## Documentacion

| Doc | Que contiene |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | Contexto operativo: convenciones, bugs recurrentes, gotchas |
| [SCHEMA.md](./SCHEMA.md) | Schema de DB documentado por dominio + onboarding de cliente nuevo |
| [INFORME-AUDITORIA.md](./INFORME-AUDITORIA.md) | Auditoria completa de codigo e infra (jun 2026) |
| [PLAN-DE-ACCION.md](./PLAN-DE-ACCION.md) | Plan priorizado de arreglos y mejoras |
| [TESTING.md](./TESTING.md) | Unit tests + suite E2E Playwright |
| [DIAGNOSTICO.md](./DIAGNOSTICO.md) | Diagnostico historico del refactor (may 2026) |
| [docs/security.md](./docs/security.md) | Medidas de seguridad implementadas |

## Estructura

```
clients/<slug>/business.js   identidad por tenant (nombre, colores, geo)
.env.<slug>                  keys Supabase por tenant (gitignored)
src/pages/Catalog.jsx        orquestador del catalogo publico (/)
src/catalog-pro/             screens del catalogo
src/components/admin/        panel interno (/admin)
supabase/functions/          edge functions Deno
supabase/migrations/000_initial_schema.sql   source of truth del schema
scripts/create-client.mjs    generador de cliente nuevo
```
