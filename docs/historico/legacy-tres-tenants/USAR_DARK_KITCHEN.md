# USAR Dark Kitchen — Diseño contable y operativo

Documento de diseño previo a implementación. Define cómo evoluciona Hermes Gastro hacia el estándar **Uniform System of Accounts for Restaurants (USAR/USALI)**, **adaptado al modelo Dark Kitchen** (cocina oculta sin salón).

> Estado: diseño aprobado, pendiente implementación. Las tablas y métricas descritas acá NO existen todavía en el sistema actual.

---

## 1. Por qué USAR y por qué adaptarlo

USAR es el estándar contable internacional usado por la industria gastronómica para reportar P&L de manera comparable entre operaciones. Como Hermes Gastro opera **3 dark kitchens** (LNP, Cochi, Mala Miga) — sin salón físico, sin meseros, 100% delivery — el USAR estándar no aplica tal cual: hay que adaptar la estructura.

**Lo que NO necesitamos** del USAR clásico:
- Front of House (FOH) labor (no hay salón)
- Tip declaration (no hay propinas estructurales)
- Cover/seat metrics (no hay capacity de mesa)
- Beverage program complejo (bar)

**Lo que SÍ necesitamos** (foco dark kitchen):
- Revenue por **canal de delivery** (Rappi/PedidosYa/UberEats/WhatsApp/Mostrador)
- **Gross Order Value** registrado ANTES de deducciones de plataforma
- **Comisiones de delivery** como línea separada (15–30% del bruto)
- **Food Cost** subdividido (Proteínas / Lácteos / Vegetales / Secos / Bebidas)
- **Packaging** como parte del COGS (no como gasto general)
- **Labor 100% BOH** (Back of House: cocina + ensamblaje + despacho)
- **Margen de contribución real** = lo que queda después de comisiones + costo directo

---

## 2. Modelo conceptual

### 2.1 Una marca por negocio (no multi-marca)

Cada Supabase representa **una marca única**. LNP es solo LNP, Cochi solo Cochi, etc. No hay multi-marca cohabitando un mismo Supabase.

### 2.2 Multi-canal dentro de cada marca

Cada marca vende por múltiples canales simultáneamente:

| Canal | Comisión típica | Notas |
|---|---|---|
| Rappi | 18–25% | Mayor volumen, mayor comisión |
| PedidosYa | 15–22% | Comisión media |
| UberEats | 25–30% | Comisión alta |
| WhatsApp (canal propio) | 0% | Sin comisión, pero requiere logística propia |
| Mostrador (retiro en cocina) | 0% | Sin envío |

### 2.3 P&L objetivo (estructura USAR dark kitchen)

```
Ingreso Bruto (Gross Order Value)
  − Comisiones de plataforma
= Ingreso Neto
  − COGS:
    − Food Cost (Proteínas + Lácteos + Vegetales + Secos + Bebidas)
    − Packaging
= Margen Bruto
  − Labor Cost (BOH: cocina + ensamblaje + despacho + cargas sociales)
  − OPEX directo:
    − Marketing digital (pauta en apps + redes)
    − Otros OPEX (servicios, alquiler de cocina, seguros)
= Resultado Operativo (EBITDA)
```

### 2.4 Targets de referencia (dark kitchen sano)

| Línea | Target % sobre Ingreso Bruto |
|---|---|
| Food Cost | ≤ 30% |
| Packaging | ~ 5% |
| Labor BOH | ~ 20% |
| Comisiones delivery (mix) | 15–25% |
| Marketing | 3–7% |
| Otros OPEX | 5–10% |
| **EBITDA esperado** | **10–20%** |

> Estos targets se configuran por negocio en `settings.usar_targets`.

---

## 3. Cambios al schema de DB

### 3.1 Tabla `orders` — nuevas columnas

```sql
ALTER TABLE public.orders
  ADD COLUMN delivery_channel        text,         -- 'rappi' | 'pedidosya' | 'ubereats' | 'whatsapp' | 'mostrador' | 'web_own'
  ADD COLUMN gross_amount            numeric(12,2), -- lo que paga el cliente final
  ADD COLUMN platform_commission_pct numeric(5,2),  -- % aplicado al gross
  ADD COLUMN platform_commission_amt numeric(12,2), -- monto absoluto
  ADD COLUMN net_amount              numeric(12,2);  -- gross - commission
```

Mapeo con lo actual:
- `total` ≈ `gross_amount` (lo que cobramos)
- `net_amount` = `gross_amount - platform_commission_amt` (lo que entra a caja)

