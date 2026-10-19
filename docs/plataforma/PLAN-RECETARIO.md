# Plan — Recetario digital para los tenants gastronómicos

> Estado: **plan aprobado, sin empezar** (19/oct/2026). Nada de esto está
> aplicado a la base ni en `src/`. Las 4 decisiones las tomó Ricky el 19/oct
> (al final) y ya están volcadas en las fases.

## Qué se quiere

Que el negocio tenga su recetario: el **cómo se hace** de cada cosa (pasos,
rinde, tiempos, notas, foto, alérgenos), cargado por el propio usuario y
consultable en el momento en que hace falta, con **seguridad por rol**: cada
ficha la ve solo quien corresponde.

Aplica a los tenants con rubro que usa receta (`usaReceta(vertical)` en
`src/modules/registry.js`): hoy **La Nona Pato** y **Crazy Miga**. No aplica a
Monare (sin módulo de recetas) ni a barbería/retail. No se escribe nada por
tenant: se activa por rubro.

## Lo que ya existe (medido el 19/oct con `npm run mapa` y la base)

- **La receta del edificio es costeo, no recetario.** `product_ingredients`
  (0028) guarda qué insumos y cuánto lleva cada producto, y la edita
  `RecipeEditor.jsx` dentro del formulario del producto. No tiene pasos, rinde,
  tiempos ni notas. La 0028 decidió no crear `recipes` para no tener dos
  catálogos: este plan respeta eso (la ficha cuelga del producto, no lo
  reemplaza).
- **Roles:** `tenant_members.roles[]` con `owner, manager, cashier, attendant,
  kitchen, marketer, accountant` (0050) y el helper
  `private.tiene_rol(tenant_id, roles[])`. La matriz del panel está en
  `src/modules/roles.js`; lo que no se declara para un rol es `nada`.
- **Agujero de permisos (confirmado contra `pg_policies`):** `ingredients` y
  `product_ingredients` tienen las 4 policies por **membresía**: cualquier
  empleado con sesión (mozo, cajero, marketing) puede, contra la API, cambiar
  cantidades de una receta, el costo de un insumo o borrarlos. Es el mismo
  hueco que la 0064 cerró en `products` y que no se extendió a estas dos
  tablas. Mientras siga abierto, cualquier seguridad por rol del recetario es
  de mentira.
- **Fotos:** el bucket `tenant-images` (0034) es **público**. Las fotos del
  recetario no pueden ir ahí.
- **Numeración:** la worktree `landing-rediseno` ya tiene `0100` y `0101` sin
  mergear. Este plan arranca en **0102**; revisar de nuevo antes de aplicar.

## Fases

Cada fase dice cómo se verifica. Ninguna se da por hecha sin esa evidencia.

### Fase 0 — Cerrar los permisos de insumos y recetas (prerrequisito)

Migración `0102_recetas_e_insumos_por_rol.sql`, mismo patrón que la 0064
(barrer todas las policies de la tabla antes de crear las nuevas, porque las
permisivas se combinan con OR).

| Tabla | select | insert / update | delete |
|---|---|---|---|
| `product_ingredients` | a definir (ver abajo) | owner, manager | owner, manager (el guardado es borrar + insertar, `platformRecipes.js:151`) |
| `ingredients` | miembros | a definir (ver abajo) | owner |

Antes de escribir el SQL, verificar:

1. **Quién lee `product_ingredients`.** `PlatformAdmin.jsx` llama a
   `fetchProductIngredients` y lo usan `VentasPanel`, `gestionProductos` y
   `modules/dico/reglas.js`. Si el mozo (ventas `PROPIO`) lo necesita para algo,
   el select no se puede recortar sin portar ese cálculo a una RPC. Si nadie
   fuera de owner/manager/kitchen lo necesita, se recorta a esos tres.
2. **Quién escribe `ingredients` además del dueño.** Cocina tiene stock
   `PROPIO`: confirmar si da de alta insumos o solo mueve stock (el stock se
   mueve por el libro desde la 0071/0098, por RPC). Si solo mueve stock, las
   escrituras directas quedan para owner/manager.
3. `check:expandir`: achicar policies no es drop de columna ni cambio de tipo,
   pero el deploy anterior tiene que seguir andando para owner/manager (es el
   único rol que escribe desde la UI).

**Verificación:** consultas por rol dentro de una transacción con `rollback`
(`set local role authenticated` + `request.jwt.claims` de un usuario de prueba
de cada rol): el mozo no puede `update product_ingredients` ni
`update ingredients set cost`; el encargado sí. Más `npm run check:rls` en
verde.

