# Seguridad — La Nona Pato

## Resumen de medidas implementadas (Fase 1)

### 1.1 — Secretos fuera del bundle

Los secretos (Twilio, webhooks) se mueven a Supabase Edge Functions.
El cliente solo usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (públicos por diseño).

**Edge Functions desplegadas:**
- `submit-order` — calcula precios server-side, valida cupones, rate limit 10/min
- `validate-coupon` — validación server-side de cupones, rate limit 20/min
- `admin-reset` — reset de datos con re-autenticación + audit log
- `notify-new-customer` — webhook interno para CRM (obsoleto, en revisión)

### 1.2 — Prevención de manipulación de precios

El cliente NO envía precios. Solo envía `{ recipeId, qty }`.
La Edge Function `submit-order` calcula precios usando:
- Precio base de la DB (`recipes.sale_price`)
- Descuentos del día (DAILY_DEALS por categoría, 15%)
- Cupones validados server-side

### 1.3 — Eliminación del PIN hardcodeado

El PIN "4477" fue eliminado completamente del código fuente.
El reset administrativo ahora requiere re-autenticación con contraseña
(`supabase.auth.signInWithPassword`) y genera un registro en `admin_audit_log`.

### 1.4 — Rate limiting

Implementado con tabla Postgres `rate_limits` + función RPC `check_rate_limit`.
Límites configurados:
- `submit-order`: 10 requests/minuto por IP
- `validate-coupon`: 20 requests/minuto por IP

Limpieza automática via `cleanup_rate_limits` (borra registros > 5 min).

### 1.5 — RLS endurecido

**Orders:**
- `orders_admin_all` — solo usuarios autenticados (admin)
- `orders_public_insert` — creación de pedidos (anónimo)
- `orders_user_read_own` — usuarios ven solo sus pedidos (`auth.uid() = user_id`)
- Sin lectura pública de pedidos existentes

**Customers:**
- `customers_admin_all` — solo autenticados
- Sin escritura pública (cerrada `Público actualiza clientes`)

**Order Items:**
- `order_items_admin_all` + `order_items_public_insert`
- Sin lectura pública directa

### 1.6 — Validación con Zod

Schemas en `src/lib/schemas/index.js` cubren todos los inputs:
- OrderInputSchema, RecipeInputSchema, IngredientInputSchema
- ExpenseInputSchema, SaleInputSchema, CouponCreateSchema
- SettingsInputSchema, AddressInputSchema, ProfileInputSchema
- PurchaseInputSchema, WasteInputSchema, NotifyWhatsAppSchema
- AdminResetSchema, ComboItemSchema

Integrados en `catalogService.js` y `adminService.js` via `validateInput()`.

### 1.7 — Enmascaramiento de PII

**Tracker público (`/seguimiento/:id`):**
- Solo accesible via UUID completo (no short codes)
- Usa `get_order_tracker` RPC (SECURITY DEFINER)
- Vista `order_tracker_view` solo expone:
  - Primer nombre (`split_part(customer, ' ', 1)`)
  - Estado, total, método de entrega/pago
  - Items del pedido (nombre producto + qty)
  - NO expone: teléfono, email, dirección, notas

**Vista enmascarada de clientes (`customer_masked_view`):**
- Nombre: solo primer nombre
- Teléfono: `***` + últimos 4 dígitos
- Email: primera letra + `***@dominio`

**RLS garantiza:**
- Anónimos NO pueden leer pedidos existentes
- Anónimos NO pueden leer/modificar clientes
- Usuarios autenticados solo ven sus propios pedidos
- Admin (authenticated) tiene acceso completo

## Variables de entorno

| Variable | Ubicación | Descripción |
|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | `.env.local` | URL pública del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | Clave anon (pública, controlada por RLS) |

## Migraciones aplicadas

1. `create_admin_audit_log` — tabla de auditoría + RLS
2. `create_rate_limits` — tabla + RPCs para rate limiting
3. `harden_rls_and_tracker_view` — vista tracker + RPC + cierre de policies
4. `fix_pii_leaks_harden_rls` — eliminación de fugas PII, vista enmascarada
