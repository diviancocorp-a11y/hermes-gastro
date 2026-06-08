# TASKS — hermes-gastro

> Estado efimero y pendientes. El contexto estable vive en CLAUDE.md.
> Ultima actualizacion: 2026-06-08

---

## En curso

- [ ] **Cuentas de pago configurables — FASE 2 (checkout + edge function + display)**
  - Fase 1 LISTA (ver Hecho). Falta:
  - [ ] `CheckoutScreen.jsx` + `Catalog.jsx`: derivar opciones de pago desde `settings.payment_accounts` activas + efectivo. Reemplazar CBU `0000003100000535412820` y alias `pato.jhs` hardcodeados por los de la cuenta elegida. Si hay varias del mismo tipo, sub-selector.
  - [ ] Pasar `payment_account_id` a `submitOrder`.
  - [ ] Edge function `submit-order` (Deno): recibir `payment_account_id`, buscar la cuenta en settings server-side, escribir `payment_account_id` + `payment_account_snapshot`. Redeploy en los 3 tenants.
  - [ ] Relajar enum `payment` en `OrderInputSchema` (hoy `efectivo|transferencia|mercadopago`) para aceptar tarjeta/custom.
  - [ ] Display: `OrderSentView` (cliente) y `Orders` (admin) muestran de que cuenta fue.
  - [ ] Que el catalogo oculte un tipo si no hay cuenta activa (transferencia/MP desaparecen hasta cargar cuenta).

## Pendientes (heredados de CLAUDE.md)

- [ ] **Sentry sourcemaps + Seer** — configurar `@sentry/vite-plugin`. Sin eso Seer ve codigo minified.
- [ ] **Refactor `check-schema-sync.mjs`** — hoy usa manifest manual (3er duplicado). Que lea directo `supabase-schema.json`. ~30 min.
- [ ] **Pre-commit UTF-8 strict** — `safe-edit.mjs` ya valida al escribir, pero el pre-commit deberia chequear todo archivo staged con decode('utf-8','strict').
- [ ] **No existe `npm run schema:sync`** — el CLAUDE.md lo menciona pero no esta. Hoy el snapshot se edita a mano. Crear el script o documentar el proceso real.

## Deploy / git

- [ ] **`git push` pendiente** (incluye propina custom + safe-edit + Fase 1 cuentas de pago).
  - OJO: las migraciones DB ya se aplicaron en los 3 tenants (no van por git).

---

## Hecho

- [x] **Propina: monto custom en $** (sobre tope 20%) en checkout. `Catalog.jsx` + `CheckoutScreen.jsx`.
- [x] **`scripts/safe-edit.mjs`** — editor atomico (UTF-8 strict + 1 write) para archivos fragiles. Ya evito 3 corrupciones en esta sesion.
- [x] **Cuentas de pago — FASE 1:**
  - DB: `settings.payment_accounts` (jsonb), `orders.payment_account_id` (text), `orders.payment_account_snapshot` (jsonb). Aplicado en los 3 tenants.
  - Seed la-nona-pato con sus valores actuales (CBU + alias `pato.jhs`). cochi y mala-miga arrancan solo con efectivo.
  - Zod `PaymentAccountSchema` + `payment_accounts` en `SettingsInputSchema` (looseObject, no se strip-ea).
  - Manifest + `supabase-schema.json` actualizados. check-schema-sync + check-supabase-columns OK.
  - Admin: `PaymentAccountsEditor.jsx` (CRUD con titular/alias/CBU/banco/instrucciones) en Configuracion → Medios de pago. `PaymentMethodsEditor` viejo queda como "uso interno" (Gastos/Compras).
