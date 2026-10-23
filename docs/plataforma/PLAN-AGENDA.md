# Plan: agenda de turnos para tenants de servicio (caso MiaEstudio)

> 23/oct/2026. Investigación + plan. **Nada de esto está implementado ni aplicado.**
> Cliente ancla: MiaEstudio (uñas y pelo, Zona Norte, a domicilio, consumo de
> insumos por servicio). Rubro del tenant: `barber`, canal `appointment`.

## 1. Qué ya existe (verificado en el repo, 23/oct)

| Pieza | Dónde | Estado |
|---|---|---|
| `staff` (nombre, color, comisión) y `appointments` | 0005, 0045 | Hecho |
| No-solapamiento por profesional **y** por recurso (EXCLUDE gist) | 0005, 0045 | Hecho, vive en la base |
| Estados `booked → confirmed → arrived → in_service → done` + `no_show`/`cancelled` | 0045 | Hecho |
| Columnas de seña (`deposit_amount`, `deposit_status`, `cancellation_policy`), `source`, `client_request_id` (idempotencia) | 0045 | Modeladas, sin cobro |
| `resources`, `waitlist_entries`, `available_resources()`, `resource_utilization()` | 0045 | Hecho (pensado para mesas) |
| `products.duration_min` para servicios | 0005 | Hecho; los 7 servicios de Mía están en `NULL` |
| `src/services/platformScheduling.js` (CRUD de reservas, espera, utilización) | repo | Hecho, sin pantalla |
| Módulo `agenda` en el registry y el rubro `barber` lo incluye | `src/modules/registry.js:37` | `implementado: false` |
| Descuento de insumos al completar un **pedido** + asiento en el libro | 0104 | Hecho, no conectado a turnos |

**Conclusión:** el motor de "no pisar turnos" está. Lo que falta es todo lo que
rodea a ese motor: **disponibilidad** (cuándo trabaja cada profesional),
**cálculo de huecos**, **pantallas**, **reserva online**, **avisos**, **seña**
y **cerrar el turno contra venta e insumos**.

## 2. Cómo lo resuelven otros (investigación)

Fuentes: páginas oficiales de Fresha y AgendaPro; el resto son comparativas de
terceros y conocimiento general del rubro (marcado "a verificar"). Los números
de reducción de no-shows son afirmaciones de los vendors, no datos
independientes.

| Capacidad | Cómo se hace en el mercado | Para Dico |
|---|---|---|
| Servicios | Nombre, duración, precio, descripción; a veces tiempo de preparación/limpieza posterior (buffer) | Ya hay `duration_min`; sumar `buffer_after_min` |
| Profesionales | Calendario propio, horario semanal, días libres/vacaciones, qué servicios hace cada uno | Falta horario, bloqueos y relación profesional↔servicio |
| Reserva online | Cliente elige servicio → profesional o "el primero disponible" → hora → datos. Sitio con logo y colores del negocio (AgendaPro lo ofrece) | Va dentro del catálogo del tenant (`mia-estudio.divianco.app`) |
| Huecos | Se calculan = horario del profesional − turnos − bloqueos − buffers, con paso fijo (15/30 min), anticipación mínima y máxima | Falta; es el corazón |
| Avisos | Recordatorios automáticos por email/SMS/WhatsApp, 1–3 días antes y/o 3 h antes; confirmar/cancelar con un clic (Fresha: hasta dos recordatorios a 3/24/48/72 h; AgendaPro: WhatsApp, SMS o email) | Push ya existe; WhatsApp requiere proveedor (decisión) |
| No-shows | Seña al reservar **o** tarjeta guardada para cobrar después; política visible (ejemplo de Fresha: gratis hasta 48 h antes, 25 % si cancela tarde, 50 % si no viene) | Columnas listas; falta cobro con MercadoPago |
| Lista de espera | Si no hay hueco, el cliente se anota y se avisa si se libera | `waitlist_entries` ya existe |
| Cierre del turno | Se cobra desde el mismo turno, con productos y propina; comisión al profesional | Falta unir turno → venta → insumos → comisión |
| Solo vs. salón | Calendly/Cal.com: un profesional, sin POS. Fresha/Booksy/Square: multi-profesional con caja | Mía hoy es una profesional (más "otra profesional" en retiros): diseñar multi-profesional desde el modelo, pero lanzar simple |

A verificar antes de decidir: precios actuales de WhatsApp Business API en
Argentina, y si MercadoPago permite retener/cobrar seña con el flujo que ya usa
`create-payment-preference`. La búsqueda no devolvió nada utilizable sobre
Turnito ni sobre seña con MercadoPago.

