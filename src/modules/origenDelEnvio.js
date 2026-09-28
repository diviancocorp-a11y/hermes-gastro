// src/modules/origenDelEnvio.js
// Desde donde sale el envio de cada negocio y como se cotiza.
//
// El origen es la sucursal por defecto del tenant (`branches.lat/lng`), que
// get_catalog devuelve como `store_lat` / `store_lng` (platform/migrations/0080).
// `business.geo` queda solo como respaldo: es UN punto para todos los negocios
// del edificio, asi que cotizar contra el es cotizar contra un lugar inventado.
//
// Hasta el 27/sep ese respaldo eran las coordenadas de Cochi en Caracas y todo
// negocio argentino caia en el tramo maximo de envio.

import business from '@business';
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

/**
 * El origen del envio de este negocio. `propio` dice si salio de su sucursal
 * o del respaldo del build; el checkout lo puede usar para no presentar como
 * exacta una distancia medida contra un punto que no es el local.
 */
export function origenDelEnvio(settings, respaldo = business.geo) {
  if (coordenadaValida(settings?.store_lat, settings?.store_lng)) {
    return { lat: Number(settings.store_lat), lng: Number(settings.store_lng), propio: true };
  }
  return { lat: Number(respaldo.lat), lng: Number(respaldo.lng), propio: false };
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
 * negocio y, primero, a una caja alrededor de su origen. Si en la caja no hay
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
 * Ubica la direccion y cotiza el envio. Devuelve null si Nominatim no la
 * encuentra. `fetchImpl` es inyectable para los tests.
 */
export async function estimarEnvio(address, { origen, country, pricing, fetchImpl = fetch } = {}) {
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
