# TASKS — hermes-gastro

> Estado efimero y pendientes. El contexto estable vive en CLAUDE.md.
> Ultima actualizacion: 2026-06-08

---

## Proximo (con mas contexto del user)

- [ ] **Cuentas de pago = medios de Gastos/Compras (unificar)**
  - Hoy Gastos/Compras todavia leen `settings.payment_methods` (string array). Falta que consuman `settings.payment_accounts`.
  - Cuando se haga, se puede borrar `payment_methods` del schema/manifest.
- [ ] **Movimientos internos + cuentas "solo pagan"**
  - Cuenta que NO recibe plata pero SI paga; registrar movimiento interno para pagar algo con esa cuenta.
  - El user va a dar mas contexto antes de implementarlo.

## Pendientes (heredados de CLAUDE.md)

- [ ] **Sentry sourcemaps + Seer** — configurar `@sentry/vite-plugin`.
- [ ] **Refactor `check-schema-sync.mjs`** — que lea directo `supabase-schema.json` (sacar el manifest manual).
- [ ] **Pre-commit UTF-8 strict** — chequear todo archivo staged con decode('utf-8','strict').
- [ ] **No existe `npm run schema:sync`** — crear el script o documentar el proceso real.

## Deploy / git

- [ ] **`git push` pendiente** (propina + safe-edit + Fase 1 + Fase 2 + correcciones).
  - YA estan live (no van por git): migraciones DB (3 tenants) + edge function submit-order (v13/v8/v10 en LNP/cochi/mala-miga).

## Verificar despues del deploy

- [ ] Cargar una cuenta en cochi/mala-miga y confirmar que aparece en el checkout (titulo = banco).
- [ ] Pedido de prueba con cuenta: el boton "Confirmar pedido" debe estar bloqueado hasta subir comprobante. Confirmar que la orden guarda `payment_account_snapshot`.

---

## Hecho

- [x] **Propina: monto custom en $** (sobre tope 20%).
- [x] **`scripts/safe-edit.mjs`** — editor atomico (UTF-8 strict + 1 write + auto-limpieza de NUL bytes). Atajo ~6 corrupciones del mount esta sesion.
- [x] **Cuentas de pago — FASE 1** (DB + Zod + admin editor).
- [x] **Cuentas de pago — FASE 2** (checkout dinamico + edge function snapshot + display).
- [x] **Cuentas de pago — CORRECCIONES (esta ronda):**
  - Una sola fuente de verdad: saque el editor "uso interno" (PaymentMethodsEditor) de Configuracion.
  - Sin `type`: el campo `banco` es el nombre VISIBLE (lo ve el cliente); `label` es el nombre INTERNO (diferencia cuentas del mismo banco). Sin `instrucciones`, sin `show_in_catalog`.
  - DB LNP migrada al modelo nuevo. Zod actualizado.
  - Checkout: cards por banco, sin tipos. PayBankBox slim (datos a copiar). Comprobante movido al RESUMEN como paso que desbloquea "Confirmar pedido". Efectivo y pasarela MP no piden comprobante.
  - Edge function: `payment`='transferencia' (bucket) para cuentas; snapshot {id,label,banco,titular,alias,cbu}. Redeploy en los 3 tenants.