### 3.2 Tabla `expenses` — categorización USAR

Hoy `expenses.expense_type` es solo `fixed | variable`. Necesitamos sub-categorías USAR:

```sql
ALTER TABLE public.expenses
  ADD COLUMN usar_category text;   -- 'food_protein' | 'food_dairy' | 'food_vegetable' | 'food_dry' | 'food_beverage' | 'packaging' | 'labor_boh' | 'marketing' | 'commission_delivery' | 'rent' | 'utilities' | 'other_opex'
```

> Las comisiones de delivery NO se cargan como expense manualmente — se calculan automáticamente desde `orders.platform_commission_amt`.

### 3.3 Tabla `ingredients` — categorización Food Cost

Hoy `ingredients.category` es texto libre. Para que el reporte USAR funcione, necesitamos mapear cada ingrediente a una de las 5 categorías food:

```sql
ALTER TABLE public.ingredients
  ADD COLUMN food_category text;  -- 'protein' | 'dairy' | 'vegetable' | 'dry' | 'beverage' | 'packaging'
```

El admin asigna la categoría food al crear el ingrediente. Default = `dry` para el bulk migrate inicial.

### 3.4 Tabla `settings` — targets USAR

```sql
ALTER TABLE public.settings
  ADD COLUMN usar_targets jsonb DEFAULT '{
    "food_cost_pct": 30,
    "packaging_pct": 5,
    "labor_pct": 20,
    "marketing_pct": 5,
    "target_ebitda_pct": 15
  }';
```

### 3.5 Tabla nueva `delivery_channels`

Para que el admin pueda configurar comisiones por canal sin hardcodearlas:

```sql
CREATE TABLE public.delivery_channels (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            text UNIQUE NOT NULL,           -- 'rappi'
  label           text NOT NULL,                  -- 'Rappi'
  commission_pct  numeric(5,2) DEFAULT 0,         -- 22.5
  is_active       boolean DEFAULT true,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);
```

Seed inicial:

```sql
INSERT INTO public.delivery_channels (slug, label, commission_pct) VALUES
  ('rappi',     'Rappi',     22.0),
  ('pedidosya', 'PedidosYa', 20.0),
  ('ubereats',  'Uber Eats', 28.0),
  ('whatsapp',  'WhatsApp',   0.0),
  ('mostrador', 'Mostrador',  0.0),
  ('web_own',   'Web propia', 0.0);
```

---

## 4. Cambios al UI admin

### 4.1 Sales / Orders

**En la card de cada pedido**:
- Selector de **Canal** (dropdown con `delivery_channels.label`)
- Si el canal tiene comisión > 0%, calcular automáticamente `platform_commission_amt = gross * pct`
- Mostrar `Bruto / Comisión / Neto` desglosado

### 4.2 Configuración → Finanzas → Targets USAR

Sub-page nueva donde el admin edita los targets % de la sección 2.4.

### 4.3 Configuración → Finanzas → Canales de delivery

Sub-page donde el admin edita la tabla `delivery_channels`: agregar/quitar canales, ajustar % de comisión por canal.

### 4.4 Stock → Categoría Food

Al crear/editar un ingrediente, agregar dropdown **"Categoría USAR"** con las 5 opciones food + packaging. Esto pinta la columna `ingredients.food_category`.

### 4.5 Home / MonthSummary → P&L USAR

Reemplazar el actual breakdown de "Ventas / Gastos / Ganancia" por un P&L estilo USAR:

```
INGRESOS POR CANAL
  Rappi          $XXX  (50%)
  PedidosYa      $XXX  (30%)
  WhatsApp       $XXX  (20%)
  ───────────────
  Ingreso Bruto  $XXX

DEDUCCIONES
  Comisiones    -$XXX  (-18%)
  ───────────────
  Ingreso Neto   $XXX

COGS
  Food Cost     -$XXX  (-28%)   ← color verde si ≤ target (30%)
    Proteínas    $XXX
    Lácteos      $XXX
    Vegetales    $XXX
    Secos        $XXX
    Bebidas      $XXX
  Packaging     -$XXX  (-5%)
  ───────────────
  Margen Bruto   $XXX  (52%)

LABOR
  Labor BOH     -$XXX  (-19%)   ← color verde si ≤ target (20%)

OPEX
  Marketing     -$XXX
  Otros OPEX    -$XXX
  ───────────────
  EBITDA         $XXX  (12%)   ← color verde si ≥ target (15%)
```

Cada línea con color semáforo según target.

---

## 5. Migration plan (fases)

