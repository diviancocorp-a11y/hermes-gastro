# Integración MercadoPago Checkout Pro

Setup operativo para conectar MercadoPago como pasarela de pago en Hermes Gastro.

## Arquitectura

```
Cliente (Catalog)                Admin (Settings → Pasarelas)
       │                                 │
       │ paga                            │ "Conectar MP"
       ▼                                 ▼
[create-payment-preference]      [auth.mercadopago.com.ar/authorization]
       │                                 │
       │ POST checkout/preferences       │ ?code=XXX → /mp-callback
       ▼                                 ▼
   MP Checkout                    [mp-oauth-callback]
       │                                 │
       │ user paga                       │ guarda access_token en
       │                                 │ payment_integrations
       │ webhook POST                    │
       ▼                                 │
   [mp-webhook]                          │
       │                                 │
       │ update orders                   │
       ▼                                 │
   back_urls → /pago/{exitoso|fallido|pendiente}?orderId=...
```

3 edge functions, 1 tabla (`payment_integrations`), nuevas columnas en `orders` (`payment_provider`, `payment_external_id`, `payment_status`, `payment_preference_id`, `paid_at`).

## Setup (por cada negocio)

### 1. Crear app en MP

Ir a https://www.mercadopago.com.ar/developers/panel/app → **Crear aplicación**.

- Nombre: ej. `Hermes Gastro — La Nona Pato`
- Producto: **Checkout Pro**
- Modelo de integración: **Plataforma de terceros** (importante — habilita OAuth con `platform_id=mp`)
- Soluciones: Pagos online

En el detalle de la app, anotar:
- **Client ID** (Application ID)
- **Client Secret**

### 2. Configurar Redirect URIs

En el detalle de la app → **Credenciales** → agregar Redirect URIs:

```
https://<dominio-prod>/mp-callback
http://localhost:5173/mp-callback   (para test local)
```

### 3. Configurar webhook (IPN)

En la app → **Webhooks** → agregar URL:

```
https://<project-ref>.supabase.co/functions/v1/mp-webhook
```

Eventos a suscribir: `payment` (al menos `payment.created`, `payment.updated`).

### 4. Setear secrets en Supabase

Por cada proyecto (LNP, Cochi, Mala Miga), setear en Supabase → Project Settings → Edge Functions → Secrets:

```
MP_CLIENT_ID=<Client ID de la app MP>
MP_CLIENT_SECRET=<Client Secret de la app MP>
APP_URL=https://<dominio-prod-de-este-cliente>
```

> ⚠️ **Nunca commitear estos secrets.** Solo viven en Supabase Edge Functions env.

### 5. Variable cliente

En el `.env` del frontend de cada negocio:

```
VITE_MP_CLIENT_ID=<Client ID — el mismo que en el backend>
```

> Es el **mismo Client ID** que en MP. El secret NO va en frontend.

### 6. Conectar desde el admin

1. Admin entra a **Configuración → Finanzas → Pasarelas de pago**
2. Click "Conectar MercadoPago"
3. Lo redirige a MP, autoriza con su cuenta de MP del negocio
4. MP lo redirige de vuelta a `/mp-callback?code=...`
5. La página `MpCallback` llama a la edge function `mp-oauth-callback`
6. Se persiste `access_token` + `refresh_token` en `payment_integrations`
7. Vuelve a Settings → Pasarelas con badge "✓ CONECTADA"

A partir de ahí, los clientes que elijan MP en el checkout van directo al Checkout Pro de MP. Los pagos llegan a la cuenta MP del negocio.

## Flow runtime

### Cliente paga con MP (con MP conectado)

1. Cliente arma carrito, elige `payment: mercadopago`
2. `submitOrder` crea la order
3. `Catalog.jsx` detecta `mpConnected === true` → llama `createMpPreference(orderId)`
4. Edge function `create-payment-preference`:
   - Lee `orders` + `payment_integrations` activo
   - POST `https://api.mercadopago.com/checkout/preferences` con items + `back_urls` + `notification_url`
   - Persiste `preference_id` en `orders`