**Quién:** Ricky aprueba el SQL antes de aplicarlo (es la base). Aditivo por
MCP; si hay que borrar policies con `drop policy`, igual que la 0064 va en el
mismo archivo, pero si el MCP se cuelga lo aplica Ricky desde el panel.

### Fase 1 — Los datos del recetario

Migración `0103_recetario.sql`.

**Tabla `recipe_cards`** (la ficha técnica; una por producto):

| Columna | Tipo | Para qué |
|---|---|---|
| `id` | uuid pk | |
| `tenant_id` | uuid not null | RLS |
| `product_id` | uuid not null unique, fk `products` on delete cascade | la ficha cuelga del producto; los ingredientes y cantidades salen de `product_ingredients`, no se cargan dos veces |
| `yield_qty`, `yield_unit` | numeric, text | rinde (12 unidades, 2 kg): base para escalar |
| `time_minutes` | int | tiempo total |
| `steps` | jsonb not null default `'[]'` | `[{ texto, minutos?, temperatura? }]`, se edita entero |
| `notes` | text | conservación, trucos, punto |
| `photo_path` | text | ruta en el bucket privado |
| `visible_to` | text[] not null default `{owner,manager,kitchen}` | qué roles ven esta ficha; check: subconjunto de los 7 roles válidos |
| `is_archived` | bool | se archiva, no se borra |
| `updated_by`, `created_at`, `updated_at` | | quién la tocó por última vez |

**Policies:**

- `select`: miembro del tenant **y** (`tiene_rol(tenant_id, visible_to)` **o**
  `tiene_rol(tenant_id, '{owner}')`). El dueño ve todo siempre: una ficha que
  nadie puede abrir no se puede arreglar.
- `insert` / `update`: owner, manager.
- `delete`: owner (la UI archiva).

**Alérgenos en `products`, no en la ficha** (decisión 1): el mozo tiene que
verlos para contestarle al cliente, pero no puede abrir la ficha. Por eso van
como columna nueva `products.allergens text[]` (aditiva), que el mozo ya lee
(`products` es `LECTURA` para todos). Se cargan desde la ficha, pero se guardan
en el producto. No se suman a `get_catalog`: mostrarlos en el catálogo público
es una decisión aparte. Hay que agregarlos al Zod del producto y al manifest.

**`visible_to` controla pasos, notas y foto, no las cantidades** (decisión 2).
Las cantidades siguen en `product_ingredients` con el select que deje la fase
0. Una ficha `{owner}` esconde el cómo, no el cuánto. La receta secreta
completa queda para más adelante.

**Fotos:** bucket nuevo **privado** `recetario`, rutas
`<tenant_id>/<card_id>.webp`, policies de `storage.objects` con el mismo
criterio que la ficha, y el front pide URLs firmadas. Nunca `tenant-images`.

**Costos:** el recetario de cocina no muestra costo ni precio (nota 1 de la
matriz). La ficha no guarda costo, pero `ingredients.cost` y `products.price`
siguen legibles por API para la cocina, igual que hoy. Taparlo es otro
trabajo (privilegios por columna + RPC de costeo) y queda anotado, no se mezcla.

**Repo, en el mismo commit que la migración:**

- `RecipeCardInputSchema` en `src/lib/schemas/index.js` con **todas** las
  columnas editables (el bug de Zod que descarta campos ya pasó 4 veces),
  `scripts/db-columns-manifest.json`, `npm run schema:sync`.
- `src/services/recetario.js` y sumarlo a `PLATFORM_PATHS` de
  `check-supabase-columns.mjs`.
- Tests de servicio (`src/test/recetario.test.js`) y escalado de porciones
  como función pura (cantidad × porciones pedidas ÷ rinde).

**Verificación:** las mismas consultas por rol de la fase 0 sobre
`recipe_cards` y el bucket (mozo ve 0 fichas; cocina ve las suyas; una ficha
`{owner}` no le aparece al encargado), `npm run check:rls`,
`npm run check:definer`, `npm run check:expandir`, suite completa con
`--pool=threads`.

### Fase 2 — La pantalla (pasa por `/diseno`)

**Puerta antes que pantalla** (la memoria "pantalla publicada sin puerta"):
módulo `recetario` en `src/modules/registry.js` solo para rubros con receta, y
en la matriz de `roles.js`:

| Rol | recetario |
|---|---|
| owner, manager | `COMPLETO` |
| kitchen | `LECTURA` |
| resto | `nada` (no se declara) |

