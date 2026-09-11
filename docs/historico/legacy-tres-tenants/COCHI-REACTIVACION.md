# COCHI — Pendientes al reactivar el proyecto Supabase

> cochi (`nzrzfknvlnddpexghynq`) esta **pausado** (Supabase free/pausa). Mientras
> este pausado no acepta conexiones (da `Connection timeout`), asi que las
> migraciones de DB **no se le pueden aplicar todavia**. LNP y mala-miga ya
> quedaron al dia. Este archivo junta TODO lo que hay que correrle a cochi
> cuando lo actives de nuevo.

## Como reactivar
1. Supabase Dashboard → proyecto **cochi** → **Restore/Resume project**.
2. Esperar a que quede `ACTIVE_HEALTHY`.
3. Aplicar las migraciones pendientes de abajo (en orden).
4. Verificar que el catalogo carga bien (que no caiga al `select` minimo por
   columna faltante).

---

## Migraciones pendientes

### 1) 2026-07-04 — `recipes.sold_out_override` (disponibilidad play/pause)
**Por que:** override manual de disponibilidad en catalogo por producto. Sin esta
columna, el `select` del catalogo (que ya la pide) falla y cae al **select minimo**
→ el catalogo de cochi pierde is_combo, descuentos, +18, vegetariano, etc. **Correr si o si.**

Archivo: `supabase/migrations/20260704_recipes_sold_out_override.sql`

```sql
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS sold_out_override boolean;
COMMENT ON COLUMN public.recipes.sold_out_override IS 'Override manual de disponibilidad en catalogo (play/pause). NULL=auto (regla de stock) - true=forzar disponible - false=forzar agotado.';
```

Aplicar con MCP:
`apply_migration(project_id="nzrzfknvlnddpexghynq", name="recipes_sold_out_override", query=<sql de arriba>)`

Verificar:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='recipes' AND column_name='sold_out_override';
-- debe devolver 1 fila
```

---

### 2) 2026-07-08 — matching de telefono por sufijo (`phone_key` + RPCs)
**Por que:** las RPCs `lookup_customer_by_phone` y `get_phone_customer_orders` matcheaban
el telefono de forma **exacta** y sobre `orders.customer_phone` (columna **vacia** — el
dato real esta en `orders.phone`). Resultado: el historial guest y el `order_count`
devolvian vacio, y un numero guardado en crudo (`3814123456`) no matcheaba con `549...`.
El fix agrega `phone_key()` (ultimos 10 digitos normalizados) y matchea por sufijo sobre
`COALESCE(orders.phone, orders.customer_phone)`. **Sin backfill.** LNP y mala-miga ya
quedaron aplicadas el 8/jul. Ademas el checkout ya guarda el telefono normalizado (549)
en origen — eso viaja en el codigo (push), pero el matching de cochi necesita esta
migracion para no fragmentar historial.

Archivo: `supabase/migrations/20260708_phone_match_by_suffix.sql`

Aplicar con MCP (correr el contenido completo del archivo):
`apply_migration(project_id="nzrzfknvlnddpexghynq", name="phone_match_by_suffix", query=<sql del archivo>)`

Verificar:
```sql
-- 1) el helper normaliza igual crudo/549/formateado
SELECT public.phone_key('3814123456') = public.phone_key('+54 9 381 412-3456') AS ok_norm; -- true
-- 2) las 3 funciones existen
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('phone_key','lookup_customer_by_phone','get_phone_customer_orders');
-- debe devolver 3 filas
```

---

## Lo que NO necesita accion por-tenant (ya viaja en el codigo)
Todo esto se deploya solo con el push a `main` (Vercel auto-deploy). No toca DB de cochi:

- **#1 Costeo de combos ≠ 0** — `calculateRecipeCost` ahora suma el costo de las
  sub-recetas × cantidad (antes daba $0). Trae `combo_items` global y muestra el
  desglose de sub-recetas en el detalle de la receta. Solo codigo.
- **#2 Decimales** — helper `formatQty` recorta el ruido de float (0.0072499… →
  0,00725) en el detalle/editor; la calculadora por tanda redondea a 6 decimales.
  Solo codigo.
- **#3 Override disponibilidad (UI)** — control Auto/Disponible/Agotado + badge
  "SIN STOCK" en el admin. La UI usa la columna `sold_out_override` → **por eso
  cochi necesita la migracion de arriba** para que funcione de punta a punta.
- **#4 Badge de oferta** — se saco el "Oferta" negro duplicado de la tarjeta; queda
  solo el de color (-% + Oferta) con la palabra "Oferta" en fondo negro para que
  resalte sobre la foto. Solo codigo.

## Checklist rapido post-reactivacion cochi
- [ ] Proyecto en `ACTIVE_HEALTHY`
- [ ] Migracion `recipes_sold_out_override` aplicada y verificada
- [ ] Migracion `phone_match_by_suffix` aplicada y verificada (3 funciones, `phone_key` normaliza)
- [ ] Catalogo carga con combos/descuentos/+18 (no cayo al select minimo)
- [ ] En admin: una receta sin stock muestra "SIN STOCK" y el boton Disponible la fuerza
