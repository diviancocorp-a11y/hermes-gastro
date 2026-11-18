// Pedido por WhatsApp automatico (settings.pedido_por_whatsapp) y lo que lo rodea.
// Puro salvo el snapshot, que va a sessionStorage con try/catch.
import { armarMensajePedido, urlWhatsApp } from './mensajePedido';
import { formatOrderCode } from './utils';

/** Con el flag, el comprobante deja de ser obligatorio (tambien se puede mandar por WhatsApp). */
export function comprobanteObligatorio(necesitaComprobante, settings) {
  return Boolean(necesitaComprobante) && settings?.pedido_por_whatsapp !== true;
}

/** URL de WhatsApp con el pedido armado, o null si el flag esta apagado o el local no tiene numero. */
export function urlWhatsAppDePedido({ settings, orderId, form, items, respuesta, principal }) {
  if (!respuesta || settings?.pedido_por_whatsapp !== true) return null;
  return urlWhatsApp(settings?.whatsapp, armarMensajePedido({
    negocio: settings?.biz_name || '', codigo: formatOrderCode(orderId),
    cliente: { nombre: form?.name || '', telefono: form?.phone || '' },
    modo: form?.delivery === 'envio' ? 'envio' : 'retiro', direccion: form?.address || '',
    items, respuesta, principal, notas: form?.note || '',
  }));
}

// Al ir a WhatsApp en la misma pestana la pagina puede recargarse al volver y
// el estado se pierde: el snapshot permite mostrar la confirmacion y no un
// carrito vacio. Vive en sessionStorage (la pestana), 1 hora como mucho.
const CLAVE = 'dico_confirmacion_pedido';
const VIGENCIA_MS = 60 * 60 * 1000;

export function guardarConfirmacion(snapshot) {
  try { sessionStorage.setItem(CLAVE, JSON.stringify({ ...snapshot, t: Date.now() })); } catch { /* sin storage: se pierde el respaldo */ }
}

export function leerConfirmacion() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE) || 'null');
    if (!s || !s.orderId || Date.now() - (s.t || 0) > VIGENCIA_MS) return null;
    return s;
  } catch { return null; }
}

export function borrarConfirmacion() {
  try { sessionStorage.removeItem(CLAVE); } catch { /* nada */ }
}
