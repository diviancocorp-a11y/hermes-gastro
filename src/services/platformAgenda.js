// src/services/platformAgenda.js
// Agenda de servicios (0109): horarios, ausencias, servicios por profesional,
// reglas de reserva y huecos libres. Los turnos en si (crear, mover, estados)
// viven en platformScheduling.js.
//
// La garantia contra el doble turno es el EXCLUDE de `appointments`. Lo que
// hace este archivo es dejar cargar CUANDO se atiende y pedirle a la base los
// huecos (`get_available_slots`) para no ofrecer lo que va a rebotar.
//
// Este archivo esta en PLATFORM_PATHS (scripts/check-supabase-columns.mjs).

import { supabase } from '../lib/supabase';

const COLS_STAFF = 'id, tenant_id, branch_id, user_id, name, color, active, job';
const COLS_SERVICE = 'id, tenant_id, name, price, active, duration_min, buffer_after_min, is_addon, category';
const COLS_ZONE = 'id, tenant_id, name, travel_min, active';
const COLS_SCHEDULE = 'id, tenant_id, staff_id, weekday, start_time, end_time';
const COLS_TIMEOFF = 'id, tenant_id, staff_id, starts_at, ends_at, reason';
const COLS_STAFF_SERVICE = 'tenant_id, staff_id, service_id, duration_min';
const COLS_SETTINGS =
  'tenant_id, min_notice_min, max_advance_days, slot_step_min, cancel_window_hours, ' +
  'offers_local, offers_home, travel_min, deposit_mode, deposit_value, deposit_hold_min';

// Lo que la base devuelve cuando una regla no se cumple, en palabras de la
// persona que esta cargando.
const MENSAJES = {
  sched_tramo_valido: 'La hora de fin tiene que ser posterior a la de inicio.',
  timeoff_valido: 'La fecha de fin tiene que ser posterior al inicio.',
  booking_alguna_modalidad: 'Tiene que atender en el local, a domicilio o las dos.',
  booking_deposit_coherente: 'Si pedís seña, falta el monto.',
  booking_percent_valido: 'El porcentaje de la seña no puede pasar de 100.',
  rango_demasiado_largo: 'Pedí los horarios de hasta dos meses por vez.',
  booking_zones_nombre: 'Ya hay una zona con ese nombre.',
};

function traducir(msg = '') {
  const codigo = Object.keys(MENSAJES).find(c => msg.includes(c));
  return codigo ? MENSAJES[codigo] : msg;
}

// Defaults de la base (0109): el negocio sin fila usa estos, igual que la
// funcion de huecos. Si cambian aca, cambian alla.
export const REGLAS_POR_DEFECTO = {
  min_notice_min: 120,
  max_advance_days: 60,
  slot_step_min: 15,
  cancel_window_hours: 24,
  offers_local: true,
  offers_home: false,
  travel_min: 0,
  deposit_mode: 'none',
  deposit_value: null,
  deposit_hold_min: 30,
};

/* ───────────────────────────── Lectura ─────────────────────────────── */

/**
 * Todo lo que la agenda necesita para armarse, en un solo viaje: quien
 * atiende, que servicios hay, cuando trabaja cada una y que reglas tiene el
 * negocio. Lo que cambia por dia (los turnos) se pide aparte.
 */
export async function fetchAgendaBase(tenantId) {
  if (!tenantId) return null;
  const [staff, servicios, horarios, ausencias, relaciones, reglas, zonas] = await Promise.all([
    supabase.from('staff').select(COLS_STAFF).eq('tenant_id', tenantId).eq('active', true).order('name'),
    supabase.from('products').select(COLS_SERVICE).eq('tenant_id', tenantId).eq('type', 'service').eq('is_archived', false).order('name'),
    supabase.from('staff_schedules').select(COLS_SCHEDULE).eq('tenant_id', tenantId).order('weekday').order('start_time'),
    supabase.from('staff_time_off').select(COLS_TIMEOFF).eq('tenant_id', tenantId)
      .gte('ends_at', new Date().toISOString()).order('starts_at'),
    supabase.from('staff_services').select(COLS_STAFF_SERVICE).eq('tenant_id', tenantId),
    supabase.from('booking_settings').select(COLS_SETTINGS).eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('booking_zones').select(COLS_ZONE).eq('tenant_id', tenantId).eq('active', true).order('name'),
  ]);

  const fallo = [staff, servicios, horarios, ausencias, relaciones, reglas, zonas].find(r => r.error);
  if (fallo) {
    console.error('fetchAgendaBase:', fallo.error.message);
    return null;
  }
  return {
    staff: staff.data || [],
    servicios: servicios.data || [],
    horarios: horarios.data || [],
    ausencias: ausencias.data || [],
    relaciones: relaciones.data || [],
    zonas: zonas.data || [],
    reglas: { ...REGLAS_POR_DEFECTO, ...(reglas.data || {}) },
    reglasGuardadas: !!reglas.data,
  };
}

