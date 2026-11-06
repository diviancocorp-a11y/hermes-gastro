# Cobro recurrente de la suscripcion (Mercado Pago)

Decisiones de Ricky del 6/nov/2026. Nada de esto esta construido todavia: es
el diseno acordado antes de escribir codigo.

## La via

**Una suscripcion de Mercado Pago por negocio, sin plan asociado**
(`POST /preapproval` con `status: pending`, `external_reference = tenant_id`).
MP devuelve un `init_point` y el duenio carga la tarjeta en la pagina de MP:
la tarjeta nunca pasa por Dico.

- Cobra la cuenta de MP **de Divianco** (`MP_ACCESS_TOKEN` propio, secret de
  Supabase). No se reusan `mp-connect`, `mp-preference` ni `mp-webhook`: esas
  son para que cada negocio le cobre a SUS clientes con SU token.
- Sin plan asociado porque el monto es por negocio (plan, ciclo, precios que
  cambian con la inflacion) y se ajusta con un `PUT` a esa suscripcion. Con
  planes de MP habria que mantener un plan en MP por combinacion.
- Checkout Pro mes a mes queda solo como respaldo manual (transferencia o
  efectivo), no como via principal.

## Decisiones

| Tema | Decision |
|---|---|
| Cuando se pide la tarjeta | **En el registro, obligatoria.** Como el negocio se crea al confirmar el email, la tarjeta se pide en la primera entrada despues de confirmar: el panel no abre hasta pasar por MP. |
| Primer debito | Al terminar la prueba: `start_date = prueba_hasta`. Nada se cobra en los 14 dias. |
| Promo | **Solo los 14 dias de Dante.** Se sacan de `plans` el mes gratis y los 3 meses al 50% (`meses_gratis`, `meses_descuento`, `descuento_pct` en 0), para que el cobro y la pagina de precios no se contradigan. |
| Anual | **12 meses por adelantado**: un debito de 12 x `precio_anual_por_mes`, frecuencia 12 meses; `paga_hasta` se corre un anio. |
| Paris | **Es un plan pago.** Si eligio Paris y no paga, se suspende (solo lectura y exportar) despues de la gracia de la 0052. |
| Dante o Magnus sin pago | Baja a Paris limitado (lo que hace hoy el fin de la prueba). |
| "No paga" significa | Debito rechazado o suscripcion cancelada en MP. Lo informa el webhook. |
| Corte del lado del servidor | **Si, junto con esto.** `create-payment-preference` mira el plan efectivo y rechaza si el plan no incluye cobro online. |

Los clientes con acuerdo propio (porcentaje de la ganancia: La Nona Pato,
MiaEstudio, Monare, Crazy Miga) quedan afuera del cobro automatico: entran por
`provision_owner` y no tienen `plan_id`.

## Piezas

1. **Migracion aditiva:** tabla `cobros_suscripcion` (`tenant_id`, id de pago
   de MP `unique` para que un webhook repetido no extienda dos veces, monto,
   estado, fecha; RLS con el patron de `tenant_id`) y `tenants.mp_preapproval_id`.
   Mas el update de promos de `plans` (dato, con el ok de Ricky).
2. **`suscripcion-crear`** (con sesion, solo el duenio): arma el monto desde
   `plans`, crea el preapproval y devuelve el `init_point`.
3. **`suscripcion-webhook`** (`verify_jwt=false`, valida `x-signature`):
   - `subscription_preapproval`: guarda el estado (autorizada, pausada, cancelada).
   - `subscription_authorized_payment` aprobado: corre `paga_hasta`, pone
     `status='active'`, limpia `suspendido_at`.
   - rechazado o cancelada: Dante/Magnus bajan a Paris; Paris queda para la
     suspension por fecha.
4. **Front** (pasa por `/diseno`): el paso 3 del registro deja de prometer
   "sin cobro ni suscripcion" y dice "$0 hoy, primer debito el dia 15"; la
   pantalla de tarjeta obligatoria en la primera entrada; Mi suscripcion.
5. **Corte en `create-payment-preference`** segun el plan efectivo.
6. **Al final**, con un par de ciclos reales, agendar `suspender_impagos` en
   pg_cron (paso 7 de `src/modules/suscripcion.js`).

## A verificar contra la doc vigente de MP antes de escribir

- Nombres exactos de los topics del webhook y el formato de `x-signature`.
- Si el preapproval acepta dinero en cuenta o solo tarjeta.
- Que pasa con `start_date` a 14 dias: si MP valida la tarjeta al suscribir
  (cobro y devolucion de prueba) o recien en el primer debito.
- Reintentos de MP ante un rechazo y cuando pasa la suscripcion a pausada.

## Lo que hace Ricky

- Credenciales de produccion de la cuenta MP de Divianco y usuarios de prueba
  para el sandbox.
- Cargar `MP_ACCESS_TOKEN` de Divianco y el secreto del webhook en Secrets de
  Supabase (nunca en el chat).
- Configurar la URL del webhook en "Tus integraciones" de MP (se le pasan los
  clics cuando llegue el paso).