## 3. Decisiones de Ricky (23/oct) y qué cambian

1. **Agenda para todos los rubros de servicio, no solo `barber`.** El registry
   ya lo permite: ningún componente pregunta por el rubro, preguntan por el
   módulo (`tieneModulo`). Entonces `agenda` es un módulo que cualquier rubro
   lista en `modulos`, y el vocabulario ("turno", "reserva", "clienta",
   "profesional") sale de `terminologia`. Mía (uñas y pelo) es el primer caso
   real; no se programa nada con nombre de barbería. Dato abierto: Mía hoy está
   cargada como rubro `barber`; si conviene un rubro propio de "belleza y
   servicios" se decide en la fase 1, sin migrar a nadie a ciegas.
2. **Recordatorios automáticos desde el MVP.** Pasa de fase 4 a fase 3. Plan:
   push + email (Resend) sin costo desde el día uno, y WhatsApp como canal
   configurable. WhatsApp pasa por la API oficial de Meta: se cobra por
   plantilla enviada fuera de la ventana de 24 h (las de utilidad dentro de la
   ventana son gratis); la tarifa vigente en Argentina **no la pude verificar**
   y Meta la actualiza el 1 de cada trimestre. Hay que mirar la tarjeta de
   tarifas oficial antes de prometerle un costo a nadie, y decidir quién paga
   (Divianco o el tenant).
3. **Seña opcional por tenant, pero construida desde el inicio.** Se
   configura en el tenant (apagada / monto fijo / porcentaje del servicio) y
   la reserva online ya nace con el paso de cobro condicional. Sube de fase 5 a
   fase 3; lo que queda después es la política de reintegro.
4. **Local y domicilio, ambos.** Cada turno lleva su modalidad (`en el local`
   o `a domicilio`), dirección y tiempo de traslado. Se modela en la fase 1, no
   después: agregarlo luego obliga a migrar turnos ya cargados.

## 3.1 Alcance

### MVP (lo que Mía puede usar)
Fases 0–3: datos, base de disponibilidad (con domicilio), agenda en el panel,
reserva online con seña opcional y recordatorios automáticos.

### Después
Fase 4 cierre contra venta e insumos, fase 5 política de reintegro y cobro de
cancelaciones tardías, fase 6 lista de espera con aviso al liberarse un hueco.

## 4. Fases

### Fase 0 — Datos de Mía (bloqueante, sin código)
Ya hay una planilla (ver HANDOFF 22/oct) con casilleros vacíos. Necesitamos:
duración de cada servicio, margen entre turnos, profesionales y qué servicio
hace cada una, horarios por día, **si atiende a domicilio y cómo se agenda el
traslado**, seña y política de cancelación, aclarar Flores 3D (¿por flor, uña
o trabajo?) y si los retiros se reservan solos o van pegados al servicio.

### Fase 1 — Base de disponibilidad (migraciones, solo expandir)
Todo nuevo lleva `tenant_id` + RLS con el patrón `private.current_user_tenants()`.
- `staff_schedules`: profesional, día de semana, desde/hasta (varios tramos por día).
- `staff_time_off`: bloqueos puntuales (vacaciones, turno médico, feriado).
- `staff_services`: qué servicios hace cada profesional (y duración propia opcional).
- `products.buffer_after_min` (nullable, default 0).
- Domicilio: en `appointments`, `location_kind` (`local`|`home`), dirección,
  `travel_min` (tiempo de traslado antes del turno, que ocupa al profesional) y
  en el tenant qué modalidades ofrece. El hueco se calcula con el traslado
  incluido; sin geocodificación en el MVP (el traslado lo fija el tenant por
  zona o por valor fijo).
- Seña por tenant: modo y monto/porcentaje, más el vencimiento del turno sin
  pagar.
- Reglas de reserva por tenant en `settings` (anticipación mínima, ventana
  máxima, paso de la grilla, plazo de cancelación). **Ojo schema:** columna
  nueva → Zod + manifest + `schema:sync`.
- RPC `get_available_slots(tenant, servicio, profesional|null, desde, hasta)`
  que devuelve horarios. Mismo patrón que `available_resources`: no ofrece lo
  que va a rebotar; la garantía sigue siendo el EXCLUDE.
- Para "cualquier profesional": la asignación ocurre al confirmar y reintenta
  con la siguiente si el EXCLUDE rebota (dos clientas pidiendo el mismo hueco).
- Test de aislamiento entre tenants y tests del cálculo de huecos (bordes:
  adyacentes, buffer, cruce de medianoche, ausencia en el medio).
- Primero `npm run mapa -- appointments` y `available_resources` antes de tocar.

