// src/lib/mensajePedido.js
// Mensaje de WhatsApp de un pedido YA creado. Puro, sin React.
//
// Los montos salen de la respuesta del servidor (total, descuento, propina,
// envio, tasa congelada): aca no se recalcula ningun precio. Las lineas
// (nombre con opciones, cantidad, nota) salen del carrito que se acaba de
// enviar. Sin simbolos ni locales escritos: formatean textoPrincipal y moneda.js.
import { formatearMonto } from './moneda';
import { fmtAR } from './format';

const principalTexto = (valor, principal) =>
  !principal || principal === 'ARS' ? fmtAR(valor) : formatearMonto(valor, principal);

/** https://wa.me/<numero>?text=<mensaje>, o null si el numero no sirve (un wa.me sin numero abre "enviar a"). */
export function urlWhatsApp(numero, texto) {
  const n = String(numero || '').replace(/\D/g, '');
  if (n.length < 8) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/**
 * @param {object} p
 * @param {string} p.negocio       nombre del local
 * @param {string} p.codigo        formatOrderCode(orderId)
 * @param {{nombre:string, telefono?:string}} p.cliente
 * @param {'envio'|'retiro'} p.modo
 * @param {string} [p.direccion]
 * @param {{name:string, qty:number, note?:string}[]} p.items
 * @param {object} p.respuesta     lo que devolvio submit-order
 * @param {string} p.principal     moneda principal del tenant
 * @param {string} [p.notas]       nota del pedido
 */
export function armarMensajePedido({ negocio, codigo, cliente, modo, direccion = '', items = [], respuesta = {}, principal, notas = '' }) {
  const m = (v) => principalTexto(v, principal);
  const linea = '------------------------------';
  const fx = respuesta.fx || null;
  const pendiente = respuesta.delivery_pending === true;
  const filas = [`*PEDIDO ${String(negocio || '').toUpperCase()} Nº ${codigo}*`, linea, '', '*CLIENTE*', `Nombre: ${cliente?.nombre || ''}`];
  if (cliente?.telefono) filas.push(`Teléfono: ${cliente.telefono}`);
  filas.push(`Modalidad: ${modo === 'envio' ? 'Entrega a domicilio' : 'Retiro'}`);
  if (modo === 'envio' && direccion) filas.push(`Dirección: ${direccion}`);

  filas.push('', linea, '*DETALLE DEL PEDIDO*', '');
  items.forEach((it, i) => {
    filas.push(`${i + 1}. ${it.qty} x ${it.name}`);
    if (it.note) filas.push(`   Nota: ${it.note}`);
  });

  filas.push('', linea, '*RESUMEN*');
  if (respuesta.discount > 0) filas.push(`Descuento: -${m(respuesta.discount)}`);
  if (respuesta.tip > 0) filas.push(`Propina: ${m(respuesta.tip)}`);
  if (modo === 'envio') {
    filas.push(pendiente ? 'Envío: a confirmar por el local' : `Envío: ${m(respuesta.delivery_cost || 0)}`);
  }
  filas.push(`*${pendiente ? 'Total parcial (sin envío)' : 'Total'}: ${m(respuesta.total)}*`);
  if (fx && fx.total_secondary != null) {
    filas.push(`${pendiente ? 'Parcial' : 'Total'} en ${fx.currency}: ${formatearMonto(fx.total_secondary, fx.currency)}`
      + ` (tasa ${formatearMonto(fx.rate, fx.currency)}${fx.status === 'vencida' ? ', por verificar' : ''})`);
  } else if (fx === null && respuesta.fx !== undefined) {
    filas.push('El monto en la otra moneda te lo confirma el local por este chat.');
  }
  if (pendiente) filas.push(`${negocio} te confirma el costo del envío y el total final por este chat.`);
  if (notas) filas.push('', '*NOTAS*', notas);
  filas.push('', '¡Gracias!');
  return filas.join('\n');
}
