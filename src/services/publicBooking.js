// src/services/publicBooking.js
// La reserva online vista desde la clienta (sin cuenta): habla con la edge
// function `booking` (platform/functions/booking). Nada de esto toca tablas:
// el servidor decide el monto de la sena, el traslado y el horario.
//
// Toda respuesta tiene la forma { ok: true, ... } o { ok: false, error, code }.
// `error` ya viene en lenguaje llano (lo escribe el servidor).

import { supabase } from '../lib/supabase';
import { resolveTenantSlug } from '../lib/activeTenant';
import { claveDeIdempotencia, reiniciarClave } from '../lib/idempotencia.js';

const CLAVE_RESERVA = 'reserva-online';

async function llamar(action, payload = {}) {
  let slug;
  try {
    slug = await resolveTenantSlug();
  } catch {
    slug = null;
  }
  if (!slug) return { ok: false, error: 'No pudimos identificar el negocio.', code: 'sin_negocio' };

  try {
    const { data, error } = await supabase.functions.invoke('booking', {
      body: { action, tenant_slug: slug, ...payload },
    });
    if (error) {
      // FunctionsHttpError: el mensaje util del server viene en error.context.
      let cuerpo = null;
      try {
        if (error.context && typeof error.context.json === 'function') cuerpo = await error.context.json();
      } catch { /* cuerpo que no es json: mensaje generico */ }
      return {
        ok: false,
        error: cuerpo?.error || 'No pudimos completar la operación. Probá de nuevo.',
        code: cuerpo?.code || null,
      };
    }
    if (!data?.ok) return { ok: false, error: data?.error || 'No pudimos completar la operación.', code: data?.code || null };
    return data;
  } catch (e) {
    console.error('publicBooking:', action, e?.message);
    return { ok: false, error: 'Sin conexión. Probá de nuevo.', code: 'red' };
  }
}

/** Servicios, profesionales, zonas, reglas y estado de la seña del negocio. */
export const fetchBookingInfo = () => llamar('info');

/**
 * Horarios libres de un servicio entre dos fechas locales 'YYYY-MM-DD' (hasta
 * 14 dias). Sin staffId devuelve una fila por profesional libre.
 */
export const fetchPublicSlots = ({ serviceId, desde, hasta, staffId = null, locationKind = 'local', zoneId = null }) =>
  llamar('slots', {
    service_id: serviceId, from: desde, to: hasta,
    staff_id: staffId, location_kind: locationKind, zone_id: zoneId,
  });

/**
 * Reservar. La clave de idempotencia dura mientras se reintenta el MISMO turno:
 * un doble toque o un reintento de red no crean dos. Se reinicia al tomarse.
 */
export async function createBooking(datos) {
  const r = await llamar('create', {
    service_id: datos.serviceId,
    staff_id: datos.staffId || null,
    starts_at: datos.startsAt,
    location_kind: datos.locationKind || 'local',
    zone_id: datos.zoneId || null,
    address: datos.address || null,
    customer_name: datos.nombre,
    customer_phone: datos.telefono,
    customer_email: datos.email || null,
    notes: datos.notas || null,
    client_request_id: claveDeIdempotencia(CLAVE_RESERVA, [
      datos.serviceId, datos.staffId || 'any', datos.startsAt, datos.telefono,
      datos.locationKind || 'local', datos.zoneId || '',
    ]),
  });
  if (r.ok) reiniciarClave(CLAVE_RESERVA);
  return r;
}

/** Un turno por su token (el link que recibe la clienta). */
export const fetchBooking = (token) => llamar('get', { token });

/** Cancelar con el token, dentro del plazo que fija el negocio. */
export const cancelBooking = (token) => llamar('cancel', { token });
