// La landing le habla a un rubro cuando llega con ?rubro= (una campania, un
// link compartido). Sin parametro, o con uno que no se reconoce, la landing
// queda como esta.
//
// Cada bajada sale de lo que el rubro tiene HOY en src/modules/registry.js
// (`modulos` de cada rubro con `implementado: true`) y de las filas "Hoy" de
// RubrosNegocio.jsx. La agenda de servicios es la del panel: la reserva
// online sigue en desarrollo y por eso no se nombra.

const ALIAS = { gastronomia: 'gastronomia', gastro: 'gastronomia', comercio: 'comercio', servicios: 'servicios' };

export const BAJADA_POR_RUBRO = {
  gastronomia: 'Para tu restaurante, panadería o delivery: salón, cocina, recetas y caja.',
  comercio: 'Para tu tienda o comercio: catálogo online, stock por artículo y caja.',
  servicios: 'Para tu barbería, peluquería o estética: agenda de turnos en el panel, servicios y caja.',
};

// El alta (src/lib/registroPlataforma.js) entiende ?rubro= con los ids de
// registry.js, que no son los de la landing.
export const RUBRO_DEL_REGISTRO = { gastronomia: 'gastro', comercio: 'retail', servicios: 'barber' };

/** El rubro de la landing segun la URL ('gastronomia' | 'comercio' | 'servicios'), o null. */
export function rubroDeLaUrl(busqueda = typeof window === 'undefined' ? '' : window.location.search) {
  const valor = new URLSearchParams(busqueda).get('rubro')?.trim().toLowerCase();
  return (valor && Object.hasOwn(ALIAS, valor)) ? ALIAS[valor] : null;
}
