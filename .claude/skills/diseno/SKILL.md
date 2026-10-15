---
name: diseno
description: Flujo de diseño con medición para DICO y los demás repos de Divianco — línea base, autoridad del sistema, una skill estética por tarea, construcción y auditoría con subagentes separados, y comparación antes/después. Usar cuando se toca UI, pantallas, estilos, CSS, layout, tipografía, colores, animaciones o accesibilidad, o cuando Ricky escribe /diseno.
---

# Diseño con medición

Tres reglas que no se negocian:

1. **Sin línea base no se toca nada.** Si no medís antes, no podés decir que mejoró.
2. **Una sola skill estética por tarea.** taste-skill e impeccable imponen criterio
   propio; juntas se contradicen y el resultado es una mezcla sin dirección.
3. **Quien construye no audita.** El auditor es otro subagente, de solo lectura,
   que no ve el razonamiento del constructor.

## Paso 0 — Autoridad del sistema (no inventar)

Antes de proponer un color, una fuente o un espaciado, leé la autoridad del repo.
Lo que diga la autoridad gana sobre cualquier skill.

**En `hermes-gastro` (DICO):**

- `docs/marca/DICO-DESIGN-SYSTEM-V0.1.md` — inventario, deuda y decisiones.
- `docs/marca/DICO-BRAND-TYPOGRAPHY.md` — Overused Grotesk (interfaz), Butler Free
  (editorial), JetBrains Mono (técnico). Nada de Inter, Söhne ni Canela.
- Tokens: `src/styles/dico-tokens.css`, `src/styles/admin-tokens.css`,
  `src/styles/machine-soul.css` y el bloque `@theme` de `src/index.css`
  (Tailwind es infraestructura del design system, no se saca).
- Catálogo: temas `ambar` / `noche` / `carbon`; todo componente del catálogo-pro
  lleva `className="cp-root"` o no recibe tokens.
- **No crear `DESIGN.md` en la raíz**: la regla del repo es que ahí solo viven
  `CLAUDE.md`, `AGENTS.md` y `README.md`. La autoridad ya existe en `docs/marca/`.
- Protocolo de DICO: si la sesión no arrancó con `/dico`, leé al menos la sección 0
  de `docs/HANDOFF.md` y corré `git worktree list` antes de editar. Commits chicos,
  rutas explícitas, nunca `git add -A`. Se cierra con `/cerrardico`.

**En otro repo:** buscá `DESIGN.md` o una carpeta de marca. Si no hay sistema,
el Paso 2 arranca por proponer uno y Ricky lo aprueba antes de construir.

## Paso 1 — Línea base (obligatoria)

Guardá los resultados en el temp del sistema, nunca en el repo:

```bash
TMP=$(node -p "require('os').tmpdir()")
npx impeccable detect --json src index.html > "$TMP/diseno-antes.json"
```

Si la tarea es sobre una pantalla renderizada, medila también levantada
(móvil primero, que es donde compran los clientes de los tenants):

```bash
NODE_ENV= npm run dev
npx impeccable detect http://localhost:5173 --viewport 390x844 --json > "$TMP/diseno-antes-movil.json"
npx impeccable detect http://localhost:5173 --viewport 1280x800 --json > "$TMP/diseno-antes-desktop.json"
```

La deuda conocida vive en `scripts/diseno-deuda.json` y la vigila
`npm run check:diseno` en el pre-commit y en CI: un hallazgo nuevo frena el
commit. Igual que `llamadas-legacy-pendientes.json`, **esa lista solo se
achica**; al resolver deuda, `npm run check:diseno -- --podar`.

Para pantallas del panel, sacá también la foto de antes con
`npm run pantalla -- <pantalla>` (muestra los anchos que cambian el layout).

## Paso 2 — Elegir UNA skill para la tarea

| Tarea | Skill | No usar |
| --- | --- | --- |
| Pantalla nueva o rediseño grande | `design-taste-frontend` (taste-skill), dentro de los tokens existentes | ui-ux-pro-max |
| Pulir o arreglar una pantalla existente | `impeccable` (`critique` → `polish` / `normalize`) | taste-skill |
| Auditoría técnica (a11y, responsive, performance) | `impeccable audit` | — |
| Repo sin sistema de diseño (ej. FOCUS / Diconomy) | `ui-ux-pro-max` para proponer paleta, fuentes y tokens; Ricky aprueba | — |

En `hermes-gastro` **no se usa ui-ux-pro-max**: su trabajo es inventar un sistema
y DICO ya tiene uno. Si una skill sugiere algo fuera de la autoridad (otra
fuente, otro acento), no lo metas de contrabando: proponéselo a Ricky aparte.

Si la skill elegida no está instalada, decí cuál falta y cómo instalarla
(ver "Requisitos") y pará. No improvises sus reglas de memoria.

## Paso 3 — Referencias (si Ricky pasa URLs o capturas)

Extraé 3 a 5 decisiones concretas y transferibles: densidad, jerarquía, ritmo
de espaciado, tratamiento de estados vacíos, movimiento. No copies la identidad
visual de la referencia. Las imágenes no se guardan en el repo (van a Drive).

## Paso 4 — Construir con el subagente `disenador`

Una pantalla por delegación. Pasale: la pantalla y sus archivos, la autoridad
del Paso 0, la skill elegida, las decisiones de referencia y el criterio de
aceptación (qué warnings tienen que desaparecer y qué no puede romperse).

## Paso 5 — Auditar con el subagente `auditor-diseno`

Pasale solo la lista de archivos tocados y la autoridad, no el razonamiento del
constructor. Devuelve hallazgos P0–P3. El constructor corrige P0 y P1.
Máximo dos rondas: si después de la segunda sigue habiendo P0, escalá a Ricky
con el hallazgo concreto en vez de seguir iterando.

## Paso 6 — Medir y cerrar

```bash
npx impeccable detect --json src index.html > "$TMP/diseno-despues.json"
```

Mismo comando, mismo alcance y mismo viewport que en el Paso 1. Reportá:

| Métrica | Antes | Después | Delta |
| --- | --- | --- | --- |
| Warnings estáticos | | | |
| Advisory | | | |
| Warnings móvil 390 (si aplica) | | | |
| Hallazgos P0/P1 del auditor | | | |

Gate: `npm run check:diseno` en verde (ningún hallazgo nuevo; si resolviste
deuda, `-- --podar` y commitear `scripts/diseno-deuda.json` en el mismo
commit). Si no pasa, la tarea no está cerrada. Después borrá los JSON del temp.

En DICO, los números van al HANDOFF vía `/cerrardico`. Push a `main` publica
producción en `divianco.app`: no se pushea sin OK explícito de Ricky.

## Requisitos

En `hermes-gastro`:

```bash
npm run skills:diseno        # baja impeccable y design-taste-frontend fijadas a un commit
npm install --include=dev    # el detector `impeccable` es devDependency
```

Las dos skills de terceros quedan en `.claude/skills/` pero están en
`.gitignore`: el commit fijado vive en `scripts/instalar-skills-diseno.mjs`.

En un repo sin sistema de diseño, además:
`npm i -g ui-ux-pro-max-cli && uipro init --ai claude`.

Los subagentes `disenador` y `auditor-diseno` viven en `.claude/agents/`.
