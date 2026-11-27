---
name: orquestar
description: Reparto de trabajo por modelo en DICO — Opus orquesta (piensa, decide, audita, aplica a la base y mergea), Haiku explora (lecturas amplias y tareas de archivos simples) y Sonnet aplica (construye en su worktree y abre el PR). Usar cuando Ricky escribe /orquestar o pide "exploración con Haiku, aplicación con Sonnet", y en todo cambio de varios pasos que toque código, base o UI y que no sea una edición chica.
---

# Orquestar: Opus piensa, Haiku explora, Sonnet aplica

Regla de Ricky (26/nov/2026): "las acciones de exploración a Haiku, las de
aplicación a Sonnet, y el pensar hacelo vos; si ves que Sonnet se queda
pensando, intercedé". Esta skill es esa regla con lo que se aprendió al usarla
en Cochi (Nuevo pedido, Anular pedido, marca de anulación, fotos, música).

## Quién hace qué

| Rol | Modelo | Herramienta | Hace | No hace |
|---|---|---|---|---|
| Orquestador | Opus (la sesión) | — | Entiende el pedido, decide el diseño, escribe el brief, audita el diff, aplica a la base, mergea, verifica en producción y le explica a Ricky | Escribir el código de la feature |
| Explorador | Haiku | `Agent` con `subagent_type: "Explore"` (o `general-purpose` para archivos) y `model: "haiku"` | Mapea código y migraciones con rutas y líneas; mueve o copia archivos fuera del repo | Decidir, editar el repo |
| Aplicador | Sonnet | `Agent` con `subagent_type: "disenador"` (UI) o `"general-purpose"` (lo demás), `model: "sonnet"`, `isolation: "worktree"` | Construye en su rama, corre los checks, abre el PR | Aplicar a la base, pushear a main, mergear |
| Auditor de UI | Sonnet | `Agent` con `subagent_type: "auditor-diseno"`, `model: "sonnet"` | Audita en solo lectura la rama remota y las capturas, devuelve P0–P3 | Editar |

Lo que nunca se delega: lo que se aplica a la base, el merge, las decisiones
que son de Ricky y el "está listo". Esos pasos los hace el orquestador.

## El ciclo

1. **Explorar (Haiku).** Un brief con preguntas concretas: qué RPC o tabla,
   qué pantalla, qué servicio, qué tests, qué gates (`check:definer`,
   `check:expandir`, snapshot). Pedí rutas con número de línea y citas
   exactas. Si la pregunta es de la base, el orquestador además mira la base
   real con `execute_sql` (solo `select`): columnas, triggers, constraints,
   policies, índices. **El repo dice lo que se quiso aplicar; la base dice lo
   que hay.**
2. **Diseñar (Opus).** Decidir el qué y el cómo antes de mandar a construir:
   firma de la RPC, qué escribe y qué deshace, permisos, compatibilidad con el
   deploy anterior, qué ve el usuario. Si hay dos lecturas del pedido, se
   dicen; si la decisión es de Ricky, se pregunta antes de construir.
3. **Construir (Sonnet).** Un brief cerrado (plantilla abajo). Corre en
   segundo plano; mientras tanto el orquestador puede avanzar con otra cosa
   (contarle a Ricky el plan, preparar la verificación).
4. **Auditar (Opus + auditor de UI).** Leer el diff de la rama remota
   (`git fetch` + `git diff main...origin/<rama>`), no el resumen del
   subagente. Mirar las capturas. Si toca UI, lanzar `auditor-diseno` en
   paralelo, pasándole solo los archivos, la autoridad y las capturas, nunca
   el razonamiento del constructor. Probar contra la base lo que se pueda
   probar sin escribir (ver "Trampas").
5. **Corregir (Sonnet, el mismo).** Las correcciones van por `SendMessage` al
   mismo agente, que conserva el contexto. Un mensaje con todo junto:
   hallazgos numerados, archivo:línea, y qué tiene que reportar. Máximo dos
   rondas; si después sigue mal, el orquestador escala a Ricky con el
   hallazgo concreto.
6. **Aplicar a la base (Opus, con ok de Ricky).** Ver "Base" abajo.
7. **Mergear (Opus, con ok de Ricky).** `gh pr checks <n> --watch` en segundo
   plano → con ok, `git merge --no-ff origin/<rama>` con mensaje
   `Merge <qué> (PR #n)` → push → `GITHUB_TOKEN=$(gh auth token) npm run -s
   ci:esperar` → `list_deployments` de Vercel hasta ver el SHA en
   producción READY → probar en producción con el navegador integrado.
8. **Limpiar.** `git worktree remove --force .claude/worktrees/agent-<id>` +
   `git worktree prune` cuando la rama está mergeada. Borrar temporales.

## Plantilla del brief para Sonnet

