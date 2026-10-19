# Prueba: Web Interface Guidelines de Vercel en auditor-diseno (19/oct/2026)

> Rama `prueba/web-design-guidelines`. Criterio de entrada de CLAUDE.md: si
> es software o instrucciones de terceros, se prueba con una tarea real y se
> compara contra la misma tarea sin la herramienta.

## Que se comparo

La misma auditoria de solo lectura de la pantalla de Caja
(`src/components/admin/platform/CajaPanel.jsx` + `src/styles/admin-caja.css`,
en `main` `0ae6c9b`), con el subagente `auditor-diseno`, dos veces y a ciegas:

- **A, sin:** el auditor como esta.
- **B, con:** el mismo auditor y el mismo pedido, mas "ademas, aplica una por
  una las reglas de `web-interface-guidelines.md`" (commit `434b7f9`, 92
  reglas).

Caja es pantalla de plata: si algo se le escapa al auditor ahi, importa.

## Resultado

| | A (sin) | B (con) |
|---|---|---|
| Hallazgos | 20 (P0 2, P1 9, P2 5, P3 4) | 27 (P0 1, P1 6, P2 10, P3 10) |
| Marcados `[WIG]` | - | 18 |
| Tiempo / tokens | 5 min / 87k | 5,7 min / 98k |

**Coinciden** en lo grueso: `cp-root` en el admin deja la supervision
ilegible en tema oscuro (P0 en las dos), blanco a mano sobre `--ag-bad`,
touch targets de 32 px, mono para importes, hex y radios fuera de escala,
posible scroll horizontal entre 769 y ~800 px.

**Solo A encontro** (y B no):

- **Montos con formato argentino se guardan mal** (verificado en node):
  `Number('1500,50') || 0` da `0` y `Number('12.500')` da `12.5`, y el input
  deja escribir coma y punto. Abrir o cerrar la caja con "1500,50" guarda 0.

**Solo B encontro**, verificados a mano por quien escribe esto:

- **Doble envio:** `PlatformAdmin.jsx` no le pasa `cargando` a `CajaPanel`,
  asi que "Abrir caja" y el segundo toque de "Cerrar caja" no se bloquean
  mientras corre la llamada.
- **Hora en UTC:** "desde HH:MM" sale de `opened_at.slice(11, 16)` y
  `opened_at` es `timestamptz` (0004): muestra la hora UTC, 3 horas de mas.
- La diferencia del arqueo no se anuncia (`role="status"`), "Recibir y cerrar"
  actua de un toque, nombres largos sin `min-width: 0`, inputs de 12-14 px
  (zoom en iOS), oro como tinta en tema claro (1,8:1).
- Ruido de bajo valor: `translate="no"`, "..." en vez de "…", `name` en
  inputs, `touch-action`.

## Lectura

- Las reglas de Vercel **suman bugs reales que A no vio** (doble envio, hora
  UTC) y una capa de accesibilidad que el auditor no tenia escrita.
- **Pero mezcladas en la misma pasada desplazaron lo otro:** B no vio el bug
  de los montos, el mas grave de los dos informes. Con una sola corrida de
  cada lado puede ser variacion, pero es el modo de falla que importa.
- Por eso el cambio en `auditor-diseno` no las mezcla: agrega el paso 6
  (comportamiento con datos reales: montos, doble toque, fechas) y deja Vercel
  como paso 7, despues de todo lo demas.

## Decision propuesta

Adoptar con la copia fija y como pasada final del auditor. Antes de cerrarlo
en la tabla de CLAUDE.md, repetir la comparacion en una segunda pantalla con
el auditor ya cambiado: tiene que encontrar el bug de montos **y** el doble
envio en la misma corrida.

## Lo que la prueba dejo a la vista (no se arreglo aca)

Caja tiene tres bugs de comportamiento (montos, doble envio, hora UTC) y el
`cp-root` del admin. El mismo `cp-root` esta en `PersonalPanel.jsx`,
`EditorDeMesa.jsx` y `DicoPanel.jsx`. Arreglarlos cambia lo que ve un
cliente: pide el ok de Ricky y pasa por `/diseno`.

## Image to Code: descartada sin rama

La lista la describia como "le das una imagen y extrae el sistema de diseno".
El `SKILL.md` real (`Leonxlnx/imagegen-skills`, 1228 lineas) hace lo
contrario: **genera** primero las imagenes de diseno y despues maqueta un
sitio de marketing, pensado para Codex, y pide alejarse del estilo dashboard.
Claude Code no genera imagenes, el admin es dashboard y la direccion de arte
de landings ya la tiene `design-taste-frontend` (mismo autor). No hay tarea
real de DICO que encaje.
