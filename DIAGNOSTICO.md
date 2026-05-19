# Diagnóstico del repo `hermes-gastro` — 19 mayo 2026

Generado en FASE 0 del refactor. NADA fue tocado todavía. Este documento es solo lectura/análisis.

---

## 1. Inventario del código

- **122 archivos** `.js` / `.jsx` en `src/`
- **19 archivos de tests** (9511 líneas — incluyendo tests obsoletos)
- **0 tests E2E** (Playwright instalado pero `e2e/` no existe)
- **15 archivos SQL** (8 en `supabase/migrations/` + 7 legacy sueltos en root)
- **3 clientes** activos: `la-nona-pato`, `cochi`, `mala-miga`

## 2. Schema real (Mala Miga como referencia limpia)

24 tablas / views en `public`:

```
addresses · admin_audit_log · category_groups · combo_items · coupons
customer_masked_view · customers · expenses · favorites · feature_flags
ingredients · order_items · order_tracker_view · orders · profiles
purchase_items · purchases · rate_limits · recipe_ingredients · recipes
sales · settings · theme_config · waste_log
```

Las 3 DBs (LNP, Cochi, MM) tienen el mismo set tras los fixes recientes.

## 3. Inconsistencias críticas a resolver

### 3.1 Status nombres duales — 13 archivos afectados

`OrderStatus` en `src/lib/utils.jsx` mapea keys cortos (`prep`, `done`, `cancel`) a valores largos del DB (`preparing`, `completed`, `cancelled`). Cada vez que un archivo escribe el literal en lugar de la constante, queda un bug latente.

Archivos que usan los literales o claves duales:

| Archivo | Forma usada |
|---|---|
| `src/pages/Catalog.jsx` | `OrderStatus.prep` |
| `src/pages/Admin.jsx` | `OrderStatus.prep` |
| `src/pages/OrderTracker.jsx` | strings literales `"preparing"`, `"completed"` |
| `src/components/admin/Orders.jsx` | `OrderStatus.new`, `OrderStatus.prep`, `OrderStatus.active`, `OrderStatus.done`, `OrderStatus.cancel` |
| `src/components/admin/Waste.jsx` | `'cancel'` string literal |
| `src/components/admin/Home.jsx` | `OrderStatus.new`, `OrderStatus.prep` |
| `src/hooks/useFinancials.js` | `OrderStatus.done` |
| `src/hooks/useOrderWorkflow.js` | `OrderStatus.prep`, `OrderStatus.active`, `OrderStatus.done`, `OrderStatus.cancel` |
| `src/services/orders.js` | `ACTIVE_STATUSES` — ya arreglado (`'preparing'`) |
| `src/lib/utils.jsx` | Define el enum |
| `src/lib/schemas/index.js` | Zod enum con ambos sets (legacy) |
| `src/test/schemas.test.js` | Tests con `'prep'`, `'done'`, `'cancel'` |
| `src/locales/es-AR/common.json` | Translations key |

**Decisión aplicada (FASE 1):** unificar a `OrderStatus.NEW`, `OrderStatus.PREPARING`, `OrderStatus.ACTIVE`, `OrderStatus.COMPLETED`, `OrderStatus.CANCELLED`. Borrar deprecations `ST`, `ST_L`, `ST_C`, `ST_B`. Eliminar el set legacy del Zod schema.

### 3.2 Hardcoded "La Nona Pato" / "LNP" / "lnp-" — 12 archivos

Estos asumen LNP cuando deberían ser genéricos Hermes:

| Archivo | Contenido |
|---|---|
| `src/types/index.ts` | Comment: `Core Domain Types for La Nona Pato` |
| `src/lib/i18n.js` | `lookupLocalStorage: 'lnp-lang'` + comment |
| `src/lib/observability.js` | Comment + `release: la-nona-pato@${APP_VERSION}` |
| `src/locales/es-AR/common.json` | `"name": "La Nona Pato"` (fallback i18n) |
| `src/test/schemas.test.js` | Test data: `biz_name: 'La Nona Pato'` |
| `src/test/useTheme.test.js` | `localStorage.setItem('lnp-theme', ...)` |
| `public/manifest.json` | `"name": "La Nona Pato"` |
| `public/sw.js` | 4 cache names: `lnp-static-v3`, `lnp-images-v3`, `lnp-api-v3`, `lnp-pages-v3` |
| `public/sw.js` | Push notification default title `"La Nona Pato"` |
| `public/offline.html` | `<title>Sin conexión — La Nona Pato</title>` |

**Decisión aplicada (FASE 2):** caches → `hermes-*-v1`, localStorage keys → `hermes-*`, `manifest.json` y `offline.html` se generan/inyectan por cliente como ya hace el `businessHtmlPlugin` de vite, observability usa `business.name` o `__CLIENT__`.

