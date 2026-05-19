# Plan de limpieza pre-onboarding — hermes-gastro

**Fecha:** 19 mayo 2026
**Repo:** github.com/diviancocorp-a11y/hermes-gastro
**Estado actual:** Limpieza completa. Listo para crear cliente nuevo.

---

## ✅ Pre-flight check (siempre correr antes de actuar sobre algo "urgente")

```bash
git log origin/main..HEAD --oneline          # ¿hay algo sin pushear?
git fetch && git status -sb                  # ¿estoy al día con origin?
# Vercel: ver latestDeployment.readyState de cada proyecto
```

Si esto sale limpio + Vercel READY, el problema no es de push/deploy. Buscar en otra parte (cache del SW, runtime logs, dominio mal apuntado).

---

## Contexto: cómo funciona la arquitectura multi-cliente

```
hermes-gastro/
├── clients/
│   ├── la-nona-pato/business.js   ← identidad LNP (nombre, colores, logo, geo)
│   └── cochi/business.js          ← identidad Cochi
├── src/                           ← código compartido (catálogo, admin, hooks, services)
├── vite.config.js                 ← lee CLIENT env var, setea alias @business + carga .env.<CLIENT>
├── .env.la-nona-pato              ← keys de Supabase LNP (gitignored)
└── .env.cochi                     ← keys de Supabase Cochi (gitignored)
```

**Build por cliente:**
- `CLIENT=la-nona-pato npm run build` → usa `clients/la-nona-pato/business.js` + `.env.la-nona-pato`
- `CLIENT=cochi npm run build` → usa `clients/cochi/business.js` + `.env.cochi`

**Vite resolve alias:** `@business` apunta a `clients/<CLIENT>/business.js`. Todo el código importa `from '@business'` — nunca directo.

**En producción (Vercel):** 2 proyectos Vercel separados, cada uno con su `CLIENT` y sus env vars de Supabase. Sin cambios.

**Supabase:** un proyecto por cliente.
- LNP: `rewzotanfurutjolghkf.supabase.co` (sa-east-1, ACTIVE_HEALTHY, con datos reales)
- Cochi: `nzrzfknvlnddpexghynq.supabase.co` (sa-east-1, ACTIVE_HEALTHY, base limpia)

---

## ~~Bug crítico useMemo~~ (no aplica — ya estaba resuelto)

Verificado el 19/05/2026:
- Commit `7eb4631` (fix del useMemo) presente local y en `origin/main` desde el 11/05.
- Vercel: `la-nona-pato` y `cochi` con `latestDeployment.readyState = READY`, fecha 19/05.

**Si algún catálogo se ve caído**, no es por falta de push. Causas reales a chequear: service worker cacheando build viejo, runtime error distinto, dominio custom no enlazado al deploy actual.

---

## Tareas completadas el 19/05/2026

### ✅ Tarea 1 — Separar `.env` por cliente