La matriz es navegación; la protección real es la RLS de la fase 1. Las dos
tienen que decir lo mismo.

**Qué tiene la pantalla:**

1. Lista buscable por nombre y categoría, con foto.
2. Ficha en modo lectura grande (cocina, tablet apoyada en la mesada):
   ingredientes con cantidades, **escalar** a N porciones o a una cantidad,
   pasos numerados que se van tildando, alérgenos, notas. Sin precio ni costo.
3. Edición (owner/manager): pasos, rinde, tiempo, notas, foto, alérgenos y el
   selector "quién la ve" con los roles del negocio
   (`rolesAsignables(vertical, modo)`).
4. Desde el KDS, tocar un plato del ticket abre su ficha.
5. Desde el editor de producto, un link "Ver/crear ficha": los ingredientes
   se siguen editando en `RecipeEditor`, no en dos lugares.
6. El mozo ve los alérgenos donde ya mira los productos (la toma del pedido),
   no en el recetario, que para él no existe.

**Línea de `/diseno` para esta pantalla:**

- Paso 0: autoridad de `docs/marca/` y tokens `--ag-*` del panel. **Sin
  `cp-root`** (ESLint lo rechaza en el admin).
- Paso 1: línea base `npx impeccable detect --json src index.html` al temp y
  `npm run pantalla -- recetario` en cuanto exista.
- Paso 2: una sola skill estética: **`impeccable`** (decisión 4). Es una
  excepción a lo que dice el orquestador para pantallas nuevas
  (`design-taste-frontend`), porque esa skill se declara "no para dashboards ni
  pantallas de app". Cuando el hook la sugiera, se ignora y se dice por qué.
- Pasos 4 y 5: `disenador` construye, `auditor-diseno` audita en solo lectura.
- Paso 6: medición antes/después y `npm run check:diseno` en verde.
- Trabajo en una rama; Ricky lo ve en el **preview de Vercel** desde el
  celular antes del push a `main`.

**Verificación:** con usuarios de prueba de cada rol en el preview: el mozo no
ve el módulo pero sí los alérgenos al tomar el pedido, la cocina lee y no
edita, el encargado no ve una ficha `{owner}`.
Captura del preview para Ricky.

### Fase 3 — Preparaciones internas (semielaborados)

Masa madre, salsas, rellenos: se hacen, se guardan y entran en otras recetas,
pero no se venden. Hoy no tienen dónde vivir, porque la ficha cuelga de un
producto y `products` es el catálogo.

Propuesta: un **insumo elaborado**. `ingredients` suma `is_prepared`, una tabla
`ingredient_components (ingredient_id, component_id, qty)` y la ficha pasa a
colgar de un producto **o** de un insumo elaborado (`product_id` o
`ingredient_id`, exactamente uno: es expandir, no rompe la fase 1). Gana el
costeo: el costo de la masa madre sale de sus componentes y entra solo en cada
pan. Es recursivo, con la misma complejidad que dejó afuera a los combos en
la 0028: por eso va después de la pantalla (decisión 3).

### Más adelante (no entra en este plan)

- Receta secreta completa: que una ficha `{owner}` esconda también sus
  cantidades (policy de select de `product_ingredients` con `not exists` de
  una ficha que el rol no puede ver).
- Alérgenos en el catálogo público (`get_catalog`).
- Historial de versiones de la ficha (quién cambió qué).
- Imprimir la ficha (ver memoria "imprimir desde el navegador").
- La mascota DICO respondiendo "¿cómo se hace X?" leyendo el recetario con
  los permisos de quien pregunta, cuando se conecte a la API de Claude.
- Esconder `ingredients.cost` y `products.price` a la cocina a nivel base.

## Decisiones (Ricky, 19/oct/2026)

1. **Quién ve el recetario:** dueño, encargado y cocina. El mozo ve solo los
   alérgenos, para contestarle al cliente → los alérgenos van en `products`.
2. **Recetas secretas con las cantidades incluidas: más adelante.** En la fase
   1, `visible_to` esconde pasos, notas y foto.
3. **Semielaborados: fase 3**, después de la pantalla, como insumo elaborado.
4. **Skill estética de la fase 2: `impeccable`**, como excepción a la regla del
   orquestador para pantallas nuevas.

## Puntos donde se frena por el ok de Ricky

| Paso | Por qué |
|---|---|
| Aplicar 0102 y 0103 | Es la base (aditivo por MCP; lo destructivo, desde el panel) |
| Código en `src/` | Cambia lo que ve un cliente |
| Push a `main` | Publica en `divianco.app`; antes, preview de Vercel |
