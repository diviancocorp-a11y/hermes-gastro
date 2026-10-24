// src/catalog-pro/reservarHelpers.js
// Funciones puras de la reserva online publica. Los dias son 'YYYY-MM-DD' en
// la hora del NEGOCIO (no la del celular de la clienta): un turno a las 10:00
// en Zona Norte se ve a las 10:00 aunque ella este de viaje.

import { sumarDias } from '../modules/agenda.js';

const dos = (n) => String(n).padStart(2, '0');

/** Una zona horaria valida o undefined (Intl tira RangeError con una invalida). */
function zonaValida(tz) {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat('es-AR', { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

/** { dia: 'YYYY-MM-DD', hora: 'HH:MM' } de un instante, en la zona del negocio. */
export function partesEnZona(instante, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaValida(tz), year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(instante)).map(x => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

export const hoyEnZona = (tz, ahora = new Date()) => partesEnZona(ahora, tz).dia;

/** Fecha 'YYYY-MM-DD' como mediodia UTC: formatearla en UTC no se corre de dia. */
const mediodiaUtc = (dia) => {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

/** 'martes 3 de noviembre' */
export function etiquetaLarga(dia) {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(mediodiaUtc(dia));
}

/** { semana: 'mar', numero: 3, mes: 'nov' } para la tira de dias. */
export function etiquetaCorta(dia) {
  const f = (opts) => new Intl.DateTimeFormat('es-AR', { ...opts, timeZone: 'UTC' }).format(mediodiaUtc(dia));
  return {
    semana: f({ weekday: 'short' }).replace('.', ''),
    numero: Number(dia.slice(8, 10)),
    mes: f({ month: 'short' }).replace('.', ''),
  };
}

/** '2 h 30', '1 h', '45 min' */
export function formatearDuracion(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${dos(r)}` : `${h} h`;
}

/** Horarios de un dia agrupados por hora de comienzo (hora del negocio). */
export function horariosDelDia(slots = [], dia, tz) {
  const grupos = new Map();
  for (const s of slots) {
    const p = partesEnZona(s.starts_at, tz);
    if (p.dia !== dia) continue;
    const lista = grupos.get(p.hora) || [];
    lista.push({ staff_id: s.staff_id, starts_at: s.starts_at, ends_at: s.ends_at });
    grupos.set(p.hora, lista);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hora, opciones]) => ({ hora, opciones }));
}

/** Dias (con al menos un horario) presentes en una lista de slots. */
export function diasConLugar(slots = [], tz) {
  return new Set(slots.map(s => partesEnZona(s.starts_at, tz).dia));
}

/** Rangos de hasta 14 dias que cubren [hoy, hoy + maxDias]. */
export function paginaDeDias(hoy, pagina, maxDias) {
  const desde = sumarDias(hoy, pagina * 14);
  const tope = sumarDias(hoy, Math.max(0, maxDias));
  if (desde > tope) return null;
  const hasta = sumarDias(desde, 13) < tope ? sumarDias(desde, 13) : tope;
  return { desde, hasta };
}

/** Lista 'YYYY-MM-DD' de desde a hasta, inclusive. */
export function listaDeDias(desde, hasta) {
  const out = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) out.push(d);
  return out;
}

/** '24:59' / '4:05' para la cuenta regresiva de la sena. */
export function cuentaRegresiva(iso, ahora = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '0:00';
  const seg = Math.max(0, Math.ceil((t - ahora) / 1000));
  return `${Math.floor(seg / 60)}:${dos(seg % 60)}`;
}

/** Telefono tipeado: deja digitos, +, espacios y guiones; minimo 8 digitos. */
export function telefonoValido(texto) {
  return String(texto || '').replace(/\D/g, '').length >= 8;
}

export function correoValido(texto) {
  const t = String(texto || '').trim();
  return t === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}
