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

/** Primera regla vigente que aplica al producto (categoria) y cuyo producto existe. */
export function sugerenciaParaProducto(reglas, producto, productos, ahora) {
  return (reglas || []).find((r) =>
    Array.isArray(r.when_categories) && r.when_categories.includes(producto.category)
    && r.add_product_id !== producto.id
    && reglaVigente({ ...r, active: true }, ahora)
    && productos.some((p) => p.id === r.add_product_id)) || null;
}
