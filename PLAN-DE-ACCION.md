# Plan de Accion — hermes-gastro

**Base:** [INFORME-AUDITORIA.md](./INFORME-AUDITORIA.md) (9 jun 2026)
**Regla de oro:** cada sprint termina con build OK en los 3 tenants + tests verdes + E2E contra mala-miga. Nada se mergea sin eso.

---

## Sprint 0 — HOY: los pedidos con envio estan rotos (~3 hs)

> Hay plata en juego. Esto va antes que todo.

| # | Tarea | Archivos | Ref |
|---|---|---|---|
| 0.1 | Agregar `address` a `OrderInputSchema`, al body del invoke y al INSERT de submit-order (`delivery_address`) | schemas/index.js, services/catalog.js, submit-order/index.ts | 1.1 |
| 0.2 | Enviar y persistir `delivery_cost`; el server lo valida recalculando (no confia en el cliente) y lo suma a `finalTotal` | mismos + config/delivery.js | 1.2 |
| 0.3 | **Mejora de proceso:** ampliar `check-schema-sync.mjs` para cubrir `OrderInputSchema` (y todo schema de flujo publico). Este bug era exactamente lo que el hook existia para atrapar | scripts/ | 1.1 |
| 0.4 | Test E2E: pedido con envio → verificar `delivery_address` y `delivery_cost` en DB | e2e/order-flow.spec.ts | — |

## Sprint 1 — Seguridad bloqueante para vender (~1-2 dias)

| # | Tarea | Ref |
|---|---|---|
| 1.1 | **Roles admin**: tabla `admin_users` (o claim en JWT) + reescribir policies `auth.role()='authenticated'` → `is_admin()`. Migracion en los 3 tenants. Verificar YA si los signups publicos crean usuarios que hoy entran a /admin | 2.1 |
| 1.2 | `REVOKE EXECUTE` de `adjust_stock` para anon (y auditar el resto de los RPC: cuales realmente necesita anon) | 2.2 |
| 1.3 | `send-push`: exigir JWT de admin o secret compartido | 2.3 |
| 1.4 | `push_subscriptions`: policies por endpoint propio (no USING true) | 2.4 |
| 1.5 | Cupones atomicos: mover quema de cupon + insert de order + items a un RPC transaccional, o al menos quemar el cupon DESPUES de los items. Agregar idempotency key al submit | 1.3 |
| 1.6 | `submit-order`: si viene JWT, derivar `user_id` del token, no del body | 2.7 |
| 1.7 | Validar firma `x-signature` en mp-webhook; auth en scheduled-export | 2.5/2.6 |
| 1.8 | Dashboard: habilitar leaked password protection (3 proyectos, 1 click) | 2.8 |
| 1.9 | Re-aplicar `harden_function_search_paths` a las 3 funciones nuevas + decidir sobre `recipe_sale_counts` expuesta | 5 |

## Sprint 2 — Multi-tenant correcto (~1 dia)

| # | Tarea | Ref |
|---|---|---|
| 2.1 | `scheduled-export`: leer `biz_name` de settings para titulo y from | 3.1 |
| 2.2 | CatalogFooter: datos reales de Hermes o sacar el boton WhatsApp hasta tenerlos | 3.2 |
| 2.3 | Mover pricing de delivery a `settings` (cols `delivery_base_cost`, `delivery_per_km`, `delivery_max_km`) — seguir el proceso de 4 pasos de CLAUDE.md (ALTER en 3 tenants + Zod + manifest + schema:sync) | 3.3 |
| 2.4 | Decidir AFIP: implementar WSAA real o quitar la function deployada (hoy falla en silencio) | 3.4 |
| 2.5 | Fallback generico en get-catalog ("Mi Negocio"), robots.txt generado por tenant en build (como manifest) | 3.5/3.6 |
| 2.6 | `discount_pct` de cupones a settings | 3.9 |
| 2.7 | Fix colores sin var() en SkipToContent y ProductDetailScreen | 3.10 |

