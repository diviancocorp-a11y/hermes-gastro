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
| Cuando se pide la tarjeta | **En el paso 3 del registro (Confirmacion), obligatoria**, despues de la cuenta (paso 1) y los datos del negocio (paso 2). Sin tarjeta no se crea la cuenta. |
| Como se resguarda | **La guarda Mercado Pago, no Dico.** El numero se tokeniza en el navegador con el Card Payment Brick (public key de Divianco) y con ese token se crea la suscripcion. Dico guarda solo el `preapproval_id`, la marca y los ultimos 4 digitos para mostrarlos. Guardar el numero nos meteria en PCI. |
| Primer debito | Queda pendiente hasta el fin de la prueba: la suscripcion se crea `authorized` con `start_date` = fin de la prueba. Nada se cobra en los 14 dias. |
| Desde cuando corren los 14 dias | Desde el paso 3 (el dia que deja la tarjeta), no desde que confirma el mail: asi `prueba_hasta` y el `start_date` de MP son la misma fecha y no hay que moverla. |
| Promo | **Solo los 14 dias de Dante.** Se sacan de `plans` el mes gratis y los 3 meses al 50% (`meses_gratis`, `meses_descuento`, `descuento_pct` en 0), para que el cobro y la pagina de precios no se contradigan. |
| Anual | **12 meses por adelantado**: un debito de 12 x `precio_anual_por_mes`, frecuencia 12 meses; `paga_hasta` se corre un anio. |
| Paris | **Es un plan pago.** Si eligio Paris y no paga, se suspende (solo lectura y exportar) despues de la gracia de la 0052. |
| Dante o Magnus sin pago | Baja a Paris limitado (lo que hace hoy el fin de la prueba). |
| "No paga" significa | Debito rechazado o suscripcion cancelada en MP. Lo informa el webhook. |
| Corte del lado del servidor | **Si, junto con esto.** `create-payment-preference` mira el plan efectivo y rechaza si el plan no incluye cobro online. |

Los clientes con acuerdo propio (porcentaje de la ganancia: La Nona Pato,
MiaEstudio, Monare, Crazy Miga) quedan afuera del cobro automatico: entran por
`provision_owner` y no tienen `plan_id`.

## El paso 3, en orden

El negocio todavia no existe en el paso 3 (se crea al confirmar el mail, con
`signup_tenant`), pero el usuario si: `auth.signUp()` devuelve su id aunque no
haya sesion. La suscripcion se ata al usuario y despues al negocio.

1. El Brick tokeniza la tarjeta (`card_token_id`, de un solo uso).
2. `registrarNegocio()` hace el `signUp` como hoy y se queda con el `user.id`.
3. El front llama a `suscripcion-alta` con `user_id` + `card_token_id`.
   La function (publica, `verify_jwt=false`, con rate limit):
   - verifica con service role que el usuario existe, se creo hace minutos y
     no tiene suscripcion (el endpoint no sirve para suscribir a terceros);
   - lee plan y periodo del `user_metadata`, **no del body**, y el precio de `plans`;
   - crea el preapproval `authorized` con `start_date` = hoy + 14 dias y
     `external_reference = user_id`;
   - guarda la fila en `suscripciones` con `tenant_id` todavia null.
4. Si MP rechaza la tarjeta, el usuario ya existe: el front conserva el
   `user_id` y reintenta solo la tarjeta, sin volver a hacer `signUp`.
5. Al confirmar el mail, `signup_tenant` busca la suscripcion de ese usuario,
   le pone el `tenant_id` y copia `prueba_hasta` = `start_date`.
6. **Si nunca confirma el mail**, un barrido diario cancela en MP las
   suscripciones sin `tenant_id` con mas de 7 dias. Sin esto, al dia 14 se le
   cobraria a alguien que no tiene negocio.

Con Google el usuario ya tiene sesion en el paso 3: misma function, que
acepta la sesion en vez del `user_id`.

## Piezas

1. **Migracion aditiva:**
   - tabla `suscripciones` (`user_id`, `tenant_id` nullable, `preapproval_id`
     `unique`, plan, ciclo, monto, estado, marca y ultimos 4 de la tarjeta,
     `start_date`; RLS con el patron de `tenant_id`);
   - tabla `cobros_suscripcion` (`tenant_id`, id de pago de MP `unique` para
     que un webhook repetido no extienda dos veces, monto, estado, fecha);
   - `signup_tenant` vincula la suscripcion (misma firma, `create or replace`);
   - el update de promos de `plans` (dato, con el ok de Ricky).
2. **`suscripcion-alta`**: lo del paso 3. La usa tambien Mi suscripcion para
   cambiar la tarjeta (nuevo token, `PUT` del preapproval).
3. **`suscripcion-webhook`** (`verify_jwt=false`, valida `x-signature`):
   - `subscription_preapproval`: guarda el estado (autorizada, pausada, cancelada).
   - `subscription_authorized_payment` aprobado: corre `paga_hasta`, pone
     `status='active'`, limpia `suspendido_at`.
   - rechazado o cancelada: Dante/Magnus bajan a Paris; Paris queda para la
     suspension por fecha.
4. **Front** (pasa por `/diseno`): el Brick en el paso 3, que deja de
   prometer "sin cobro ni suscripcion" y dice "$0 hoy, primer debito el
   <fecha>"; el reintento de tarjeta; Mi suscripcion. La public key de MP va
   como `VITE_MP_PUBLIC_KEY` (es publica, no es un secret).
5. **Corte en `create-payment-preference`** segun el plan efectivo.
6. **Al final**, con un par de ciclos reales, agendar `suspender_impagos` en
   pg_cron (paso 7 de `src/modules/suscripcion.js`).

## A verificar contra la doc vigente de MP antes de escribir

- Nombres exactos de los topics del webhook y el formato de `x-signature`.
- Si el preapproval acepta dinero en cuenta o solo tarjeta.
- Que pasa con `start_date` a 14 dias: si MP valida la tarjeta al suscribir
  (cobro y devolucion de prueba) o recien en el primer debito. Si no la
  valida, una tarjeta mala se descubre el dia 15.
- Si el preapproval con `card_token_id` exige que `payer_email` coincida con
  algo (en el sandbox, ambos tienen que ser usuarios de prueba).
- Cuanto dura un `card_token_id` antes de vencer (el reintento del paso 3
  tiene que pedir uno nuevo).
- Reintentos de MP ante un rechazo y cuando pasa la suscripcion a pausada.

## Lo que hace Ricky

- Credenciales de produccion de la cuenta MP de Divianco y usuarios de prueba
  para el sandbox.
- Cargar `MP_ACCESS_TOKEN` de Divianco y el secreto del webhook en Secrets de
  Supabase (nunca en el chat).
- Configurar la URL del webhook en "Tus integraciones" de MP (se le pasan los
  clics cuando llegue el paso).
