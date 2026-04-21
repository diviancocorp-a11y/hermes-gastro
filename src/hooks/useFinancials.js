import { useCallback, useMemo } from "react";
import { todayISO, OrderStatus } from "../lib/utils";

/**
 * useFinancials — Computed financial metrics for the admin dashboard.
 */
export default function useFinancials({ ings, recs, sales, exps, orders, waste }) {
  // Recipe cost calculator
  const calculateRecipeCost = useCallback(rec => {
    if (!rec?.ingredients) return 0;
    return rec.ingredients.reduce((sum, ri) => {
      const ig = ings.find(i => i.id === ri.ingredient_id);
      return sum + (ig ? (ig.cost || 0) * (ri.quantity || 0) : 0);
    }, 0);
  }, [ings]);

  // Low stock ingredients
  const lowStockIngredients = useMemo(
    () => ings.filter(i => (i.stock || 0) <= (i.min_stock || 0)),
    [ings]
  );

  // Active orders (not completed or cancelled)
  const activeOrders = useMemo(
    () => orders.filter(o => [OrderStatus.new, OrderStatus.prep, OrderStatus.active].includes(o.status)),
    [orders]
  );

  // Month boundaries
  const monthStart = todayISO().slice(0, 7) + "-01";

  // Monthly sales total
  const monthSales = useMemo(
    () => sales.filter(s => s.date >= monthStart).reduce((a, x) => a + (x.total || 0), 0),
    [sales, monthStart]
  );

  // Monthly expenses total
  const monthExpenses = useMemo(
    () => exps.filter(e => e.date >= monthStart).reduce((a, e) => a + (e.amount || 0), 0),
    [exps, monthStart]
  );

  // Monthly production cost (uses snapshot unit_cost when available)
  const monthProductionCost = useMemo(
    () => sales.filter(s => s.date >= monthStart).reduce((a, x) => {
      if (x.unit_cost != null && x.unit_cost > 0) return a + (x.unit_cost * (x.qty || 1));
      const r = recs.find(r2 => r2.id === x.recipe_id);
      return a + (r ? calculateRecipeCost(r) * (x.qty || 1) : 0);
    }, 0),
    [sales, recs, calculateRecipeCost, monthStart]
  );

  // Monthly waste cost
  const monthWasteCost = useMemo(
    () => waste.filter(w => w.date >= monthStart).reduce((a, w) => {
      const ig = ings.find(i => i.id === w.ingredient_id);
      return a + ((ig?.cost || 0) * (w.qty || 0));
    }, 0),
    [waste, ings, monthStart]
  );

  // Monthly profit & margin
  const monthProfit = monthSales - monthExpenses;
  const profitMargin = monthSales > 0 ? ((monthSales - monthExpenses - monthWasteCost) / monthSales * 100) : 0;

  return {
    calculateRecipeCost,
    lowStockIngredients,
    activeOrders,
    monthSales,
    monthExpenses,
    monthProductionCost,
    monthWasteCost,
    monthProfit,
    profitMargin,
  };
}
