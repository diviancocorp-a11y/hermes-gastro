# Mapa de renombrado — Fase 2.1

## utils.jsx — Exports

| Antes | Después | Tipo | Archivos afectados |
|-------|---------|------|--------------------|
| `I` | `Icon` | Objeto de iconos SVG | Admin, Catalog, ProductCard, OrderSentView, Waste, Stock, Settings, Recipes, Orders, Home, Finance, Dialogs, CRM |
| `Ic` | `SvgIcon` | Componente base SVG (interno) | utils.jsx |
| `fi` | `formatInt` | Formato entero es-AR | Admin, Catalog, ProductCard, MyAccount, OrderSentView, Waste, Stock, Recipes, Orders, Home, Finance, CRM |
| `fm` | `formatMoney` | Formato decimal es-AR | Admin, Waste, Stock, Recipes, Finance |
| `td` | `todayISO` | Fecha de hoy YYYY-MM-DD | Admin, Waste, Orders, Home, Finance, CRM |
| `uid` | `generateId` | ID temporal único | Admin, Orders |
| `ST` | `OrderStatus` | Enum de estados de pedido | Admin, Orders, Home, Catalog (indirecto) |
| `ST_L` | `OrderStatusLabels` | Labels de estados | Orders |
| `ST_C` | `OrderStatusColors` | Colores de estados | Orders |
| `ST_B` | `OrderStatusBorders` | Bordes de estados | Orders |
| `saleCode` | `formatOrderCode` | Código corto de pedido | OrderTracker, MyAccount, OrderSentView, Orders, Finance |
| `imgOpt` | `optimizeImage` | Transform de imágenes Supabase | Catalog, ProductCard, MyAccount |
| `CAT_E` | `CategoryEmojis` | Emojis por categoría | utils.jsx (no importado externamente) |
| `CAT_CO` | `CategoryColors` | Colores de categoría | utils.jsx (no importado externamente) |
| `COLORS` | `BrandColors` | Paleta de colores del negocio | utils.jsx (no importado externamente) |
| `playNotif` | `playNotificationSound` | Sonido de notificación | Admin |

## Admin.jsx — Variables locales

| Antes | Después | Contexto |
|-------|---------|----------|
| `sett` | `settings` | Estado de configuración del negocio |
| `setSett` | `setSettings` | Setter de settings |
| `ov` | `overlay` | Estado de overlay/modal activo |
| `setOv` | `setOverlay` | Setter de overlay |
| `recs` | `recipes` | Estado de recetas |
| `setRecs` | `setRecipes` | Setter de recetas |
| `ings` | `ingredients` | Estado de ingredientes |
| `setIngs` | `setIngredients` | Setter de ingredientes |
| `exps` | `expenses` | Estado de gastos |
| `setExps` | `setExpenses` | Setter de gastos |
| `msg` | `showToast` | Función de notificación toast |
| `rc` | `calculateRecipeCost` | Calculadora de costo de receta |
| `DEF` | `DEFAULT_SETTINGS` | Valores por defecto de settings |
| `prev` | `previousOrderCount` | Ref del conteo previo de pedidos |
| `low` | `lowStockIngredients` | Ingredientes con stock bajo |
| `actOrd` | `activeOrders` | Pedidos activos (no completados/cancelados) |
| `mo` | `monthStart` | Primer día del mes actual |
| `tS` | `monthSales` | Total ventas del mes |
| `tE` | `monthExpenses` | Total gastos del mes |
| `tW` | `monthWasteCost` | Costo de merma del mes |
| `tCR` | `monthProductionCost` | Costo de producción del mes |
| `prof` | `monthProfit` | Ganancia del mes |
| `mar` | `profitMargin` | Margen de ganancia |
| `moveOrd` | `moveOrderStatus` | Función de transición de estado |
| `addOrd` | `addOrder` | Función para agregar pedido |
| `ch` | `realtimeChannel` | Canal de Supabase Realtime |
| `ns` | `nextStatus` | Siguiente estado del pedido |

## Componentes que reciben props renombradas

Los componentes hijos reciben las props con nombres cortos y deberán actualizarse:

| Componente | Props antes | Props después |
|------------|------------|---------------|
| Home | `low, tS, tE, tW, prof, mar, tCR, recs, ings, rc, actOrd, sett, waste` | `lowStockIngredients, monthSales, monthExpenses, monthWasteCost, monthProfit, profitMargin, monthProductionCost, recipes, ingredients, calculateRecipeCost, activeOrders, settings, waste` |
| Stock | `ings, setIngs, recs, ov, setOv, msg, sett, loadAll` | `ingredients, setIngredients, recipes, overlay, setOverlay, showToast, settings, loadAll` |
| Recipes | `recs, setRecs, ings, rc, ov, setOv, msg, loadAll` | `recipes, setRecipes, ingredients, calculateRecipeCost, overlay, setOverlay, showToast, loadAll` |
| Orders | `orders, recs, moveOrd, addOrd, ov, setOv, msg, sett` | `orders, recipes, moveOrderStatus, addOrder, overlay, setOverlay, showToast, settings` |
| Finance (SalesView) | `sales, setSales, orders, recs, rc, ov, setOv, msg` | `sales, setSales, orders, recipes, calculateRecipeCost, overlay, setOverlay, showToast` |
| Finance (Expenses) | `exps, setExps, sett, msg` | `expenses, setExpenses, settings, showToast` |
| Finance (Purchase) | `ings, setIngs, exps, setExps, sett` | `ingredients, setIngredients, expenses, setExpenses, settings` |
| CRM | `orders, recs, ings, msg` | `orders, recipes, ingredients, showToast` |
| Settings | `sett, setSett, msg` | `settings, setSettings, showToast` |
| CancelDlg | `order, recs, ings` | `order, recipes, ingredients` |
| StockWarningDlg | `deficits` | `deficits` (sin cambio) |
