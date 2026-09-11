# Performance Audit — Hermes Gastro

Auditoría estática del bundle y renderizado del catálogo público. Actualizada: mayo 2026.

---

## 🟢 Lo que ya está optimizado

| Item | Detalle |
|---|---|
| **Code splitting** | `Admin`, `OrderTracker`, `MyAccount`, `Analytics` cargan vía `lazy()`. El bundle inicial solo trae `Catalog`. |
| **Vendor chunks** | `supabase`, `@tanstack/react-query`, `i18next`, `react-dom/react-router` en chunks separados → mejor cache HTTP |
| **Deps lean** | Solo 10 dependencies de producción. Ninguna pesada (no lottie / chart.js / three / lodash / moment) |
| **Service Worker** | Workbox con CacheFirst para assets, NetworkFirst para HTML, StaleWhileRevalidate para imágenes |
| **OptimizedImage** | Componente custom con `srcSet`, `width`/`height`, `quality` parametrizable |
| **Images lazy** | Todos los `<img>` de Settings/Orders/Admin tienen `loading="lazy"` y `decoding="async"` |

---

## 🟡 Mejoras pendientes (priorizadas)

### P1 — Partir Catalog.jsx (1376 líneas)

`src/pages/Catalog.jsx` es **el componente más grande del repo**. Concentra:
- Renderizado del catálogo de productos
- Modal del carrito
- Stepper de checkout (4 pasos)
- Lógica de cupones, pagos, scheduling, upselling

**Beneficio esperado:**
- Bundle inicial más chico (lazy-load del checkout)
- Mantenibilidad: cada subcomponente testeable por separado
- Re-renders más localizados

**Plan sugerido:**
1. Extraer `<Checkout />` (stepper completo) a `src/components/catalog/Checkout.jsx` y cargarlo con `lazy()`
2. Extraer `<CartModal />` a su propio archivo
3. Mantener `Catalog.jsx` solo con la grilla de productos + FAB

**Riesgo:** alto si no hay tests de checkout. Requiere E2E robusto antes.

### P2 — Refactor de `react-hooks/set-state-in-effect` (3 warnings)

Patrones en `Catalog.jsx:128, 205, 255` donde un `useEffect` llama `setState` sincrónicamente. La regla nueva de eslint-plugin-react-hooks v7 los flaggea como cascading renders.

**Beneficio:** menos renders, mejor TTI.

**Riesgo:** medio. Los effects sincronizan estado con `user`/`profile`/`sessionStorage`. Reescribir como event handlers requiere mover lógica a callbacks o derivar el estado.

### P3 — Preload de fonts críticas

Las fonts custom (`DM Serif Display`, `DM Sans` por default) cargan via `<link>` runtime después del primer paint. Eso causa FOIT/FOUT visible.

**Fix:** agregar `<link rel="preload" as="font">` al `index.html` template, con `fetchpriority="high"` para las dos primaries.

### P4 — Server-side timing del SSR (futuro)

Hoy todo es CSR. Vercel soporta SSR con frameworks como Next.js. Si en algún momento migramos, hay un boost grande en LCP del catálogo.

---

## Quick wins aplicados (commit chore: performance audit)

- `vite.config.js`: chunks adicionales `query`, `i18n` → cache HTTP más granular
- `Orders.jsx`, `Settings.jsx`, `Admin.jsx`: `loading="lazy"` + `decoding="async"` en 4 `<img>` que faltaban
