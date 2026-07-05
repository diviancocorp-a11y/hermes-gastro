import { useCallback, useMemo } from "react";
import { todayISO, OrderStatus } from "../lib/utils";

/**
 * useFinancials — Métricas financieras del dashboard admin.
 *
 * Modelo de costos (fix doble conteo 12/jun):
 *  - PRICING por receta (calculateRecipeCost): costo bruto × (1 + merma% + gastos%).
 *    Los % proyectados (Costos proyectados en config Finanzas) son un colchón
 *    para que el margen por producto no mienta al fijar precios.
 *  - P&L del MES: solo datos REALES —
 *      Margen Bruto        = Ventas − Costo materia prima bruto
 *      Resultado Operativo = Margen Bruto − Gastos Fijos − Gastos Variables − Merma Cargada
 *    (antes el costo del mes también llevaba los % proyectados → la merma y
 *    los gastos se contaban DOS veces y la ganancia quedaba subestimada)
 */
export default function useFinancials({ ings, recs, sales, exps, orders, waste, settings }) {
  // % merma proyectada (default 5%, validado entre 0-100)
  const wastePct = useMemo(() => {
    const pct = Number(settings?.waste_pct);
    if (!Number.isFinite(pct) || pct < 0) return 5;
    return Math.min(100, pct);
  }, [settings?.waste_pct]);

  // % gastos operativos asignado a cada producto (default 0%)
  // Cubre costos indirectos: servicios, alquiler, sueldos, etc.
  const expensePct = useMemo(() => {
    const pct = Number(settings?.expense_pct);
    if (!Number.isFinite(pct) || pct < 0) return 0;
    return Math.min(100, pct);
  }, [settings?.expense_pct]);

  // Multiplicador único — sumar ambos porcentajes al costo base.
  // Ej: merma 5% + gastos 12% → factor 1.17 (costo real = base × 1.17)
  const costFactor = 1 + (wastePct + expensePct) / 100;

  // Indice id -> receta, para resolver sub-recetas de combos sin O(n) por lookup
  const recipeById = useMemo(() => {
    const m = new Map();
    (recs || []).forEach(r => { if (r?.id != null) m.set(r.id, r); });
    return m;
  }, [recs]);

  // Costo materia prima de una receta NORMAL (solo ingredientes propios)
  const ingredientCost = useCallback(rec => {
    if (!rec?.ingredients) return 0;
    return rec.ingredients.reduce((sum, ri) => {
      const ig = ings.find(i => i.id === ri.ingredient_id);
      return sum + (ig ? (ig.cost || 0) * (ri.quantity || 0) : 0);
    }, 0);
  }, [ings]);

  // Costo materia prima del producto SIN ajustes (interno, para referencia).
  // Combos: no tienen ingredientes propios; su costo es la suma de las
  // sub-recetas que agrupan × la cantidad que trae el combo (costeo
  // simplificado — cada sub-receta ya costea su propia unidad). Antes esto
  // daba 0 porque solo se miraban rec.ingredients.
  const calculateRecipeRawCost = useCallback(rec => {
    if (!rec) return 0;
    if (rec.is_combo) {
      const items = rec.comboItems || [];
      return items.reduce((sum, ci) => {
        const sub = recipeById.get(ci.sub_recipe_id);
        if (!sub) return sum;
        // Sub-receta que a su vez es combo: 1 nivel de recursion controlada
        const subCost = sub.is_combo
          ? (sub.comboItems || []).reduce((s, x) => {
              const inner = recipeById.get(x.sub_recipe_id);
              return s + (inner && !inner.is_combo ? ingredientCost(inner) * (x.qty || 0) : 0);
            }, 0)
          : ingredientCost(sub);
        return sum + subCost * (ci.qty || 0);
      }, 0);
    }
    return ingredientCost(rec);
  }, [ingredientCost, recipeById]);

  // Costo real CON merma + gastos — lo que usan los componentes para
  // mostrar costo/margen real al usuario.
  const calculateRecipeCost = useCallback(rec => {
    return calculateRecipeRawCost(rec) * costFactor;
  }, [calculateRecipeRawCost, costFactor]);

  // Insumos con stock bajo
  const lowStockIngredients = useMemo(
    () => ings.filter(i => (i.stock || 0) <= (i.min_stock || 0)),
    [ings]
  );

  // Pedidos activos (no completados ni cancelados)
  const activeOrders = useMemo(
    () => orders.filter(o => [OrderStatus.NEW, OrderStatus.PREPARING, OrderStatus.ACTIVE].includes(o.status)),
    [orders]
  );

  // Mes en curso
  const monthStart = todayISO().slice(0, 7) + "-01";

  // Rango del mes anterior (para comparativas en KPIs)
  const { prevMonthStart, prevMonthEnd } = useMemo(() => {
    const ym = todayISO().slice(0, 7); // YYYY-MM
    const [yy, mm] = ym.split("-").map(Number);
    const prev = new Date(yy, mm - 2, 1);
    const start = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;
    // End = día anterior al monthStart actual
    const cur = new Date(yy, mm - 1, 1);
    const endDate = new Date(cur.getTime() - 86400000);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
    return { prevMonthStart: start, prevMonthEnd: end };
  }, []);

  // Ventas del mes
  const monthSales = useMemo(
    () => sales.filter(s => s.date >= monthStart).reduce((a, x) => a + (x.total || 0), 0),
    [sales, monthStart]
  );

  // Costo de producción BRUTO del mes (sin merma) — referencia interna
  const monthProductionCostRaw = useMemo(
    () => sales.filter(s => s.date >= monthStart).reduce((a, x) => {
      if (x.unit_cost != null && x.unit_cost > 0) return a + (x.unit_cost * (x.qty || 1));
      const r = recs.find(r2 => r2.id === x.recipe_id);
      return a + (r ? calculateRecipeRawCost(r) * (x.qty || 1) : 0);
    }, 0),
    [sales, recs, calculateRecipeRawCost, monthStart]
  );

  // Costo de producción del mes — REAL, sin proyecciones (fix 12/jun).
  // El costFactor (merma % + gastos %) es un colchón de PRICING por receta:
  // aplicarlo aca Y ademas restar la merma cargada y los gastos reales era
  // DOBLE CONTEO — la ganancia del mes quedaba subestimada. El P&L mensual
  // usa solo datos reales: materia prima cruda + merma cargada + gastos.
  const monthProductionCost = monthProductionCostRaw;

  // Costo de la merma cargada manualmente en stock (vencimientos, roturas, derrames)
  const monthWasteCost = useMemo(
    () => waste.filter(w => w.date >= monthStart).reduce((a, w) => {
      const ig = ings.find(i => i.id === w.ingredient_id);
      return a + ((ig?.cost || 0) * (w.qty || 0));
    }, 0),
    [waste, ings, monthStart]
  );

  // Gastos de COMIDA/envases (compras de materia prima) NO van al bucket de
  // gastos: ya estan reflejados en el costo de produccion (calculado de recetas).
  // Sumarlos aca era DOBLE CONTEO (fix jun 2026 — la ganancia mostrada quedaba
  // menor a la real). Se identifican por usar_category food_* / packaging.
  const isFoodExpense = (e) =>
    typeof e.usar_category === 'string' &&
    (e.usar_category.startsWith('food_') || e.usar_category === 'packaging');

  // Gastos del mes separados por tipo (excluyendo comida, ver arriba)
  const monthExpensesByType = useMemo(() => {
    const opEx = exps.filter(e => e.date >= monthStart && !isFoodExpense(e));
    const fixed = opEx.filter(e => e.expense_type === 'fixed').reduce((a, e) => a + (e.amount || 0), 0);
    // Explícito: solo cuenta 'variable'. Si el gasto tiene null/undefined no se suma a ningún bucket
    // (la migration auto-clasificó los existentes; los nuevos siempre tienen valor por el form).
    const variable = opEx.filter(e => e.expense_type === 'variable').reduce((a, e) => a + (e.amount || 0), 0);
    return { fixed, variable, total: fixed + variable };
  }, [exps, monthStart]);

  const monthFixedExpenses = monthExpensesByType.fixed;
  const monthVariableExpenses = monthExpensesByType.variable;
  const monthExpenses = monthExpensesByType.total; // Back-compat para cards existentes

  // Margen Bruto = Ventas − Costo Real (con merma)
  const monthGrossMargin = monthSales - monthProductionCost;
  const grossMarginPct = monthSales > 0 ? (monthGrossMargin / monthSales) * 100 : 0;

  // Resultado Operativo = Margen Bruto − Gastos Fijos − Gastos Variables Otros − Merma Cargada
  // (la merma cargada es pérdida REAL de stock no reflejada en producción)
  const monthOperatingResult = monthGrossMargin - monthFixedExpenses - monthVariableExpenses - monthWasteCost;
  const operatingMarginPct = monthSales > 0 ? (monthOperatingResult / monthSales) * 100 : 0;

  // Aliases para back-compat (Home.jsx, etc.)
  // Antes: monthProfit y profitMargin tenían fórmulas distintas (BUG). Ahora ambos usan el resultado real.
  const monthProfit = monthOperatingResult;
  const profitMargin = operatingMarginPct;

  // ─── Mes anterior (para comparativas) ────────────────
  const inPrevMonth = (d) => d >= prevMonthStart && d <= prevMonthEnd;

  const prevMonthSales = useMemo(
    () => sales.filter(s => inPrevMonth(s.date)).reduce((a, x) => a + (x.total || 0), 0),
    [sales, prevMonthStart, prevMonthEnd]
  );

  const prevMonthExpenses = useMemo(
    // Mismo criterio que el mes actual: comida/packaging fuera (vive en costo de produccion)
    () => exps.filter(e => inPrevMonth(e.date) && !isFoodExpense(e)).reduce((a, e) => a + (Number(e.amount) || 0), 0),
    [exps, prevMonthStart, prevMonthEnd]
  );

  const prevMonthProductionCostRaw = useMemo(
    () => sales.filter(s => inPrevMonth(s.date)).reduce((a, x) => {
      if (x.unit_cost != null && x.unit_cost > 0) return a + (x.unit_cost * (x.qty || 1));
      const r = recs.find(r2 => r2.id === x.recipe_id);
      return a + (r ? calculateRecipeRawCost(r) * (x.qty || 1) : 0);
    }, 0),
    [sales, recs, calculateRecipeRawCost, prevMonthStart, prevMonthEnd]
  );

  // Mismo criterio que el mes actual: costo real sin proyecciones (fix 12/jun)
  const prevMonthProductionCost = prevMonthProductionCostRaw;
  const prevMonthWasteCost = useMemo(
    () => waste.filter(w => inPrevMonth(w.date)).reduce((a, w) => {
      const ig = ings.find(i => i.id === w.ingredient_id);
      return a + ((ig?.cost || 0) * (w.qty || 0));
    }, 0),
    [waste, ings, prevMonthStart, prevMonthEnd]
  );

  const prevMonthGrossMargin = prevMonthSales - prevMonthProductionCost;
  const prevMonthProfit = prevMonthGrossMargin - prevMonthExpenses - prevMonthWasteCost;

  const prevMonthOrdersCount = useMemo(
    () => orders.filter(o => o.status !== OrderStatus.CANCELLED && inPrevMonth(o.date)).length,
    [orders, prevMonthStart, prevMonthEnd]
  );

  return {
    // Configuración
    wastePct,

    // Costos por receta
    calculateRecipeCost,        // CON merma (uso público)
    calculateRecipeRawCost,     // SIN merma (interno/análisis)

    // Operativo
    lowStockIngredients,
    activeOrders,

    // KPIs mes (nuevos)
    monthSales,
    monthProductionCost,         // costo real con merma
    monthProductionCostRaw,      // costo bruto sin merma (referencia)
    monthWasteCost,              // pérdida cargada manualmente
    monthFixedExpenses,
    monthVariableExpenses,
    monthGrossMargin,
    grossMarginPct,
    monthOperatingResult,
    operatingMarginPct,

    // Mes anterior (para deltas en KPIs)
    prevMonthSales,
    prevMonthExpenses,
    prevMonthProfit,
    prevMonthOrdersCount,

    // Aliases back-compat
    monthExpenses,               // total fixed + variable
    monthProfit,                 // = monthOperatingResult
    profitMargin,                // = operatingMarginPct
  };
}
