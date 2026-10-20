import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { RecipeCardInputSchema, ProductAllergensInputSchema } from '../lib/schemas/index.js';

export const SELECT_COLS = 'id, tenant_id, product_id, yield_qty, yield_unit, time_minutes, steps, notes, visible_to, is_archived, updated_by, created_at, updated_at';
const uuid = z.string().uuid();

function identifiers(tenantId, productId) {
  uuid.parse(tenantId);
  if (productId !== undefined) uuid.parse(productId);
}

function result(data, error, operation) {
  if (error) throw Object.assign(new Error(`${operation}: ${error.message}`), { cause: error, code: error.code });
  if (data === null || data === undefined) throw new Error(`${operation}: respuesta sin datos`);
  return data;
}

/** Incluye archivadas; RLS decide cuales puede leer la persona. Errores rechazan. */
export async function fetchRecipeCards(tenantId) {
  identifiers(tenantId);
  const { data, error } = await supabase.from('recipe_cards').select(SELECT_COLS)
    .eq('tenant_id', tenantId).order('product_id');
  return result(data, error, 'fetchRecipeCards');
}

/** Reemplaza la ficha completa. IDs y sellos no se aceptan dentro de input. */
export async function saveRecipeCard(tenantId, productId, input) {
  identifiers(tenantId);
  uuid.parse(productId);
  const fields = RecipeCardInputSchema.parse(input);
  const { data, error } = await supabase.from('recipe_cards')
    .upsert({ ...fields, tenant_id: tenantId, product_id: productId }, { onConflict: 'product_id' })
    .select(SELECT_COLS).single();
  return result(data, error, 'saveRecipeCard');
}

/** Alérgenos viven en products; esta operacion es independiente de guardar la ficha. */
export async function saveProductAllergens(tenantId, productId, input) {
  identifiers(tenantId);
  uuid.parse(productId);
  const fields = ProductAllergensInputSchema.parse(input);
  const { data, error } = await supabase.from('products').update(fields)
    .eq('tenant_id', tenantId).eq('id', productId).select('id, tenant_id, allergens').single();
  return result(data, error, 'saveProductAllergens');
}

/** Lineas product_ingredients con qty numerico; no muta ni redondea las originales. */
export function scaleRecipeIngredients(lines, base, target) {
  z.number().finite().positive().parse(base);
  z.number().finite().nonnegative().parse(target);
  z.array(z.object({ qty: z.number().finite().nonnegative() }).passthrough()).parse(lines);
  return lines.map(line => {
    const qty = line.qty * (target / base);
    if (!Number.isFinite(qty)) throw new RangeError('Cantidad escalada fuera de rango');
    return { ...line, qty };
  });
}