5. Frontend redirige a `init_point` → cliente paga en MP
6. MP notifica via webhook a `mp-webhook`:
   - GET `https://api.mercadopago.com/v1/payments/{id}`
   - Update `orders.payment_status`, `payment_external_id`, `paid_at`
7. MP redirige al cliente a `/pago/exitoso?orderId=...`

### Fallback (sin MP conectado)

Si el admin no conectó MP, el flow viejo se mantiene: alias + comprobante manual. El catálogo detecta `!mpConnected` y muestra la UI de alias + upload.

## Tablas

### `payment_integrations`

| Columna            | Tipo         | Comentario                                                |
|--------------------|--------------|------------------------------------------------------------|
| id                 | uuid PK      |                                                            |
| provider           | text         | `mercadopago` (futuro: `modo`, `stripe`)                   |
| access_token       | text         | **NUNCA exponer al frontend.** Solo edge functions.        |
| refresh_token      | text         | Para renovar el access_token                               |
| external_user_id   | text         | MP user_id del comerciante                                 |
| scopes             | text[]       | OAuth scopes                                               |
| public_key         | text         | Pública — OK exponer (no se usa para Checkout Pro)         |
| expires_at         | timestamptz  | Vencimiento del access_token                               |
| is_active          | boolean      | Soft-delete                                                |
| metadata           | jsonb        | live_mode, etc                                             |
| connected_at       | timestamptz  |                                                            |

**RLS**: solo `authenticated` (admin) lee/escribe. Edge functions usan `SERVICE_ROLE_KEY` para bypass.

### `orders` (columnas nuevas)

- `payment_provider` — `'mercadopago'` cuando aplica
- `payment_external_id` — MP `payment.id`
- `payment_status` — `pending` / `approved` / `rejected` / `in_process` / `refunded`
- `payment_preference_id` — MP `preference.id` (idempotencia)
- `paid_at` — timestamp del pago aprobado

## Edge Functions

Los 3 deployados en LNP, Cochi y Mala Miga:

1. `mp-oauth-callback` — recibe `code`, lo cambia por tokens, persiste en `payment_integrations`
2. `create-payment-preference` — recibe `orderId`, crea preference en MP, devuelve `init_point`
3. `mp-webhook` — IPN handler, actualiza `orders.payment_status` (idempotente)

> El webhook tiene `verify_jwt=false` (MP no envía JWT). Validación de origen: chequear `req.headers` o whitelist por IP en una iteración futura si hace falta endurecer.

## Test rápido

1. Conectar MP en Settings con cuenta de TEST de MP (mode sandbox).
2. Hacer un pedido en catalog con `payment=mercadopago`.
3. En `init_point` (URL prod) usar **usuario de prueba comprador** que crea el panel de developer.
4. Tarjetas de prueba: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/test-cards
5. Verificar que `orders.payment_status` pasa a `approved` después del webhook.

## Troubleshooting

- **"MP credentials not configured" en oauth callback** → faltan `MP_CLIENT_ID` o `MP_CLIENT_SECRET` en secrets de Supabase
- **"MercadoPago no configurado" al crear preference** → el admin no conectó MP todavía
- **No vuelve el webhook** → revisar `Webhooks` en MP panel, ver entregas. URL en MP debe ser exactamente la del proyecto Supabase con `/functions/v1/mp-webhook`
- **`auto_return: 'approved'` falla** → `back_urls.success` debe ser HTTPS público (no localhost). Para dev local, comentar el `auto_return`
- **Token expira** → MP da `refresh_token` con 6 meses. Implementar refresh con cron job antes de `expires_at` (TODO)

## Pendiente

- [ ] Refresh automático del `access_token` antes de `expires_at`
- [ ] Soporte multi-cuenta MP (hoy: 1 sola integración activa por provider — suficiente para MVP)
- [ ] Modo: soporte para integración con Modo (similar a MP pero diferente OAuth)
- [ ] Endurecer webhook: validar firma `x-signature` que MP empezó a enviar