### Fase A — Foundation (1 sesión, no breaking)

1. Aplicar migration `20260527_usar_dark_kitchen.sql` con todos los `ALTER TABLE` y la tabla `delivery_channels` en los 3 Supabase
2. Seed inicial de `delivery_channels`
3. Default `food_category = 'dry'` en todos los ingredients existentes
4. Default `usar_category = 'other_opex'` en expenses existentes
5. Default `delivery_channel = 'whatsapp'` en orders históricos (porque hoy todo es WhatsApp/mostrador)

### Fase B — UI de captura (1 sesión)

1. Stock: dropdown food_category en form de ingredients
2. Orders: dropdown channel + cálculo auto de comisión
3. Settings → Canales de delivery (CRUD de la tabla)
4. Settings → Targets USAR

### Fase C — Reportes (1–2 sesiones)

1. Nuevo componente `<UsarPnL />` en MonthSummary
2. Cálculos derivados:
   - Sumas de orders por channel
   - Sumas de expenses por usar_category
   - Cálculos % sobre gross
   - Semáforos según targets
3. Charts: composición de ingresos por canal, evolución mensual de food cost %

### Fase D — Hardening (opcional, post-MVP)

1. Validaciones: si food_category es null en ingredient activo, alerta en stock
2. Trigger DB que actualice `expenses.usar_category` cuando cambias ingredients
3. Comisiones automáticas: si una order tiene channel=rappi y la cocina paga la comisión por separado, registrar como expense `usar_category=commission_delivery`
4. Sub-margen por plato: cada `recipe` tiene su food_cost_calculado / sale_price → ranking de platos rentables

---

## 6. Decisiones abiertas

| Decisión | Opciones | Recomendación |
|---|---|---|
| ¿La comisión se cobra en cash o se descuenta del payout? | Algunos canales cobran semanal, otros descuentan online | Modelar como `negative inflow` en payouts, no como expense |
| ¿Costo de delivery propio (motoqueros) va a Labor o Marketing? | Estándar USAR lo pone en Distribution Cost | Crear sub-categoría `labor_delivery_own` |
| ¿Reportar moneda local o USD? | Pesos por defecto | Pesos + opcional dual con tipo de cambio del día |
| ¿Sub-categorías food custom por negocio? | Algunos tienen "Bebidas alcohólicas" separado | Mantener 5 fijas en MVP, agregar `food_subcategory` text libre |

---

## 7. Roadmap de implementación

```
[Hoy]
  ✓ Doc aprobado (este archivo)

[Próxima sesión]
  ☐ Fase A — migrations en LNP + Cochi + Mala Miga
  ☐ Fase B.1 — Stock form con food_category

[Sesión +2]
  ☐ Fase B.2 — Orders con channel + comisión
  ☐ Fase B.3 — Settings: canales + targets USAR

[Sesión +3]
  ☐ Fase C — Reporte P&L USAR en MonthSummary

[Sesión +4]
  ☐ Fase D — hardening + ranking de platos rentables

[Post-MVP]
  ☐ Integración con APIs de delivery (Rappi, PedidosYa) para ingestar orders automático
  ☐ Conciliación automática de payouts vs orders registradas
```

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Admin no carga food_category en cada ingrediente | Default 'dry' + alerta en Stock si tiene null |
| Reportes complejos confunden al admin | Vista resumida (Home) + drill-down opcional (MonthSummary) |
| Comisiones varían entre semanas | Permitir override manual de comisión por order |
| Orders históricas sin channel | Bulk update con valor 'whatsapp' o 'mostrador' según volumen |
| Cambios de target_pct invalidan reportes pasados | Targets son históricos: snapshot al momento del cálculo |

---

## 9. Glosario rápido

- **USAR / USALI**: Uniform System of Accounts for Restaurants / Lodging Industry. Estándar contable IBI/AHLA.
- **Dark Kitchen**: cocina sin atención al público. 100% delivery.
- **BOH**: Back of House. Cocina, prep, despacho.
- **FOH**: Front of House. Salón, mozos. **No aplica** en dark kitchen.
- **COGS**: Cost of Goods Sold. Costo directo del producto vendido.
- **EBITDA**: Earnings Before Interest, Taxes, Depreciation, Amortization. Resultado operativo antes de financieros.
- **Gross Order Value (GOV)**: monto bruto antes de cualquier deducción.
- **Net Amount**: lo que entra efectivamente a tu cuenta después de comisiones.
- **Margen de contribución**: cuánto sobra después de costos directos y comisiones, antes de overheads.
