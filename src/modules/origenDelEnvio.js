// src/modules/origenDelEnvio.js
// Desde donde sale el envio de cada negocio y como se cotiza.
//
// El origen es la ubicacion que el duenio cargo en su sucursal
// (`branches.lat/lng`), que get_catalog devuelve como `store_lat` /
// `store_lng`. NO hay ubicacion predeterminada: hasta el 27/sep habia una del
// build (Caracas, despues el centro de Buenos Aires) y se cotizaban envios
// desde un lugar donde el local no estaba. Sin ubicacion el catalogo no toma
// pedidos, y eso lo hace cumplir la base (platform/migrations/0083).

import { haversine, calcDeliveryCost } from '../constants/catalogConstants.js';
import { getPais } from './paises.js';

// Medio lado de la caja donde se busca primero la direccion del cliente.
// 0.25 grados son ~28 km: mas lejos que eso ya es el ultimo tramo de envio.
const RADIO_BUSQUEDA_GRADOS = 0.25;

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';

export function coordenadaValida(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return false;
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln)
    && la >= -90 && la <= 90 && ln >= -180 && ln <= 180
    // 0,0 es lo que queda cuando alguien guarda un numero vacio: no es un local.
    && !(la === 0 && ln === 0);
}

/** El origen del envio de este negocio, o null si todavia no lo cargo. */
export function origenDelEnvio(settings) {
  if (!coordenadaValida(settings?.store_lat, settings?.store_lng)) return null;
  return { lat: Number(settings.store_lat), lng: Number(settings.store_lng) };
}

/**
 * Si el catalogo puede tomar pedidos. Pide las dos cosas: que la base diga
 * que esta activo y que haya un origen con el que cotizar el envio. La base
 * es la que manda (rechaza el pedido igual); esto es para no dejar que el
 * cliente arme un pedido que despues no va a entrar.
 */
export function catalogoActivo(settings) {
  return settings?.catalogo_activo === true && origenDelEnvio(settings) !== null;
}

/** Distancia (km, un decimal) y costo del envio desde `origen` hasta `destino`. */
export function cotizarEnvio(origen, destino, pricing = null) {
  const km = haversine(origen.lat, origen.lng, Number(destino.lat), Number(destino.lng));
  return { km: Math.round(km * 10) / 10, cost: calcDeliveryCost(km, pricing) };
}

/**
 * URLs de Nominatim para ubicar la direccion que escribio el cliente, en orden.
 * Antes se le pegaba ", Buenos Aires, Argentina" fijo: un negocio de Cordoba
 * ubicaba "San Martin 1234" en Capital. Ahora la busqueda se acota al pais del
 * negocio y, primero, a una caja alrededor de su local. Si en la caja no hay
 * nada se busca en todo el pais.
 */
export function urlsBusquedaDireccion(address, { origen, country } = {}) {
  const pais = getPais(country).id.toLowerCase();
  const base = `${NOMINATIM_SEARCH}?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=${pais}`;
  if (!origen || !coordenadaValida(origen.lat, origen.lng)) return [base];
  const r = RADIO_BUSQUEDA_GRADOS;
  // viewbox es oeste,norte,este,sur (lon,lat,lon,lat)
  const caja = [origen.lng - r, origen.lat + r, origen.lng + r, origen.lat - r]
    .map(n => n.toFixed(4)).join(',');
  return [`${base}&viewbox=${caja}&bounded=1`, base];
}

/**
 * Ubica la direccion y cotiza el envio. Devuelve null si no hay origen o si
 * Nominatim no la encuentra. `fetchImpl` es inyectable para los tests.
 */
export async function estimarEnvio(address, { origen, country, pricing, fetchImpl = fetch } = {}) {
  if (!origen) return null;
  for (const url of urlsBusquedaDireccion(address, { origen, country })) {
    const r = await fetchImpl(url);
    const data = await r.json();
    const hit = data?.[0];
    if (hit && coordenadaValida(hit.lat, hit.lon)) {
      return cotizarEnvio(origen, { lat: hit.lat, lng: hit.lon }, pricing);
    }
  }
  return null;
}

/* ─────────────────── Para que el duenio cargue la suya ─────────────────── */

/**
 * Lee lo que se copia de Google Maps con clic derecho ("-34.4586, -58.9142").
 * Acepta coma o punto y coma entre las dos, y espacios. Devuelve null si no
 * son dos numeros validos.
 */
export function parsearCoordenadas(texto) {
  const m = String(texto || '').trim()
    .match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return coordenadaValida(lat, lng) ? { lat, lng } : null;
}

/** Busqueda del local en Nominatim: varias opciones, para que el duenio elija. */
export function urlBuscarLocal(address, country) {
  const pais = getPais(country).id.toLowerCase();
  return `${NOMINATIM_SEARCH}?q=${encodeURIComponent(address)}&format=json&limit=5&addressdetails=0&countrycodes=${pais}`;
}

/** Link para que el duenio vea en el mapa el punto que va a guardar. */
export function urlVerEnMapa({ lat, lng }) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
