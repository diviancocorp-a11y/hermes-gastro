// src/lib/vistaPrevia.js
// Vista previa de un tenant fuera de su dominio: sirve para que un disenador
// externo (o Ricky, en el preview de Vercel de un PR) vea la portada de un
// negocio con `?tenant=<slug>`.
//
// Solo funciona en localhost, 127.0.0.1, [::1] y *.vercel.app. NUNCA en
// divianco.app ni en un dominio propio de un cliente: ahi el tenant sale del
// hostname y nadie puede cambiarlo con un parametro.
//
// En vista previa NO se escribe nada: submitOrder, cancel-order, birthday-gift y
// las reservas devuelven el aviso de abajo en vez de llamar a la funcion.

const CLAVE = 'dico_vista_previa_tenant';
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const MENSAJE_VISTA_PREVIA = 'Esto es una vista previa: los pedidos no se envían.';

const hostPermitido = (h) => {
  const host = String(h || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' || host.endsWith('.vercel.app');
};

const guardar = (valor) => {
  try {
    if (valor) sessionStorage.setItem(CLAVE, valor); else sessionStorage.removeItem(CLAVE);
  } catch { /* storage bloqueado: la vista previa vale solo para esta carga */ }
};
const leerGuardado = () => {
  try { return sessionStorage.getItem(CLAVE); } catch { return null; }
};

/**
 * Slug del tenant que se esta previsualizando, o null.
 * `?tenant=<slug>` lo fija (y lo guarda en sessionStorage); `?tenant=` vacio lo borra.
 */
export function tenantDeVistaPrevia(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc || !hostPermitido(loc.hostname)) return null;
  let param = null;
  try { param = new URLSearchParams(loc.search || '').get('tenant'); } catch { param = null; }
  if (param !== null) {
    const limpio = param.trim().toLowerCase();
    if (limpio === '') { guardar(null); return null; }
    if (!SLUG.test(limpio)) return null;
    guardar(limpio);
    return limpio;
  }
  const guardado = leerGuardado();
  return guardado && SLUG.test(guardado) ? guardado : null;
}

export const esVistaPrevia = () => tenantDeVistaPrevia() !== null;

/** El dato real si existe; si no, el ejemplo SOLO en vista previa (en produccion, null). */
export const conEjemplo = (valor, ejemplo) => valor ?? (esVistaPrevia() ? ejemplo : null);
