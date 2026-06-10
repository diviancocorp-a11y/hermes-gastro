import { describe, it, expect } from 'vitest';
import { computeAvailability } from '../lib/stockAvailability';

// Fixtures basicos: 2 ingredientes, 3 recipes, 1 combo
const ING_HARINA = { id: 'ing-harina', stock: 10 };
const ING_QUESO = { id: 'ing-queso', stock: 0 };

describe('computeAvailability', () => {
  it('recipe sin ingredientes declarados NUNCA se marca agotada', () => {
    const soldOut = computeAvailability({
      recipes: [{ id: 'r-sin-receta' }],
      recipeIngredients: [],
      ingredients: [ING_HARINA, ING_QUESO],
      comboItems: [],
    });
    expect(soldOut.has('r-sin-receta')).toBe(false);
    expect(soldOut.size).toBe(0);
  });

  it('recipe con stock suficiente para 1 unidad esta disponible', () => {
    const soldOut = computeAvailability({
      recipes: [{ id: 'r-pan' }],
      recipeIngredients: [
        { recipe_id: 'r-pan', ingredient_id: 'ing-harina', qty: 2 },
      ],
      ingredients: [ING_HARINA],
      comboItems: [],
    });
    expect(soldOut.has('r-pan')).toBe(false);
  });

  it('recipe con stock insuficiente en ALGUN ingrediente se marca agotada', () => {
    const soldOut = computeAvailability({
      recipes: [{ id: 'r-pizza' }],
      recipeIngredients: [
        { recipe_id: 'r-pizza', ingredient_id: 'ing-harina', qty: 2 },  // alcanza
        { recipe_id: 'r-pizza', ingredient_id: 'ing-queso', qty: 1 },   // stock 0 < 1
      ],
      ingredients: [ING_HARINA, ING_QUESO],
      comboItems: [],
    });
    expect(soldOut.has('r-pizza')).toBe(true);
  });

  it('combo con un componente agotado se marca agotado (1 nivel)', () => {
    const soldOut = computeAvailability({
      recipes: [{ id: 'r-pizza' }, { id: 'r-pan' }, { id: 'r-combo' }],
      recipeIngredients: [
        { recipe_id: 'r-pizza', ingredient_id: 'ing-queso', qty: 1 },  // agotada
        { recipe_id: 'r-pan', ingredient_id: 'ing-harina', qty: 1 },   // ok
      ],
      ingredients: [ING_HARINA, ING_QUESO],
      comboItems: [
        { recipe_id: 'r-combo', sub_recipe_id: 'r-pizza', qty: 1 },
        { recipe_id: 'r-combo', sub_recipe_id: 'r-pan', qty: 2 },
      ],
    });
    expect(soldOut.has('r-combo')).toBe(true);
    expect(soldOut.has('r-pan')).toBe(false);
  });

  it('combo con todos los componentes disponibles esta disponible', () => {
    const soldOut = computeAvailability({
      recipes: [{ id: 'r-pan' }, { id: 'r-combo' }],
      recipeIngredients: [
        { recipe_id: 'r-pan', ingredient_id: 'ing-harina', qty: 1 },
      ],
      ingredients: [ING_HARINA],
      comboItems: [
        { recipe_id: 'r-combo', sub_recipe_id: 'r-pan', qty: 2 },
      ],
    });
    expect(soldOut.has('r-combo')).toBe(false);
    expect(soldOut.size).toBe(0);
  });

  it('ingrediente desconocido (no fetcheado) no genera falso agotado', () => {
    const soldOut = computeAvailability({
      recipes: [{ id: 'r-x' }],
      recipeIngredients: [
        { recipe_id: 'r-x', ingredient_id: 'ing-fantasma', qty: 5 },
      ],
      ingredients: [ING_HARINA], // ing-fantasma no esta
      comboItems: [],
    });
    expect(soldOut.has('r-x')).toBe(false);
  });

  it('data vacia o ausente devuelve Set vacio (fail-open)', () => {
    expect(computeAvailability({}).size).toBe(0);
    expect(computeAvailability().size).toBe(0);
  });

  it('limita el resultado a los recipe ids visibles si se pasan recipes', () => {
    const soldOut = computeAvailability({
      recipes: [{ id: 'r-visible' }],
      recipeIngredients: [
        { recipe_id: 'r-visible', ingredient_id: 'ing-queso', qty: 1 },
        { recipe_id: 'r-archivada', ingredient_id: 'ing-queso', qty: 1 },
      ],
      ingredients: [ING_QUESO],
      comboItems: [],
    });
    expect(soldOut.has('r-visible')).toBe(true);
    expect(soldOut.has('r-archivada')).toBe(false);
  });
});
