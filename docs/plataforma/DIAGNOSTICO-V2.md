# Diagnostico v2: resultado con valor y lead calificado

> 29/oct/2026. Especificacion acordada con Ricky. **Nada de esto esta construido.**
> El diagnostico vigente esta descripto en `LANDING.md`; este documento dice
> hacia donde va y en que orden.

## 1. Por que

El diagnostico de hoy (`src/lib/diagnostico.js`, `src/components/landing/Diagnostico.jsx`)
pregunta bien pero entrega poco:

- **No deja un lead.** Se guarda sin datos de contacto (decision "sin email en
  el embudo", `LANDING.md`). Si la persona no termina el alta, no hay a quien
  escribirle.
- **El resultado es un texto fijo por dolor**: no usa nada propio del negocio.
- **Urgencia e inversion** cambian textos del resultado (`Diagnostico.jsx`,
  bloque del plan) pero no el plan ni ninguna clasificacion.
- **"Otro sistema" no pregunta cual** ni cuanto paga.
- **Analitica**: solo `diagnostico-inicio` y `diagnostico-resultado`. No se sabe
  en que paso abandona la gente.

## 2. Principios

1. **Primero el valor, despues el contacto.** El contacto es opcional y va al
   final del resultado.
2. **Una pregunta protagonista por pantalla.** Se conserva la tarjeta oscura
   sobre el hero difuminado, con Dico acompanando. Nada de formulario largo.
3. **Preguntas condicionales**: aparecen solo cuando corresponden. Elegir
   "Otro sistema" despliega nombre y costo; elegir un dolor muestra su
   pregunta especifica.
4. **Montos solo con datos del propio negocio y una formula explicable.** Si no
   hay datos suficientes, el hallazgo se dice sin cifra. Los casos de clientes
   (La Nona Pato, Crazy Miga) sirven como ejemplo, no para estimar perdidas de
   otro negocio.
5. **Nada que el producto no haga hoy** (la regla de `diagnostico.js` sigue).
6. **El puntaje es una hipotesis interna**, guardada con sus motivos y
   ajustable con resultados reales. Nunca se le muestra a la persona.

## 3. El resultado (se disena primero)

Orden fijo:

1. **Tu prioridad**: que problema conviene resolver primero y por que.
2. **Lo que encontramos**: dos o tres hallazgos concretos que salen de cruzar
   sus respuestas (ej.: "vendes por tres canales y los pedidos entran por
   separado"; "recalculas precios cada varios meses con insumos que suben").
3. **Tu primer paso con Dico**: las herramientas pertinentes (modulos con
   `implementado: true`), el plan y su precio.
4. **Contacto opcional**: "¿Queres recibir este diagnostico por WhatsApp?".
   Promesa: "Te lo mando por WhatsApp y te ayudamos a configurar Dico".
   **No** "te dejo la cuenta armada": el alta hoy pide email y confirmacion.

La creacion de cuenta sigue aparte (accion oro "Crear mi cuenta", con
`negocio`, `rubro` y `d` precargados como hoy).

### Cuando se muestra una cifra

| Dato | Se puede decir | No se puede decir |
|---|---|---|
| Diferencia de caja semanal | "Tu caja tiene una diferencia de alrededor de $X por semana" | Que eso es perdida o ahorro recuperable |
| Turnos que no se presentan | La cantidad | Su valor, salvo que tambien de ticket y cuantos se recuperan |
| Cuando conoce su ganancia / cada cuanto actualiza precios | La necesidad ("te enteras tarde") | Un monto |
| Venta mensual (rango) | Ubicar el plan | Capacidad de pago |

## 4. Las preguntas (se ajustan despues del resultado)

Se piden exactamente los datos que el resultado de la seccion 3 necesita.
Borrador:

| Paso | Pregunta | Condicional |
|---|---|---|
| 1 | Rubro y tipo de negocio | — |
| 2 | Que te preocupa mas (uno principal) | — |
| 2b | La pregunta especifica del dolor | Segun el dolor |
| 3 | Por donde vendes | — |
| 4 | Locales y equipo | — |
| 5 | Como lo controlas hoy | "Otro sistema" despliega cual y cuanto paga |
| 6 | Venta mensual en rangos, con "No lo se" y "Prefiero no responder" | — |
| 7 | Para cuando lo queres resolver y quien decide | — |
| 8 | Nombre del negocio (opcional) | — |

- La venta mensual **no descarta** a nadie por facturar poco.
- Inversion se revisa cuando este el resultado: si el precio ya se muestra en
  el paso 3 del resultado, puede salir.
- Cada lista nueva vive en tres lugares que tienen que coincidir (ver
  `LANDING.md`): `diagnostico.js`, los `CHECK` de `diagnosticos` y la edge
  function `diagnostico`. Migraciones solo de expandir.

## 5. Clasificacion del lead (interna)

Tres ejes, cada uno guardado con su motivo en texto:

- **Encaje**: rubro y tamano que Dico cubre hoy, canales.
- **Necesidad**: el dolor se resuelve con modulos que existen; hay datos de la
  pregunta especifica.
- **Intencion**: urgencia, quien decide, si dejo WhatsApp.

"Usa otro sistema" suma intencion pero tambien **riesgo de migracion**; se
guarda como motivo, no como punto a favor automatico.

La clasificacion (caliente / tibio / frio) es una hipotesis: se revisa contra
quienes efectivamente se dieron de alta y pagaron, y se ajusta.

## 6. Instrumentacion (va antes de cambiar preguntas)

Hoy `marcarEvento` registra una visita virtual `/evento/<nombre>` en Vercel
Analytics. Sumar, una vez por diagnostico:

- entrada a cada paso (`diagnostico-paso-<id>`),
- retroceso (`diagnostico-atras-<id>`),
- abandono: el ultimo paso visto sin llegar al resultado,
- `diagnostico-whatsapp` cuando deja el contacto.

Con eso se decide que preguntas sobran con datos, no a ojo.

## 7. Pendientes antes de construir

- **Agenda**: el registry la marca `implementado: true` (migracion 0109) y
  existen el panel y `/reservar`, pero `solucion('turnos')` dice que esta en
  desarrollo y el encabezado de `PLAN-AGENDA.md` dice que nada esta
  implementado. Validar que esta publicado en `divianco.app` antes de cambiar
  la promesa.
- **Rama `landing/resultado-del-dia`** (worktree `.claude/worktrees/landing-dia`,
  sin PR) toca el resultado del diagnostico. Resolverla (mergear o descartar)
  antes de redisenar el resultado, o el trabajo choca.
- **WhatsApp guarda un dato personal**: la tabla `diagnosticos` hoy no tiene
  ninguno. Hace falta columna nueva, texto de consentimiento junto al campo y
  que la policy no lo exponga.
- Quien responde los WhatsApp y en cuanto tiempo (proceso de Ricky, no codigo).

## 8. Orden de trabajo

1. Instrumentacion por paso (seccion 6). Chico, sin cambio visible.
2. Resultado y captura de contacto (seccion 3), por `/diseno` con `impeccable`.
   Migracion aditiva para el contacto y los motivos.
3. Ajuste de preguntas (seccion 4) para alimentar ese resultado.
4. Clasificacion interna (seccion 5) y su revision al mes.
