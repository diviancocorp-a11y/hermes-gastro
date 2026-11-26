// src/lib/pedidoManual.js
// Pedido cargado a mano desde el panel (llego por WhatsApp, telefono o en el
// local). Puro, sin React: armar el carrito, validar el formulario y armar el
// cuerpo para submit-order. El precio final lo calcula submit-order, igual que
// en el catalogo: lo que se muestra aca es la vista previa.
import { resolverOpciones } from './opcionesPedido';
import { redondear } from './moneda';

/** Origenes que acepta submit-order. El pedido queda con channel 'manual_<id>'. */
export const ORIGENES_MANUALES = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'telefono', label: 'Teléfono' },
  { id: 'local', label: 'Local' },
];

/** Roles que pueden cargar un pedido a mano (los mismos que valida submit-order). */
export const ROLES_PEDIDO_MANUAL = ['owner', 'manager', 'cashier'];

export function puedeCargarPedidoManual(roles = []) {
  return (roles || []).some((r) => ROLES_PEDIDO_MANUAL.includes(r));
}

/**
 * Etiqueta del origen de un pedido para la tarjeta. channel null o 'catalog'
 * es el catalogo (los pedidos viejos no tienen channel). Otro canal que no se
 * conoce devuelve null: mejor no mostrar nada que inventar un nombre.
 */
export function etiquetaOrigen(channel) {
  if (!channel || channel === 'catalog') return 'Catálogo';
  const m = /^manual_(.+)$/.exec(channel);
  if (!m) return null;
  return ORIGENES_MANUALES.find((o) => o.id === m[1])?.label || null;
}

/** Productos que se pueden cargar: activos, sin archivar y que no sean servicios con turno. */
export function productosCargables(productos = []) {
  return (productos || []).filter((p) => p && p.active !== false && !p.is_archived && p.type !== 'service');
}

/** Categorias en el orden en que aparecen (los productos ya vienen ordenados). */
export function categoriasDe(productos = []) {
  const vistas = new Set();
  for (const p of productos) {
    const c = String(p.category || '').trim();
    if (c) vistas.add(c);
  }
  return [...vistas];
}

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra por texto (nombre o categoria, sin tildes) y por categoria. */
export function filtrarProductos(productos, { texto = '', categoria = null } = {}) {
  const q = sinTildes(texto).trim();
  return productos.filter((p) =>
    (!categoria || String(p.category || '').trim() === categoria)
    && (!q || sinTildes(p.name).includes(q) || sinTildes(p.category).includes(q)));
}

/**
 * Linea del carrito. La selection se valida con la MISMA funcion que usa
 * submit-order: si falta una opcion obligatoria, no se arma la linea.
 * @returns {{ ok: true, linea } | { ok: false, error }}
 */
export function armarLinea(producto, seleccion = [], qty = 1) {
  const r = resolverOpciones(producto.option_groups, seleccion);
  if (!r.ok) return { ok: false, error: r.error };
  const unitPrice = redondear((Number(producto.price) || 0) + r.extras);
  const detalle = r.elegidas.map((e) => (e.qty > 1 ? `${e.label} ×${e.qty}` : e.label)).join(', ');
  return {
    ok: true,
    linea: {
      // Misma eleccion = misma linea: sumar dos veces la misma pizza suma cantidad.
      key: `${producto.id}|${JSON.stringify(seleccion.map((s) => [s.groupId, s.choiceId, s.qty]))}`,
      productId: producto.id,
      nombre: producto.name,
      detalle,
      seleccion,
      unitPrice,
      qty: Math.max(1, Math.round(qty)),
    },
  };
}

/** Suma la linea al carrito (o le suma cantidad si ya esta). */
export function agregarLinea(carrito, linea) {
  const i = carrito.findIndex((l) => l.key === linea.key);
  if (i < 0) return [...carrito, linea];
  return carrito.map((l, j) => (j === i ? { ...l, qty: Math.min(999, l.qty + linea.qty) } : l));
}

/** Cambia la cantidad; en 0 la linea sale del carrito. */
export function cambiarCantidad(carrito, key, qty) {
  const n = Math.max(0, Math.min(999, Math.round(Number(qty) || 0)));
  return n === 0 ? carrito.filter((l) => l.key !== key) : carrito.map((l) => (l.key === key ? { ...l, qty: n } : l));
}

/** Total de la vista previa (sin promos del dia: las aplica el servidor). */
export function totalCarrito(carrito) {
  return redondear(carrito.reduce((s, l) => s + l.unitPrice * l.qty, 0));
}

export function unidadesCarrito(carrito) {
  return carrito.reduce((s, l) => s + l.qty, 0);
}

/** Cuentas de cobro del tenant que sirven para clientes (mismo filtro que submit-order). */
export function cuentasDeCobro(settings) {
  const cuentas = Array.isArray(settings?.payment_accounts) ? settings.payment_accounts : [];
  return cuentas.filter((a) => a && a.id && a.active !== false && (a.scope ?? 'ambos') !== 'proveedores');
}

/**
 * Errores del formulario por campo. Vacio = se puede confirmar.
 * Nombre y telefono son obligatorios (submit-order los exige); la direccion
 * solo con envio.
 */
export function validarPedidoManual({ carrito, cliente, telefono, entrega, direccion }) {
  const e = {};
  if (!carrito?.length) e.carrito = 'Agregá al menos un producto.';
  if (!String(cliente || '').trim()) e.cliente = 'Falta el nombre.';
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (!digitos) e.telefono = 'Falta el teléfono.';
  else if (digitos.length < 7) e.telefono = 'El teléfono parece incompleto.';
  if (entrega === 'envio' && !String(direccion || '').trim()) e.direccion = 'Falta la dirección del envío.';
  return e;
}

/**
 * Cuerpo para submit-order. `pago` es 'efectivo' o el id de una cuenta del
 * tenant (el servidor arma el snapshot de la cuenta y la marca transferencia).
 */
export function cuerpoPedidoManual({ tenantSlug, carrito, cliente, telefono, entrega, direccion, pago, origen, nota }) {
  const esCuenta = pago && pago !== 'efectivo';
  return {
    tenant_slug: tenantSlug,
    origen,
    customer: String(cliente || '').trim(),
    phone: String(telefono || '').trim(),
    delivery: entrega === 'envio' ? 'envio' : 'retiro',
    address: entrega === 'envio' ? String(direccion || '').trim() : null,
    payment: esCuenta ? 'transferencia' : 'efectivo',
    payment_account_id: esCuenta ? pago : null,
    note: String(nota || '').trim() || null,
    items: carrito.map((l) => ({
      recipeId: l.productId,
      qty: l.qty,
      ...(l.seleccion?.length ? { selection: l.seleccion } : {}),
    })),
  };
}

/** Lo que define "el mismo pedido" para la clave de idempotencia (sin la hora). */
export function firmaPedidoManual(cuerpo) {
  return [cuerpo.origen, cuerpo.phone, cuerpo.delivery, cuerpo.address, cuerpo.payment_account_id,
    cuerpo.items.map((i) => [i.recipeId, i.qty, i.selection || null])];
}