Además: `package.json:name` está como `"la-nona-pato"` → cambiar a `"hermes-gastro"`.

### 3.3 Código muerto

| Archivo | Por qué muerto |
|---|---|
| `src/components/catalog/VerificationScreen.jsx` | Sigue importado en Catalog.jsx pero el render condicional nunca dispara (eliminé el `setWaitingReceipt(true)` en el último fix) |
| `src/config/business.js` | Re-export deprecated con banner `⚠️ DEPRECATED`. Ningún import vivo (verificado con grep) |
| 7× `supabase_*.sql` en root | Migraciones legacy ya reemplazadas por `supabase/migrations/` |
| Estados `waitingReceipt`, `waitTimer` en `Catalog.jsx` | Líneas 66, 67, 212-216, 219-232, 522 — todo el bloque del timer post-pedido |
| Tests `describe('VerificationScreen')` en `components.test.jsx` (líneas 80-100) | Testean componente muerto |
| Test `describe('useTheme')` con `lnp-theme` | Va a fallar tras rename a `hermes-theme` |

### 3.4 Bug pendiente: Invalid Refresh Token

`AuthApiError: Invalid Refresh Token: Refresh Token Not Found` aparece en consola del usuario al refrescar el admin. Eso explica el "se cierra la sesión" reportado varios turnos atrás.

Causa: localStorage del cliente Supabase tiene un refresh token vencido o ya consumido (típicamente por refresh en otra pestaña). `supabase-js` no maneja esto gracefully — devuelve `session = null` sin limpiar el storage.

**Fix planeado (FASE 3):** en `lib/supabase.js`, agregar listener de `onAuthStateChange` que detecta `TOKEN_REFRESHED` con error y llama `supabase.auth.signOut({ scope: 'local' })` para limpiar storage roto. Resultado: el usuario va a login limpio en vez de quedar en zombie state.

### 3.5 Migraciones SQL fragmentadas

7 SQL files en root + 8 en `supabase/migrations/` + ~7 migraciones aplicadas vía MCP (sin archivo en repo). El "estado real" de la DB es la unión de los 3 sets.

**Decisión aplicada (FASE 4):** Dump del schema actual de Mala Miga (la más limpia) → `supabase/migrations/000_initial_schema.sql` único + `SCHEMA.md` documentando cada tabla. Las DBs existentes NO se tocan, solo dejamos esto como source of truth.

## 4. Tests — estado actual

| Archivo | Líneas | Riesgo de romperse en refactor |
|---|---|---|
| `schemas.test.js` | 399 | ALTO — tiene `status: 'prep'` |
| `components.test.jsx` | ~100 | ALTO — testea VerificationScreen muerto |
| `useTheme.test.js` | 43 | MEDIO — `lnp-theme` key |
| `services-orders.test.js` | 113 | MEDIO — puede usar status legacy |
| `useFinancials.test.js` | 172 | BAJO — usa `OrderStatus.X` (compatible) |
| Resto (14 archivos) | ~3500 | BAJO — services / utils / UI components |

**Nota técnica:** intenté correr `npm test` en el sandbox Linux y falló por bug conocido de npm + rolldown binding (`Cannot find module '@rolldown/binding-linux-x64-gnu'`). En tu Windows debería andar. Esto NO es un problema del repo, es del sandbox. Vos vas a poder verificar localmente cada PR.

## 5. Lo que NO se va a tocar

- `clients/<slug>/business.js` (es la fuente de verdad por cliente, está bien)
- `vite.config.js` (recientemente refactorizado, funcional)
- `App.jsx` / rutas (sin cambios necesarios)
- Edge functions (ya multi-tenant tras los últimos fixes)
- Hooks que ya quedaron limpios: `useTheme`, `useAdminData` (excepto el setOrders que ya se arregló), `useRealtimeInvalidation`

## 6. Próximos pasos (las 7 fases del plan)

Esta es la propuesta que aprobaste — la replico acá para tener todo en un solo documento:

1. ✅ **Fase 0** — Diagnóstico (este documento)
2. ⏭ **Fase 1** — Unificar status nombres (`OrderStatus.PREPARING` mayúscula)
3. ⏭ **Fase 2** — Limpieza identidad Hermes (SW caches, package.json, manifest, offline.html, observability)
4. ⏭ **Fase 3** — Borrar código muerto + fix Invalid Refresh Token
5. ⏭ **Fase 4** — Consolidar schema (`000_initial_schema.sql` + `SCHEMA.md`)
6. ⏭ **Fase 5** — Tests E2E con Playwright (corre contra Mala Miga)
7. ⏭ **Fase 6** — Pause/Resume Supabase LNP (vía MCP)
8. ⏭ **Fase 7** — Hermes Dashboard (app standalone con CRM export + crear cliente nuevo)
