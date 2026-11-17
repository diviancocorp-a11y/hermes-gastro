// Opciones por producto y sugerencias al pedir, lado catalogo.
//
// La logica es UNA sola: la de submit-order (platform/functions/submit-order/
// opciones.ts, pura y sin imports de Deno). Aca se reexporta para que lo que el
// cliente muestra y lo que el servidor valida no puedan divergir. El precio
// final igual lo recalcula el servidor: esto es solo la vista previa.
import { reglaVigente } from '../../platform/functions/submit-order/opciones.ts';

export {
  resolverOpciones, textoParaCocina, limpiarNota, reglaVigente, ahoraEnZona,
} from '../../platform/functions/submit-order/opciones.ts';

/** Estado de la ficha { [grupo]: { [choice]: qty } } -> [{groupId, choiceId, qty}]. */
export function seleccionDesdeEstado(estado) {
  return Object.entries(estado || {}).flatMap(([groupId, choices]) =>
    Object.entries(choices || {}).filter(([, qty]) => qty > 0)
      .map(([choiceId, qty]) => ({ groupId, choiceId, qty })));
}

/** Suma de extras para mostrar en vivo (sin validar: el boton ya valida). */
export function extrasDeSeleccion(grupos, seleccion) {
  let total = 0;
  for (const s of seleccion) {
    const choice = (grupos || []).find((g) => g.id === s.groupId)?.choices.find((c) => c.id === s.choiceId);
    total += (Number(choice?.price) || 0) * (Number(s.qty) || 1);
  }
  return Math.round(total * 100) / 100;
}

/** Limites efectivos de un grupo (mismos defaults que el servidor). */
export function limitesDeGrupo(g) {
  const n = g.choices.length;
  return {
    min: g.min ?? (g.required ? 1 : 0),
    max: g.max ?? (g.type === 'single' ? 1 : n),
  };
}

/** El producto tiene algun grupo que hay que elegir (required o min >= 1): no se agrega sin pasar por la ficha. */
export function requiereOpciones(producto) {
  const grupos = Array.isArray(producto?.option_groups) ? producto.option_groups : [];
  return grupos.some((g) => Array.isArray(g?.choices) && limitesDeGrupo(g).min >= 1);
}

/**
 * La sugerencia lista para sumar de un toque (agregar rapido): la regla, el
 * producto sugerido, su precio especial (nunca mayor al normal) y cuantas
 * unidades (max_per_item, igual que desde la ficha). null si no hay o si el
 * sugerido esta agotado. `precioDe(producto)` da el precio normal del dia.
 */
export function sugerenciaRapida(reglas, producto, productos, ahora, precioDe, agotados) {
  const rule = sugerenciaParaProducto(reglas, producto, productos, ahora);
  if (!rule) return null;
  const sugerido = productos.find((p) => p.id === rule.add_product_id);
  if (!sugerido || agotados?.has?.(sugerido.id)) return null;
  const normal = Number(precioDe(sugerido)) || 0;
  const unitPrice = rule.special_price != null ? Math.min(normal, Number(rule.special_price)) : normal;
  return { rule, product: sugerido, normal, unitPrice, qty: Math.max(1, rule.max_per_item || 1) };
}

/** Primera regla vigente que aplica al producto (categoria) y cuyo producto existe. */
export function sugerenciaParaProducto(reglas, producto, productos, ahora) {
  return (reglas || []).find((r) =>
    Array.isArray(r.when_categories) && r.when_categories.includes(producto.category)
    && r.add_product_id !== producto.id
    && reglaVigente({ ...r, active: true }, ahora)
    && productos.some((p) => p.id === r.add_product_id)) || null;
}