- Creados `.env.la-nona-pato` y `.env.cochi` con sus respectivas `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- `vite.config.js` ahora lee `.env.<CLIENT>` automáticamente al inicio (no rompe nada si el archivo no existe).
- `.gitignore` actualizado: ignora `.env` y `.env.*` salvo `.env.example`.
- Las env vars de Vercel siguen mandando en producción (no se tocaron).

**Cómo correr local ahora:**
```bash
CLIENT=la-nona-pato npm run dev
CLIENT=cochi npm run dev
```

### ✅ Tarea 2 — Aplicar `performance_indexes`

Aplicada la migración `add_performance_indexes` a ambos Supabase. 10 índices creados (orders, sales, expenses, order_items, waste_log, coupons, purchases). `IF NOT EXISTS`, idempotente.

Resto de migraciones locales (`feature_flags`, `theme_config`, `reviews`, `referrals`, `invoices`, `push_subscriptions`, `scheduled_export_cron`) **se dejaron sin aplicar**. El código que las consume falla silencioso o muestra sección vacía. Aplicar cuando se decida activar cada feature.

### ✅ Tarea 3 — `src/config/business.js`

No se pudo borrar físicamente desde la sesión (permisos), así que se reemplazó por un **re-export de `@business`** con un banner `⚠️ DEPRECATED`. Resultado: ya no hay duplicación, y cualquier import legacy a esa ruta sigue funcionando contra el archivo correcto.

**Próximo dev:** correr `git rm src/config/business.js` cuando quiera y todo sigue OK.

---

## ✅ Tarea 4 — Onboarding `mala-miga` (galletitas americanas, AR/ARS)

**Mejora aplicada al script `create-client.mjs`:**
- Ahora escribe `clients/<slug>/business.js` (antes pisaba `src/config/business.js`).
- Ahora escribe `.env.<slug>` (antes pisaba `.env`).
- Print de "próximos pasos" actualizado al flujo multi-cliente.

**Supabase `mala-miga` creado y configurado:**
- Project ID: `tszcksppdglktcmzgepd`
- URL: `https://tszcksppdglktcmzgepd.supabase.co`
- Region: `sa-east-1`
- Costo: USD 10/mes
- 7 migraciones aplicadas (clonadas de cochi, con fix del typo `ingredients_admin_all`)
- 20 tablas + RLS + policies + 8 funciones + 2 views + 5 category_groups sembradas
- 3 storage buckets: `recipe-images` (público), `backups` (privado), `receipts` (público)
- `add_performance_indexes` aplicado

**Archivos locales creados:**
- `clients/mala-miga/business.js` (bakery, es-AR, ARS, paleta cookie 🍪)
- `.env.mala-miga` (apunta al Supabase nuevo)

**Pasos manuales que faltan (no automatizables via MCP):**

1. **Vercel — crear proyecto** (la MCP no soporta `create_project`):
   - https://vercel.com/new → Import Git Repository → `hermes-gastro`
   - Project Name: `mala-miga`
   - Framework Preset: **Vite**
   - Build Command: `vite build` (default)
   - Output Directory: `dist` (default)
   - Environment Variables:
     ```
     CLIENT=mala-miga
     VITE_SUPABASE_URL=https://tszcksppdglktcmzgepd.supabase.co
     VITE_SUPABASE_ANON_KEY=sb_publishable_UH4xD3e3SI3XyyVb1zMT3Q_yJQuYjZX
     ```
   - Deploy → quedará en `mala-miga.vercel.app`.

2. **Edge Functions de Supabase** (las otras 2 instancias las tienen, esta no):
   - `submit-order`, `validate-coupon`, `admin-reset`, `notify-whatsapp`, `notify-new-customer`
   - Copiarlas desde el proyecto cochi (o LNP) usando `supabase functions deploy` con `--project-ref tszcksppdglktcmzgepd`.

3. **Asset del logo** (si corresponde):
   - `public/clients/mala-miga/favicon.png` o `logo-icon.jpg` (ver patrón de cochi).

**Verificación local:**
```bash
CLIENT=mala-miga npm run dev          # debería abrir con branding 🍪 contra DB nueva
CLIENT=mala-miga npm run build        # build OK
```

**Advisors de seguridad:** mala-miga hereda los mismos warnings que cochi/LNP (`security_definer_view` en 2 views, `function_search_path_mutable` en 6 funciones, `rls_policy_always_true` en 3 policies, etc.). Son del diseño base del repo — no introdujimos nada nuevo. Conviene encararlos como cleanup global del repo en otra iteración.

---

## Resumen de estado

| # | Tarea | Estado |
|---|-------|--------|
| 0 | Push fix useMemo | ✅ Ya estaba (8 días atrás) |
| 1 | Separar .env por cliente | ✅ Hecho |
| 2 | Aplicar performance_indexes | ✅ Hecho en LNP + Cochi |
| 3 | Limpiar business.js muerto | ✅ Re-export de @business |
| 4 | Crear cliente `mala-miga` | ✅ Supabase + archivos locales hechos; falta Vercel + edge functions (manual) |