## Sprint 3 — Limpieza (~medio dia, mecanico)

| # | Tarea | Ref |
|---|---|---|
| 3.1 | `git rm`: 7 stubs SQL + config/business.js + playwright.config.js + coverage/ (+ `coverage/` a .gitignore) | 4.3 |
| 3.2 | Mover los 4 .docx fuera del repo publico (o a un repo privado) | 4.3 |
| 3.3 | Borrar 23 huerfanos + 5 dead-prod con sus tests (verificar HourlyBars/TopProductsList antes) | 4.1/4.2 |
| 3.4 | Remover deps `use-sync-external-store` y `@hermes/core` (dejar solo el alias de vite) → `npm install` portable, desbloquea CI | 4.6/3.8 |
| 3.5 | Unificar formateo de moneda en un solo `formatMoney` (lib compartida catalogo+admin) | 4.4 |
| 3.6 | Verificar y borrar `api/whatsapp.js` si nada lo llama | 4.3 |
| 3.7 | Podar los ~45 exports muertos (o marcar los que son features a futuro: referrals, theme builder) | 4.5 |

## Sprint 4 — Vendible al publico (~2-3 dias)

| # | Tarea | Ref |
|---|---|---|
| 4.1 | **Refactor create-client.mjs**: que NO mute archivos compartidos ni migraciones; todo por tenant via clients/<slug>/ + settings. Actualizar lista de edge functions a las reales | 3.7 |
| 4.2 | Runbook de onboarding: checklist exacto Supabase→schema→functions→secrets→Vercel→dominio→admin user. Meta: cliente nuevo en <30 min sin errores | 3.7 |
| 4.3 | "Sin stock" en catalogo publico (get-catalog calcula disponibilidad, UI lo muestra y bloquea add-to-cart) | 7 |
| 4.4 | Ruta 404 catch-all en App.jsx | 7 |
| 4.5 | Politica de privacidad (Ley 25.326 AR) como modal/info page por tenant | 7 |
| 4.6 | Buscador de pedidos por cliente/telefono en Orders.jsx | 7 |
| 4.7 | Sentry sourcemaps (`@sentry/vite-plugin`) + activar Seer — tarea pendiente #1 de CLAUDE.md | 7 |
| 4.8 | Mensajes de error utiles en checkout: propagar el mensaje del server (429, producto no disponible) en vez del generico | 1 |
| 4.9 | Set completo de iconos PWA para LNP y mala-miga | 7 |
| 4.10 | **Script `deploy-functions.mjs`**: deploya supabase/functions/ identico a los 3 tenants (una sola fuente de verdad, evita drift tipo verify_jwt). Detectado en Sprint 0: LNP tenia el fix de create-payment-preference y Cochi/MM no | S0 |

## Sprint 5 — Escala (cuando haya cliente #4 en puerta)

- Hermes Dashboard (Fase 7 del DIAGNOSTICO): alta de clientes self-service.
- Refactor check-schema-sync para leer directo de supabase-schema.json (pendiente #2 CLAUDE.md).
- Pre-commit UTF-8 strict (pendiente #3 CLAUDE.md).
- WhatsApp automatico al completar pedido.
- Roles finos (dueno vs empleado) sobre la base del 1.1.
- Consolidar shims adminService/catalogService → imports directos a services/.

---

## Orden sugerido de ejecucion

```
HOY:        Sprint 0 completo (3 hs) → deploy a los 3 tenants
Esta semana: Sprint 1 (seguridad) → Sprint 2 (multi-tenant)
Proxima:    Sprint 3 (limpieza) + Sprint 4 (vendible)
```

**Criterio de "100% vendible":** Sprints 0-4 completos = checkout integro, sin agujeros de seguridad conocidos, sin marca de un tenant filtrada a otro, onboarding <30 min documentado, legal basico cubierto.
