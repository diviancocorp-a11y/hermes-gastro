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

/**
 * Si el pedido se lleva el envio gratis: el subtotal de productos SUPERA el
 * umbral del negocio. "Mayor a 60.000" no incluye 60.000. Un umbral de 0, vacio
 * o invalido significa que el negocio no ofrece envio gratis.
 */
export function esEnvioGratis(subtotal, umbral) {
  const u = Number(umbral);
  return Number.isFinite(u) && u > 0 && Number(subtotal) > u;
}

const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "Partido del Pilar" y "pilar" son lo mismo: sin tildes, sin "Partido de", en minuscula. */
export function normalizarLugar(s) {
  return sinTildes(s).toLowerCase()
    .replace(/\bpartido (de las|de los|de la|del|de)\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `permitido` aparece en `campo` como palabra completa: "tigre" si, "tigres" no. */
function contiene(campo, permitido) {
  if (!campo || !permitido) return false;
  return (` ${campo} `).includes(` ${permitido} `);
}

/**
 * Si la direccion que ubico Nominatim cae dentro de la zona de entrega del
 * negocio (`settings.delivery_zone.partidos`).
 *
 * Devuelve `{ estado, lugar }` con estado:
 *   'sin_regla'    el negocio no limito la zona (o no hay direccion): no se valida
 *   'dentro'       el partido esta en la lista
 *   'fuera'        el partido se conoce y NO esta en la lista (o es otra provincia
 *                  o la Ciudad de Buenos Aires)
 *   'desconocida'  Nominatim no dio un partido reconocible: NO se bloquea. Un
 *                  geocodificador incompleto no puede dejar sin venta a alguien
 *                  que si esta en zona; ahi decide el negocio con el aviso.
 *
 * Nominatim no es consistente con la clave del partido: San Isidro lo trae como
 * county y Pilar como state_district. Por eso se miran las tres que usa.
 */
export function evaluarZona(address, zona) {
  const permitidos = (Array.isArray(zona?.partidos) ? zona.partidos : [])
    .map(normalizarLugar).filter(Boolean);
  if (!permitidos.length || !address || typeof address !== 'object') return { estado: 'sin_regla' };

  const provincia = normalizarLugar(address.state);
  const esCapital = provincia.includes('ciudad autonoma') || address['ISO3166-2-lvl4'] === 'AR-C';
  if (esCapital) return { estado: 'fuera', lugar: 'Ciudad de Buenos Aires' };
  if (provincia && provincia !== 'buenos aires') return { estado: 'fuera', lugar: address.state };

  // 1) Los campos que Nominatim usa para el partido.
  const partidos = [address.county, address.state_district, address.municipality].filter(Boolean);
  if (partidos.length) {
    if (partidos.some((p) => permitidos.some((ok) => contiene(normalizarLugar(p), ok)))) {
      return { estado: 'dentro', lugar: partidos[0] };
    }
    return { estado: 'fuera', lugar: partidos[0] };
  }

  // 2) Sin partido: la localidad (algunas direcciones traen solo "town: Pilar").
  const localidades = [address.city, address.town, address.village, address.suburb].filter(Boolean);
  if (localidades.some((l) => permitidos.some((ok) => contiene(normalizarLugar(l), ok)))) {
    return { estado: 'dentro', lugar: localidades[0] };
  }
  return { estado: 'desconocida', lugar: localidades[0] || null };
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
  // addressdetails=1: sin el no viene el partido, y con el el negocio puede
  // limitar a que zonas entrega (evaluarZona).
  const base = `${NOMINATIM_SEARCH}?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1&countrycodes=${pais}`;
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
      // `address` es el desglose de Nominatim (partido, provincia...): lo usa
      // evaluarZona para saber si la direccion cae dentro de lo que se entrega.
      return { ...cotizarEnvio(origen, { lat: hit.lat, lng: hit.lon }, pricing), address: hit.address || null };
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
