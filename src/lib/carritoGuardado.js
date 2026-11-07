// src/lib/carritoGuardado.js
// El carrito del catalogo publico sobrevive a un recargar o a un "atras" de
// mas. Vive en localStorage con una clave POR TENANT (y el slug adentro del
// valor): en produccion cada <slug>.divianco.app ya es otro origen, pero en
// local y en los previews *.vercel.app todo comparte origen, y dos negocios
// nunca tienen que mezclar carritos.
//
// Lo guardado NO es la verdad del precio: submit-order recalcula todo del lado
// del servidor. Al leerlo se valida contra el catalogo recien cargado:
//   - producto que ya no esta, agotado o tamano que ya no existe -> se saca;
//   - precio distinto -> se actualiza al de hoy;
// y quien lo llama avisa al cliente de las dos cosas.
//
// Vence a las 24 h de la ultima modificacion: un carrito de ayer ya no es el
// pedido de hoy.

export const CARRITO_VERSION = 1;
export const CARRITO_VENCE_MS = 24 * 60 * 60 * 1000;
const PREFIJO = 'dico_carrito:';

export function claveCarrito(slug) {
  return slug ? `${PREFIJO}${slug}` : null;
}

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

// Cantidad por linea: entero de 1 a 999. El tope no es 99 porque hay
// mayoristas en el edificio (Monare) que piden cajas por cientos; lo que pasa
// el tope o no es entero es un guardado tocado a mano y se descarta.
export const CARRITO_QTY_MAX = 999;

function lineaValida(i) {
  return i && i.id && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= CARRITO_QTY_MAX;
}

/**
 * Lee lo guardado de ese tenant: { items, mpPedido }. Vencido o roto -> vacio
 * (y se borra). mpPedido es el pedido de MercadoPago `pending_payment` que se
 * creo con ESE carrito: si el pago fallo, el reintento reusa ese pedido en vez
 * de crear otro.
 */
export function leerCarritoGuardado(slug, ahora = Date.now()) {
  const vacio = { items: [], mpPedido: null };
  const clave = claveCarrito(slug);
  const ls = storage();
  if (!clave || !ls) return vacio;
  try {
    const raw = ls.getItem(clave);
    if (!raw) return vacio;
    const data = JSON.parse(raw);
    const vigente = data && data.v === CARRITO_VERSION
      && Number.isFinite(data.guardado) && ahora - data.guardado <= CARRITO_VENCE_MS
      && data.slug === slug && Array.isArray(data.items);
    if (!vigente) { ls.removeItem(clave); return vacio; }
    const items = data.items.filter(lineaValida);
    return { items, mpPedido: items.length && typeof data.mpPedido === 'string' ? data.mpPedido : null };
  } catch {
    try { ls.removeItem(clave); } catch { /* sin storage */ }
    return vacio;
  }
}

/** Solo las lineas del carrito guardado. */
export function leerCarrito(slug, ahora = Date.now()) {
  return leerCarritoGuardado(slug, ahora).items;
}

/**
 * Guarda el carrito de ese tenant. Vacio -> borra la clave.
 * @param extra.mpPedido id del pedido MP pendiente creado con este carrito
 */
export function guardarCarrito(slug, items, ahora = Date.now(), extra = {}) {
  const clave = claveCarrito(slug);
  const ls = storage();
  if (!clave || !ls) return;
  try {
    if (!Array.isArray(items) || items.length === 0) { ls.removeItem(clave); return; }
    const data = { v: CARRITO_VERSION, slug, guardado: ahora, items };
    if (extra.mpPedido) data.mpPedido = String(extra.mpPedido);
    ls.setItem(clave, JSON.stringify(data));
  } catch { /* cuota llena o modo privado: el carrito sigue en memoria */ }
}

/** Borra lo guardado de ese tenant (pago aprobado o en proceso). */
export function borrarCarrito(slug) {
  guardarCarrito(slug, []);
}

/**
 * Que hacer con el pedido MP pendiente de un carrito guardado, segun el pedido
 * real (get_order_tracker):
 *   'reusar' -> sigue en pending_payment sin pago aprobado: el reintento pide
 *               otra preferencia para ESE pedido (mp-preference solo acepta
 *               pending_payment, asi que nunca se cobra dos veces).
 *   'nuevo'  -> se cancelo: el carrito vale, pero el proximo envio es otro pedido.
 *   'pagado' -> el pago entro (o el pedido ya avanzo): el carrito ya se compro
 *               y se descarta.
 * Si el pedido no existe (el tracker contesto y no esta) -> 'nuevo'. Si no se
 * pudo leer (fallo de red) se reusa: el servidor rechaza lo que no esta
 * pendiente y el cliente ve el error en vez de un pedido doble.
 */
export function decidirPedidoMp(pedido, { fallo = false } = {}) {
  if (!pedido) return fallo ? 'reusar' : 'nuevo';
  const st = String(pedido.status || '').toLowerCase();
  const ps = String(pedido.payment_status || '').toLowerCase();
  if (st === 'cancelled') return 'nuevo';
  if (st === 'pending_payment' && ps !== 'approved') return 'reusar';
  return 'pagado';
}

/**
 * Cruza el carrito guardado con el catalogo de hoy.
 * @param items lineas del carrito ({ id, product_id?, size_label?, price, qty, name })
 * @param products productos de get_catalog
 * @param opts.precioDe (p) => precio vigente (con descuento del dia)
 * @param opts.agotados Set de ids agotados
 * @returns {{ items, quitados: string[], actualizados: string[] }}
 */
export function validarCarrito(items, products, { precioDe, agotados } = {}) {
  const porId = new Map((products || []).map(p => [p.id, p]));
  const quitados = [];
  const actualizados = [];
  const validos = [];
  for (const item of items || []) {
    const p = porId.get(item.product_id || item.id);
    if (!p || agotados?.has?.(p.id)) { quitados.push(item.name || 'Un producto'); continue; }
    let precio;
    if (item.size_label) {
      const size = Array.isArray(p.sizes) ? p.sizes.find(s => s?.label === item.size_label) : null;
      if (!size) { quitados.push(item.name || p.name); continue; }
      precio = Number(size.price) || 0;
    } else {
      precio = precioDe ? precioDe(p) : Number(p.sale_price) || 0;
    }
    if (Number(item.price) !== precio) {
      actualizados.push(item.name || p.name);
      validos.push({ ...item, price: precio });
    } else {
      validos.push(item);
    }
  }
  return { items: validos, quitados, actualizados };
}

/** Texto del aviso para el cliente, o null si no cambio nada. */
export function avisoDelCarrito({ quitados = [], actualizados = [] }) {
  const partes = [];
  if (quitados.length === 1) partes.push(`Sacamos ${quitados[0]} del carrito: ya no está disponible`);
  else if (quitados.length > 1) partes.push(`Sacamos ${quitados.length} productos del carrito: ya no están disponibles`);
  if (actualizados.length === 1) partes.push(`Actualizamos el precio de ${actualizados[0]}`);
  else if (actualizados.length > 1) partes.push(`Actualizamos el precio de ${actualizados.length} productos`);
  return partes.length ? `${partes.join('. ')}.` : null;
}
