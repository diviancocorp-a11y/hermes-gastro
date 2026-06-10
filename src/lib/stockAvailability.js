// src/lib/stockAvailability.js
// Calculo client-side de disponibilidad de stock para el catalogo publico.
//
// Regla: una recipe esta AGOTADA solo si TIENE ingredientes declarados
// (recipe_ingredients no vacio) y ALGUN ingrediente requerido tiene
// stock < qty necesaria para 1 unidad. Recipes sin recetario cargado
// NUNCA se marcan agotadas (muchos clientes no cargan ingredientes —
// no queremos falsos "agotado").
//
// Combos (1 nivel): un combo esta agotado si alguna de sus recipes
// componentes (combo_items.sub_recipe_id) esta agotada por la regla base.
//
// NOTA Sprint 5: esto es solo UI/UX. El enforcement server-side de stock
// (validar en submit-order antes de aceptar el pedido) queda pendiente
// para Sprint 5 — un cliente con el catalogo abierto desde antes puede
// igual mandar un pedido de algo que se agoto en el medio.

/**
 * @param {Object} params
 * @param {Array}  params.recipes           - [{id, ...}] (opcional, solo limita el resultado)
 * @param {Array}  params.recipeIngredients - [{recipe_id, ingredient_id, qty}]
 * @param {Array}  params.ingredients       - [{id, stock}]
 * @param {Array}  params.comboItems        - [{recipe_id, sub_recipe_id, qty}]
 * @returns {Set<string>} ids de recipes agotadas
 */
export function computeAvailability({ recipes = [], recipeIngredients = [], ingredients = [], comboItems = [] } = {}) {
  const soldOut = new Set();

  // Mapa ingredient_id -> stock numerico
  const stockById = new Map();
  for (const ing of ingredients) {
    if (!ing || ing.id == null) continue;
    stockById.set(ing.id, Number(ing.stock) || 0);
  }

  // Agrupar recipe_ingredients por recipe_id
  const riByRecipe = new Map();
  for (const ri of recipeIngredients) {
    if (!ri || ri.recipe_id == null) continue;
    if (!riByRecipe.has(ri.recipe_id)) riByRecipe.set(ri.recipe_id, []);
    riByRecipe.get(ri.recipe_id).push(ri);
  }

  // Regla base: agotada si algun ingrediente declarado no alcanza para 1 unidad
  for (const [recipeId, rows] of riByRecipe) {
    for (const row of rows) {
      const required = Number(row.qty) || 0;
      if (required <= 0) continue; // qty invalida no bloquea
      // Ingrediente desconocido (no vino en el fetch) → no marcamos agotado
      if (!stockById.has(row.ingredient_id)) continue;
      if (stockById.get(row.ingredient_id) < required) {
        soldOut.add(recipeId);
        break;
      }
    }
  }

  // Combos (1 nivel): agotado si algun componente esta agotado
  const comboByRecipe = new Map();
  for (const ci of comboItems) {
    if (!ci || ci.recipe_id == null) continue;
    if (!comboByRecipe.has(ci.recipe_id)) comboByRecipe.set(ci.recipe_id, []);
    comboByRecipe.get(ci.recipe_id).push(ci);
  }
  for (const [comboId, items] of comboByRecipe) {
    if (soldOut.has(comboId)) continue;
    if (items.some(it => soldOut.has(it.sub_recipe_id))) soldOut.add(comboId);
  }

  // Si vino la lista de recipes visibles, limitamos el Set a esos ids
  // (evita arrastrar ids de recipes archivadas/ocultas).
  if (recipes.length > 0) {
    const visibleIds = new Set(recipes.map(r => r.id));
    for (const id of soldOut) {
      if (!visibleIds.has(id)) soldOut.delete(id);
    }
  }

  return soldOut;
}
