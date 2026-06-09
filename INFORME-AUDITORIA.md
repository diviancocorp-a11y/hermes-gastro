# Informe de Auditoria — hermes-gastro

**Fecha:** 9 junio 2026
**Alcance:** codigo completo (src, public, supabase, scripts, root), advisors Supabase (Mala Miga como referencia), Vercel, git.
**Metodo:** 3 auditorias paralelas (huerfanos/duplicados, hardcodeos/leaks, production-readiness) + verificacion de infra en vivo.

---

## 1. CRITICOS — bugs de datos en produccion

### 1.1 La direccion de delivery NUNCA llega a la DB
- `Catalog.jsx:496-521` arma `fullAddress` y lo manda en `orderData.address`.
- `OrderInputSchema` (schemas/index.js:56-72) **no declara `address`** → Zod strip lo descarta en silencio.
- `services/catalog.js:127-142` tampoco lo incluye en el body del invoke.
- `submit-order/index.ts:104` no escribe `delivery_address` (la columna existe y el CRM la lee).
- **Resultado: todo pedido con envio queda sin direccion.** Es la 5ta instancia del bug Zod-strip (#54, #56, #96...). El pre-commit `check-schema-sync` no lo atrapo porque solo cubre Settings/Recipes.

### 1.2 `delivery_cost` no se envia ni se guarda
- El cliente ve y acepta total con envio (`ctWithDelivery`, Catalog.jsx:405-412) pero el server calcula `finalTotal = items - descuento + propina` sin envio (submit-order:102).
- El total del admin difiere del que el cliente acepto. Cobro inconsistente.

### 1.3 Cupones: quema sin rollback + race condition
- `used=true` se setea ANTES de insertar items (submit-order:106); si el insert falla, el pedido se compensa pero el cupon queda quemado.
- Validacion read-then-write no atomica: dos pedidos simultaneos pueden usar el mismo cupon.
- Sin idempotency key: retry tras timeout = pedido duplicado.

---

## 2. CRITICOS — seguridad

| # | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| 2.1 | **Sin roles: cualquier usuario autenticado es admin total** | RLS `auth.role()='authenticated'` (000_initial_schema.sql:446-452); el catalogo crea usuarios auth via magic link (AuthContext.jsx:110) | Un cliente registrado podria operar /admin: finanzas, settings, borrar datos. Bloqueante para vender |
| 2.2 | **`adjust_stock` ejecutable por `anon`** (advisor Supabase, los 3 proyectos) | RPC SECURITY DEFINER expuesto en /rest/v1/rpc/adjust_stock | Cualquiera con la anon key (publica en el bundle) puede vaciar o inflar stock |
| 2.3 | **`send-push` sin autenticacion** | send-push/index.ts:20-46 | Cualquiera puede mandar push broadcast a toda la base (spam/phishing) |
| 2.4 | **`push_subscriptions`: anon puede UPDATE/DELETE todo** | Policies `push_subs_update/delete` USING(true) para anon | Borrar/secuestrar todas las suscripciones push |
| 2.5 | `mp-webhook` no valida firma `x-signature` de MercadoPago | mp-webhook/index.ts | Riesgo bajo (re-consulta API de MP) pero abierto |
| 2.6 | `scheduled-export` invocable con anon key | sin check de auth | Dispara emails con datos de ventas |
| 2.7 | `user_id` aceptado del body sin verificar JWT en submit-order | submit-order:65 | Pedidos spoofeados a nombre de otro usuario |
| 2.8 | Leaked password protection deshabilitado | Advisor auth | Config de 1 click en dashboard |

**Secrets: 0 hallazgos.** Higiene de .env correcta (solo .env.example trackeado).

---

## 3. ALTOS — multi-tenant roto / hardcodeos

| # | Hallazgo | Evidencia |
|---|---|---|
| 3.1 | `scheduled-export` manda reportes con marca "La Nona Pato" a los 3 tenants (titulo + from de email) | scheduled-export/index.ts:85,105 |
| 3.2 | Footer del catalogo con WhatsApp falso `5491100000000` y email placeholder de Hermes — el boton "Hablar por WhatsApp" abre un numero inexistente en prod de los 3 tenants | CatalogFooter.jsx:14-16,270 |
| 3.3 | Costos de envio hardcodeados e iguales para los 3 tenants (`baseCost:500, perKmCost:200, maxDistanceKm:15`) | src/config/delivery.js:36-40 |
| 3.4 | **AFIP invoice es un stub**: `getAuthToken` devuelve `PLACEHOLDER_TOKEN`/`PLACEHOLDER_SIGN` — la facturacion no funciona; si esta deployada falla en silencio | afip-invoice/index.ts:205,213 |
| 3.5 | Fallback `biz_name:'La Nona Pato'` en get-catalog cuando settings esta vacio | get-catalog/index.ts:41-43 |
| 3.6 | `robots.txt` apunta al sitemap de LNP (que ademas no existe) y se sirve igual en los 3 tenants | public/robots.txt:3 |
| 3.7 | `create-client.mjs` **muta archivos compartidos** (featureFlags DEFAULTS, sw.js, manifest, index.html, reescribe migraciones): crear cliente B pisa config del cliente A. Ademas instruye deployar edge functions que ya no existen | scripts/create-client.mjs:234-294,319 |
| 3.8 | Dependencia fantasma `"@hermes/core": "file:../Hermes/packages/core"` — `npm install` falla en cualquier maquina/CI sin ese repo hermano (vite la aliasea a src/, no se usa) | package.json + vite.config.js:91 |
| 3.9 | Descuento default 10% hardcodeado en cupones | services/coupons.js:22 |
| 3.10 | Colores LNP sin `var()` (bug de tema): SkipToContent.jsx:16, ProductDetailScreen.jsx:72,87 | + ~20 fallbacks `var(--ac, #C45D3E)` tolerables |

---

## 4. Codigo muerto, huerfanos y duplicados

### 4.1 Archivos huerfanos (cero imports) — 23 archivos, confianza alta
`src/catalog-pro/`: BottomNavBar.jsx
`src/components/`: ConfirmSlideDialog.jsx
`src/components/admin/shared/`: cards/ChartCard.jsx, cards/HourlyBars.jsx*, cards/StatusGrid.jsx, cards/TopProductsList.jsx*, forms/Chips.jsx, forms/Fab.jsx, forms/SearchBar.jsx, orders/FilterTabs.jsx, orders/Kanban.jsx, orders/TimeChip.jsx
`src/components/catalog/`: CatalogSearch.jsx, CatalogSkeleton.jsx, EmptyState.jsx, FoodIllustration.jsx, OfferCarousel.jsx
`src/components/ui/`: PaymentMethodsEditor.jsx, Skeleton.jsx, StarRating.jsx
`src/`: services/index.js, types/index.ts, config/business.js (tombstone)
(*HourlyBars/TopProductsList: el dashboard usa versiones propias; verificar antes de borrar)

### 4.2 Muertos en prod pero referenciados por tests (cobertura falsa) — 5
useCart.js, useStoreStatus.js, catalog/ProductCard.jsx, catalog/PushBanner.jsx, ui/index.js — con sus tests: hooks.test.js, components.test.jsx (parcial), push.test.jsx, ui-components.test.jsx.

### 4.3 Root sucio
- 7 stubs SQL tombstone (`supabase_*.sql`) + `src/config/business.js`: vaciados en FASE 3 pero **nunca se hizo el `git rm`**.
- `playwright.config.js` stale (el vivo es el `.ts`).
- `coverage/.tmp/*.json` trackeado en git; falta `coverage/` en .gitignore.
- 4 `.docx` de negocio en un **repo publico** (Resumen_Socios, Reporte_Pre_Lanzamiento, SAAS_ROADMAP, auditoria_ingenieria) — decision tuya, pero cualquiera los puede bajar.
- `api/whatsapp.js`: Vercel lo deploya como serverless function por convencion `/api/*` pero nada lo referencia — verificar y borrar.

### 4.4 Duplicados sistemicos
- **Formateo de moneda x4**: `fmtAR` (catalog-pro/format.js), `formatMoney` (lib/utils.jsx), `fmt` local (monthReport.jsx), inline `toLocaleString('es-AR')` en 5 archivos mas.
- Skeleton x3, EmptyState x3, ConfirmSlideDialog vs ConfirmSlideProvider, PaymentMethodsEditor vs PaymentAccountsEditor.
- Triple barrel de services: adminService.js (shim, ~15 consumidores), catalogService.js (shim), services/index.js (muerto).
- Doble sistema de tokens CSS: `--ac` (vivo) vs `--ag-c-terra` (legacy en components/catalog).

### 4.5 Exports muertos
~45 exports nunca importados en services/lib/hooks (lista completa en el reporte del agente; destacados: modulo `referrals.js` casi entero, `theme.js` 5 funcs, `useQueryHooks` 5 hooks).

### 4.6 Deps removibles
`use-sync-external-store` (React 19 lo trae) y `@hermes/core` (ver 3.8).

---

## 5. Advisors Supabase no documentados (nuevos desde mayo)

Ademas de los 19 "intencionales" documentados en PLAN-LIMPIEZA, aparecieron:
- `_weekly_customer_aggregate` view SECURITY DEFINER (ERROR)
- 3 funciones con search_path mutable: `_current_week_start`, `_display_name`, `recipes_trim_category_fn` (la migracion `harden_function_search_paths` no cubrio las nuevas)
- Materialized view `recipe_sale_counts` expuesta a anon en la Data API
- Policies permisivas nuevas: `delivery_channels`, `payment_integrations`, `suppliers` (USING true para authenticated — consistente con el modelo "todo authenticated es admin", ver 2.1)

---

## 6. Lo que esta BIEN (verificado)

- ErrorBoundary global + window.onerror + unhandledrejection → Sentry.
- Fix "Invalid Refresh Token" implementado tal como se planeo (supabase.js:28-54).
- Logout admin, toasts de error en admin, validacion Zod centralizada, advertencia stock bajo, realtime + alarma sonora, historial de compras, graficos basicos, export CSV/PDF, upload a Storage, modo oscuro, push end-to-end, WhatsApp manual via wa.me.
- PWA por tenant: manifest generado en build, sw.js generico, offline.html, favicon por tenant en build y runtime.
- submit-order: precios server-side, rate limit por IP, limites de qty, anti-spoof de cuenta de pago.
- Terminos y condiciones + link Defensa del Consumidor en footer.
- git: main sincronizado con origin. Vercel: 3 proyectos activos.
- Pre-commit hooks funcionando (integridad, schema-sync parcial, columnas, eslint, build).

## 7. Brechas para "vendible" (features, no bugs)

- "Sin stock" no se muestra en el catalogo publico (grep negativo en catalog-pro y get-catalog).
- Sin ruta 404 catch-all (`path="*"`) — URL invalida = pantalla en blanco.
- Sin politica de privacidad (almacenas telefono+email+direccion → aplica Ley 25.326 AR).
- Sin buscador de pedidos por cliente/telefono en admin.
- Sentry sin sourcemaps (`@sentry/vite-plugin` ausente) → stack traces minified.
- Onboarding de cliente nuevo: 1-2 hs manuales con margen de error alto (ver 3.7).
- Iconos PWA inconsistentes: solo cochi tiene set completo.

---

**Plan de accion priorizado: [PLAN-DE-ACCION.md](./PLAN-DE-ACCION.md)**