```
Repo hermes-gastro (DICO). Leé CLAUDE.md antes de empezar. Reglas duras: nunca
`git add -A`; `NODE_ENV=` vacío; vitest `NODE_ENV=test npx vitest run
--pool=threads --maxWorkers=2 <archivos>`; código en español, comentarios sin
tildes; [cp-root en catálogo / nunca cp-root en el admin]. Trabajás en tu
worktree, rama `<tipo>/<tema>` desde main (<sha>). NO apliques nada a la base,
NO pushees a main. Al final: commits chicos con rutas explícitas (terminados
en "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"), push de tu
rama y `gh pr create` contra main.

## Pedido de Ricky        (sus palabras, citadas)
## Estado actual          (lo que ya verificó el orquestador, con rutas:línea)
## Diseño (decidido)      (qué construir, con nombres exactos; lo que no se discute)
## UI                     (si aplica: /diseno, skill estética, autoridad, línea base, capturas a 390 y 900/1280)
## Tests                  (casos concretos, incluidos los bordes)
## Verificación           (lint de lo tocado, check:*, build, vitest; pegá exit codes)

Reportame: rama, PR, archivos, tabla antes/después, exit codes, rutas de
capturas y todo desvío del brief con su porqué. Si algo choca con el código
real, frená y explicalo en vez de forzarlo.
```

Lo que hace que un brief funcione: el estado actual ya verificado (Sonnet no
re-descubre), el diseño cerrado (no elige arquitectura), los criterios de
éxito medibles y el pedido explícito de que frene ante un choque con el código.

## Base

- La migración la escribe Sonnet con cabecera `-- PENDIENTE de aplicar (la
  aplica el director via MCP con ok de Ricky)`. Ricky da el ok; el
  orquestador aplica con `apply_migration` **el texto exacto del archivo de la
  rama** (copiarlo del `git show`, no reescribirlo).
- Verificar después: columnas en `information_schema`, una sola firma en
  `pg_proc`, grants (`has_function_privilege` para anon), y que el md5 de
  `prosrc` sea igual al del cuerpo del archivo
  (`split('as $function$')[1].split('$function$;')[0]`, sin `\r`).
- Correr el test SQL de `platform/tests/` (bloque DO que termina en `raise
  exception` y se deshace solo) y confirmar después que no quedó nada
  (`select count(*) ... like 'test-%'`).
- Marcar la cabecera `-- Aplicada via MCP el <fecha> (ok de Ricky). Test:
  <archivo> -> OK.` y subir `_migrations_through` en
  `scripts/platform-schema.json` si hace falta.
- **Orden:** si el front pide columnas nuevas (`ORDER_COLS`, `select`), la
  migración va ANTES del merge. Al revés, la consulta falla y la pantalla
  queda vacía.
- Datos puntuales de un tenant (fotos, cargas): migración de datos con
  `get diagnostics ... row_count` que falle si no actualiza la cantidad
  esperada.
- Storage: el orquestador no puede subir archivos. Se arma un script en el
  scratchpad (nombre con hash del contenido, idempotente, sin dependencias)
  que Ricky corre con la clave de servicio en SU terminal. Después se
  verifica en `storage.objects` (cantidad y bytes) antes de tocar la base.
  Si existe el flujo del producto (Personalización), se prefiere ese.

## Trampas que ya pasaron

- **`UPDATE ... FROM x LEFT JOIN y ON y.id = o.col`** falla en Postgres
  (42P01): la tabla objetivo no se puede referenciar en el ON. Un backfill
  así rompe la migración entera. Probarlo antes en un `do $$ ... raise
  exception $$` con una columna que ya exista.
- **Siembras de test incompletas:** `order_items.subtotal` tiene default 0 y
  `complete_order` lo usa; un test sin subtotal da ventas en 0 y parece un
  bug de la función.
- **El reporte del subagente no es evidencia.** "No lo probé contra la base",
  "no miré la de 900": leerlo como pendiente del orquestador.
- **`aria-label` que cambia + `aria-pressed`** es un antipatrón: nombre fijo
  y el estado en `aria-pressed`.
- **El bot de Vercel en el PR** dispara un aviso de review: no hay nada que
  corregir.
- **Ricky ve un bug en producción:** primero la causa con rutas:línea (un
  grep alcanza), después el brief. No mandar a construir sin saber por qué
  pasa.

## Cuándo intervenir

- **Sonnet se traba** (un rato largo sin reportar, o reporta que no pudo):
  leerle el último estado con `SendMessage` pidiendo un resumen de dónde está,
  y destrabar con la decisión que le falta. Si el problema es de diseño, lo
  resuelve el orquestador; no se le pide a Sonnet que elija.
- **Sonnet se aparta del brief:** si el desvío tiene un porqué razonable y no
  rompe nada, se acepta y se dice; si no, se corrige en la ronda siguiente.
- **Algo chico** (una línea de cabecera, un número en el snapshot): lo hace el
  orquestador directo, sin otra ronda.

## Qué se le cuenta a Ricky

Al lanzar: qué va a hacer cada uno, en dos o tres líneas. Al cerrar: qué
quedó, qué se comprobó y cómo (SHA, CI, prueba en producción), qué no se
comprobó, y el próximo paso que es suyo (un ok, un deploy, una carga en el
panel), con los pasos numerados.

## Codex

Codex no tiene subagentes por modelo: sigue el mismo ciclo en una sola
sesión, en el mismo orden (explorar → diseñar → construir en una rama →
auditar como pasada aparte → base con ok → merge con ok → verificar).