### Fase 2 — Agenda en el panel
Vista día y semana por profesional (color de `staff.color`), crear/mover/cambiar
estado, bloquear horarios, alta de profesionales y horarios. `agenda` pasa a
`implementado: true` **y** se declara en la matriz de roles (si no, no aparece
en la nav aunque esté publicada). Pasa por `/diseno`.

### Fase 3 — Reserva online, seña opcional y avisos
- Flujo con teléfono (guest, como los pedidos): servicio → modalidad (local o
  domicilio, según lo que el tenant ofrezca) → profesional o "cualquiera" →
  horario → datos (y dirección si es domicilio) → seña si el tenant la activó
  → confirmación con link para ver/cancelar.
- Edge function pública `submit-booking` con `verify_jwt=false`, rate limit y
  validación interna (`client_request_id` para no duplicar). Se activa el canal
  `online_booking` en el tenant.
- **Seña:** configuración por tenant (apagada / fijo / %). Reutiliza
  `create-payment-preference`; el turno queda `booked` con
  `deposit_status='pending'` y vence si no se paga en X minutos para liberar el
  hueco (si no, alguien bloquea la agenda sin pagar). Webhook a `paid`.
  Depende de verificar el flujo de MercadoPago (sección 2).
- **Avisos automáticos:** confirmación al reservar, recordatorio a 24 h y a
  3 h (configurable), con confirmar/cancelar con un clic; cola procesada por
  cron. Canales: push + email desde el día uno, WhatsApp como canal
  configurable por tenant (costo y quién lo paga: ver decisión 2).
- Pasa por `/diseno`.

### Fase 4 — Cerrar el turno
`done` genera la venta y consume los insumos **una sola vez** (reservar y
cancelar no consumen), reutilizando `product_ingredients` y el circuito de
0104, sin duplicar tablas de recetas. Comisión al profesional. Hoy
`usaReceta('barber')` es `false`: hay que decidir si el consumo por servicio se
configura con ese editor o con uno propio.

### Fase 5 — Política de cancelación
Cancelación dentro del plazo → `refunded`; tarde o no-show → `forfeited`
(la seña se queda) o cargo, según lo configure el tenant.

### Fase 6 — Lista de espera
Usa `waitlist_entries`: al cancelarse un turno se avisa al primero que calza.

## 5. Riesgos

1. **Zona horaria:** guardar `timestamptz`, pero los horarios de trabajo son
   hora local del negocio (el tenant ya tiene zona). Argentina no cambia de
   hora, pero el código no debe asumirlo.
2. **Concurrencia en "cualquier profesional":** el EXCLUDE protege por
   profesional, no por "alguien libre". Hace falta el reintento de la fase 1.
3. **`no_show` sigue bloqueando el hueco:** `appt_no_overlap` (0005) excluye
   solo `cancelled`; el de recurso sí excluye `no_show`. Es una incoherencia a
   resolver (migración expandir/contraer) o a aceptar a propósito.
4. **Local y domicilio a la vez:** el traslado es tiempo ocupado que no es
   servicio ni buffer fijo, y una profesional no puede estar en el local y en
   una casa a la misma hora. Entra en el modelo de la fase 1. Pendiente de
   Mía: cómo calcula hoy el traslado (por zona, por distancia, fijo).
5. **Seña sin pagar bloquea agenda:** sin vencimiento, una reserva abandonada
   ocupa el hueco. Entra en la fase 3.
6. **Costo de WhatsApp sin verificar:** no se promete hasta ver la tarifa
   oficial vigente.
7. **Subestimar la agenda** (ya lo dice PLAN-MULTI-RUBRO #4): parece CRUD y no
   lo es.
8. **Alcance en el edificio:** todo esto es código y schema compartidos. El
   workspace es exclusivo de MiaEstudio, así que cada fase pide autorización
   explícita de Ricky antes de tocar `src/`, `platform/` o edge functions.

## 6. Pendientes

Resueltas el 23/oct: módulo para todos los rubros de servicio, avisos
automáticos, seña opcional por tenant desde el inicio, local y domicilio.

Siguen abiertas:
1. Autorización de Ricky para empezar la fase 1 (toca `platform/` y `src/`).
2. Quién paga WhatsApp (Divianco o el tenant) y tarifa oficial vigente.
3. Cómo calcula Mía el traslado a domicilio y los datos de la fase 0.
4. ¿Rubro propio de "belleza y servicios" o se queda en `barber`?

## 7. Mejora de proceso

Empezar por la **función de huecos como SQL puro con tests** (fase 1) antes de
cualquier pantalla: es la parte difícil, no depende de diseño, y con ella
probada el panel y la reserva online son capas finas encima.