/**
 * Horarios en que se puede reservar un servicio (rango de fechas locales
 * 'YYYY-MM-DD'). Sin staffId devuelve una fila por profesional libre.
 */
export async function fetchSlots(tenantId, serviceId, desde, hasta, {
  staffId = null, locationKind = 'local', travelMin = null,
} = {}) {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_tenant_id: tenantId,
    p_service_id: serviceId,
    p_from: desde,
    p_to: hasta,
    p_staff_id: staffId,
    p_location_kind: locationKind,
    // Traslado de la zona elegida; sin el, la base usa el fijo del negocio.
    p_travel_min: travelMin,
  });
  if (error) {
    console.error('fetchSlots:', error.message);
    return { __error: 'db', message: traducir(error.message), slots: [] };
  }
  return { ok: true, slots: data || [] };
}

/* ─────────────────────────── Profesionales ─────────────────────────── */

export async function saveStaffMember(tenantId, { id, name, color }) {
  const limpio = String(name || '').trim();
  if (!limpio) return { __error: 'sin_nombre', message: 'Poné un nombre.' };
  const fila = { name: limpio, color: color || null };
  const q = id
    ? supabase.from('staff').update(fila).eq('id', id).eq('tenant_id', tenantId)
    : supabase.from('staff').insert({ ...fila, tenant_id: tenantId });
  const { data, error } = await q.select(COLS_STAFF).single();
  if (error) {
    console.error('saveStaffMember:', error.message);
    return { __error: 'db', message: traducir(error.message) };
  }
  return { ok: true, staff: data };
}

/* ───────────────────────────── Horarios ────────────────────────────── */

/**
 * Reemplaza el horario semanal de UNA profesional.
 * `tramos`: [{ weekday: 0-6, start_time: 'HH:MM', end_time: 'HH:MM' }].
 *
 * Primero inserta lo nuevo y recien despues borra lo viejo: si el insert
 * falla, la profesional conserva el horario que tenia en vez de quedar sin
 * ninguno (sin horario no tiene huecos, y nadie se entera).
 */
export async function saveWeeklySchedule(tenantId, staffId, tramos) {
  const nuevos = (tramos || []).map(t => ({
    tenant_id: tenantId,
    staff_id: staffId,
    weekday: Number(t.weekday),
    start_time: t.start_time,
    end_time: t.end_time,
  }));
  const { data: viejos, error: errLeer } = await supabase
    .from('staff_schedules').select('id').eq('tenant_id', tenantId).eq('staff_id', staffId);
  if (errLeer) {
    console.error('saveWeeklySchedule/leer:', errLeer.message);
    return { __error: 'db', message: traducir(errLeer.message) };
  }
  if (nuevos.length) {
    const { error } = await supabase.from('staff_schedules').insert(nuevos);
    if (error) {
      console.error('saveWeeklySchedule/insert:', error.message);
      return { __error: 'db', message: traducir(error.message) };
    }
  }
  const ids = (viejos || []).map(v => v.id);
  if (ids.length) {
    const { error } = await supabase.from('staff_schedules').delete().in('id', ids);
    if (error) {
      console.error('saveWeeklySchedule/borrar:', error.message);
      return { __error: 'db', message: traducir(error.message) };
    }
  }
  return { ok: true };
}

/* ───────────────────────────── Ausencias ───────────────────────────── */

/** staffId nulo = cierra el negocio entero (feriado, vacaciones del local). */
export async function addTimeOff(tenantId, { staffId = null, startsAt, endsAt, reason }) {
  const { data, error } = await supabase.from('staff_time_off').insert({
    tenant_id: tenantId,
    staff_id: staffId,
    starts_at: startsAt,
    ends_at: endsAt,
    reason: reason?.trim() || null,
  }).select(COLS_TIMEOFF).single();
  if (error) {
    console.error('addTimeOff:', error.message);
    return { __error: 'db', message: traducir(error.message) };
  }
  return { ok: true, ausencia: data };
}

export async function removeTimeOff(tenantId, id) {
  const { error } = await supabase.from('staff_time_off')
    .delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) {
    console.error('removeTimeOff:', error.message);
    return false;
  }
  return true;
}

/* ──────────────────── Servicios: duracion y quien los hace ─────────── */

/**
 * Duracion y margen de un servicio. Se edita aca y no en el editor de
 * productos para que la dueña lo cargue donde esta armando la agenda.
 */
