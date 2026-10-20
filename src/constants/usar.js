// src/constants/usar.js
// Categorías USAR (Uniform System of Accounts for Restaurants) adaptadas
// a Dark Kitchen. Estos valores DEBEN coincidir con los CHECK constraints
// de la migration 20260527_usar_dark_kitchen.sql.
//
// Modelo unificado: estas son las únicas categorías. NO conviven con las
// libres del admin (las categorías legacy quedan en settings.ing_cats/exp_cats
// hasta que se confirme que el UI nuevo funciona, después se dropean).

/**
 * Categorías USAR para INGREDIENTES (tabla ingredients.food_category)
 * Reflejan el desglose del Food Cost en el P&L USAR.
 */
export const FOOD_CATEGORIES = [
  { value: 'protein',   label: 'Proteínas',  icon: '🥩', color: 'var(--ag-c-orders)',   short: 'Proteínas' },
  { value: 'dairy',     label: 'Lácteos',    icon: '🧀', color: 'var(--ag-c-stock)',    short: 'Lácteos' },
  { value: 'vegetable', label: 'Vegetales',  icon: '🥬', color: 'var(--ag-c-sales)',    short: 'Vegetales' },
  { value: 'dry',       label: 'Secos',      icon: '🌾', color: 'var(--ag-c-prep)',     short: 'Secos' },
  { value: 'beverage',  label: 'Bebidas',    icon: '🥤', color: '#4f8ec4',              short: 'Bebidas' },
  { value: 'packaging', label: 'Packaging',  icon: '📦', color: 'var(--ag-ink-3)',      short: 'Packaging' },
];

export const FOOD_CATEGORY_MAP = Object.fromEntries(FOOD_CATEGORIES.map(c => [c.value, c]));

/**
 * Helpers
 */
export function getFoodCategory(value) {
  return FOOD_CATEGORY_MAP[value] || FOOD_CATEGORY_MAP['dry'];
}

/**
 * Categorías USAR para GASTOS (tabla expenses.usar_category)
 * Agrupadas en COGS / Labor / OPEX para mostrar en P&L estructurado.
 */
export const USAR_EXPENSE_CATEGORIES = [
  // ── COGS ─────────────────────────────────────────────────────────
  { value: 'food_protein',        label: 'Comida — Proteínas',  group: 'COGS' },
  { value: 'food_dairy',          label: 'Comida — Lácteos',    group: 'COGS' },
  { value: 'food_vegetable',      label: 'Comida — Vegetales',  group: 'COGS' },
  { value: 'food_dry',            label: 'Comida — Secos',      group: 'COGS' },
  { value: 'food_beverage',       label: 'Comida — Bebidas',    group: 'COGS' },
  { value: 'packaging',           label: 'Packaging',           group: 'COGS' },
  // ── LABOR ────────────────────────────────────────────────────────
  { value: 'labor_boh',           label: 'Personal de cocina', group: 'Labor' },
  // ── OPEX ─────────────────────────────────────────────────────────
  { value: 'marketing',           label: 'Marketing digital',   group: 'OPEX' },
  { value: 'commission_delivery', label: 'Comisiones delivery', group: 'OPEX' },
  { value: 'rent',                label: 'Alquiler',            group: 'OPEX' },
  { value: 'utilities',           label: 'Servicios',           group: 'OPEX' },
  { value: 'other_opex',          label: 'Otros',               group: 'OPEX' },
];

export const USAR_EXPENSE_MAP = Object.fromEntries(
  USAR_EXPENSE_CATEGORIES.map(c => [c.value, c])
);

export function getUsarExpense(value) {
  return USAR_EXPENSE_MAP[value] || USAR_EXPENSE_MAP['other_opex'];
}

/**
 * Una compra de insumos es inventario, no gasto: lo que cuesta es lo vendido
 * (costo segun recetas), y sumarla tambien como gasto es doble conteo.
 * register_purchase la marca con category 'Materia Prima' y usar_category
 * null (0031); el legacy, con usar_category food_* o packaging.
 * Mismo criterio que resultado_del_dia (0108): tienen que coincidir.
 */
export function esCompraDeInsumos(e) {
  if (!e) return false;
  if (e.category === 'Materia Prima') return true;
  const usar = e.usar_category;
  return typeof usar === 'string' && (usar.startsWith('food_') || usar === 'packaging');
}

/**
 * Targets por defecto (mirror del default del schema settings.usar_targets)
 */
export const DEFAULT_USAR_TARGETS = {
  food_cost_pct: 30,
  packaging_pct: 5,
  labor_pct: 20,
  marketing_pct: 5,
  target_ebitda_pct: 15,
};
