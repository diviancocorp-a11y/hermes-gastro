import { useCallback, useMemo } from "react";
import { todayISO, OrderStatus } from "../lib/utils";

/**
 * useFinancials — Métricas financieras del dashboard admin.
 *
 * Modelo de costos:
 *  - Costo Materia Prima Bruto: Σ (precio_ingrediente × cantidad_usada)
 *  - Costo Real con Merma     : Costo Bruto × (1 + waste_pct/100)
 *  - Gastos Fijos             : alquiler, servicios, sueldos, seguros (expense_type='fixed')
 *  - Gastos Variables Otros   : packaging, transporte, comisiones (expense_type='variable')
 *  - Margen Bruto             : Ventas − Costo Real
 *  - Resultado Operativo      : Margen Bruto − Gastos Fijos − Gastos Variables Otros − Merma Cargada
 *
 * El waste_pct es una proyección estándar (5% default). Si la merma
 * cargada manualmente excede esa proyección, indica que el % está bajo
 * (sugerir ajustarlo en settings).
 */
export default function useFinancials({ ings, recs, sales, exps, orders, waste, settings }) {
  // % merma global (default 5%, validado entre 0-100)
  const wastePct = useMemo(() => {
    const pct = Number(settings?.waste_pct);
    if (!Number.isFinite(pct) || pct < 0) return 5;
    return Math.min(100, pct);
  }, [settings?.waste_pct]);

  const wasteFactor = 1 + wastePct / 100;

  // Costo materia prima del producto SIN merma (interno, para referencia)
  const calculateRecipeRawCost = useCallback(rec => {
    if (!rec?.ingredients) return 0;
    return rec.ingredients.reduce((sum, ri) => {
      const ig = ings.find(i => i.id === ri.ingredient_id);
      return sum + (ig ? (ig.cost || 0) * (ri.quantity || 0) : 0);
    }, 0);
  }, [ings]);

  // Costo real CON merma — lo que usan los componentes para mostrar costo/margen
  const calculateRecipeCost = useCallback(rec => {
    return calculateRecipeRawCost(rec) * wasteFactor;
  }, [calculateRecipeRawCost, wasteFactor]);

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

  // Costo de producción REAL del mes (con merma proyectada)
  const monthProductionCost = useMemo(
    () => monthProductionCostRaw * wasteFactor,
    [monthProductionCostRaw, wasteFactor]
  );

  // Costo de la merma cargada manualmente en stock (vencimientos, roturas, derrames)
  const monthWasteCost = useMemo(
    () => waste.filter(w => w.date >= monthStart).reduce((a, w) => {
      const ig = ings.find(i => i.id === w.ingredient_id);
      return a + ((ig?.cost || 0) * (w.qty || 0));
    }, 0),
    [waste, ings, monthStart]
  );

  // Gastos del mes separados por tipo
  const monthExpensesByType = useMemo(() => {
    const fixed = exps.filter(e => e.date >= monthStart && e.expense_type === 'fixed').reduce((a, e) => a + (e.amount || 0), 0);
    // Explícito: solo cuenta 'variable'. Si el gasto tiene null/undefined no se suma a ningún bucket
    // (la migration auto-clasificó los existentes; los nuevos siempre tienen valor por el form).
    const variable = exps.filter(e => e.date >= monthStart && e.expense_type === 'variable').reduce((a, e) => a + (e.amount || 0), 0);
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

    // Aliases back-compat
    monthExpenses,               // total fixed + variable
    monthProfit,                 // = monthOperatingResult
    profitMargin,                // = operatingMarginPct
  };
}