export async function saveServiceTiming(tenantId, serviceId, { duration_min, buffer_after_min, is_addon }) {
  const dur = duration_min === '' || duration_min == null ? null : Math.round(Number(duration_min));
  const buf = Math.max(0, Math.round(Number(buffer_after_min) || 0));
  if (dur != null && !(dur > 0)) {
    return { __error: 'duracion', message: 'La duración tiene que ser mayor a cero.' };
  }
  const { error } = await supabase.from('products')
    // is_addon solo se toca si viene: los llamados viejos no lo pisan.
    .update({ duration_min: dur, buffer_after_min: buf, ...(is_addon === undefined ? {} : { is_addon: !!is_addon }) })
    .eq('id', serviceId).eq('tenant_id', tenantId);
  if (error) {
    console.error('saveServiceTiming:', error.message);
    return { __error: 'db', message: traducir(error.message) };
  }
  return { ok: true };
}

/**
 * Que servicios hace una profesional. Sin ningun servicio asignado a nadie,
 * cualquiera puede hacer cualquiera (ver get_available_slots): por eso
 * guardar un set vacio vuelve a ese comportamiento.
 */
export async function saveStaffServices(tenantId, staffId, serviceIds) {
  const { error: errBorrar } = await supabase.from('staff_services')
    .delete().eq('tenant_id', tenantId).eq('staff_id', staffId);
  if (errBorrar) {
    console.error('saveStaffServices/borrar:', errBorrar.message);
    return { __error: 'db', message: traducir(errBorrar.message) };
  }
  const filas = [...new Set(serviceIds || [])].map(service_id => ({
    tenant_id: tenantId, staff_id: staffId, service_id,
  }));
  if (filas.length) {
    const { error } = await supabase.from('staff_services').insert(filas);
    if (error) {
      console.error('saveStaffServices/insert:', error.message);
      return { __error: 'db', message: traducir(error.message) };
    }
  }
  return { ok: true };
}

/* ───────────────────────── Zonas de domicilio ───────────────────────── */

/**
 * Una zona es una localidad o barrio con su tiempo de viaje. Alta o edicion.
 * El traslado depende de la direccion de quien reserva: se elige la zona al
 * reservar y esos minutos viajan en el turno (travel_min) y en la consulta de
 * huecos.
 */
export async function saveZone(tenantId, { id, name, travel_min }) {
  const limpio = String(name || '').trim();
  if (!limpio) return { __error: 'sin_nombre', message: 'Poné el nombre de la zona.' };
  const min = Math.round(Number(travel_min));
  if (!Number.isFinite(min) || min < 0) {
    return { __error: 'minutos', message: 'Poné los minutos de viaje (cero o más).' };
  }
  const fila = { name: limpio, travel_min: min };
  const q = id
    ? supabase.from('booking_zones').update(fila).eq('id', id).eq('tenant_id', tenantId)
    : supabase.from('booking_zones').insert({ ...fila, tenant_id: tenantId });
  const { data, error } = await q.select(COLS_ZONE).single();
  if (error) {
    console.error('saveZone:', error.message);
    return { __error: 'db', message: traducir(error.message) };
  }
  return { ok: true, zona: data };
}

/** Baja logica: los turnos viejos conservan la zona que tenian. */
export async function removeZone(tenantId, id) {
  const { error } = await supabase.from('booking_zones')
    .update({ active: false }).eq('id', id).eq('tenant_id', tenantId);
  if (error) {
    console.error('removeZone:', error.message);
    return false;
  }
  return true;
}

/* ─────────────────────────── Reglas de reserva ─────────────────────── */

export async function saveBookingSettings(tenantId, reglas) {
  const fila = {
    tenant_id: tenantId,
    min_notice_min: Math.max(0, Math.round(Number(reglas.min_notice_min))),
    max_advance_days: Math.round(Number(reglas.max_advance_days)),
    slot_step_min: Math.round(Number(reglas.slot_step_min)),
    cancel_window_hours: Math.max(0, Math.round(Number(reglas.cancel_window_hours))),
    offers_local: !!reglas.offers_local,
    offers_home: !!reglas.offers_home,
    travel_min: Math.max(0, Math.round(Number(reglas.travel_min) || 0)),
    deposit_mode: reglas.deposit_mode || 'none',
    deposit_value: reglas.deposit_mode && reglas.deposit_mode !== 'none'
      ? Number(reglas.deposit_value) : null,
    deposit_hold_min: Math.max(1, Math.round(Number(reglas.deposit_hold_min) || 30)),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('booking_settings').upsert(fila, { onConflict: 'tenant_id' });
  if (error) {
    console.error('saveBookingSettings:', error.message);
    return { __error: 'db', message: traducir(error.message) };
  }
  return { ok: true };
}
