// src/modules/pedidosProgramados.js
// Cuando se puede entregar un pedido del catalogo.
//
// Dos modos, segun `settings.lead_time_hours` (Personalizacion):
//   0 / vacio  el negocio vende "al momento": existe "Ahora" cuando esta
//              abierto, y programar pide una hora de margen.
//   N > 0      el negocio trabaja POR ENCARGO (tarda N horas en prepararlo):
//              "Ahora" no existe, se puede pedir a cualquier hora aunque el
//              local este cerrado, y la entrega se programa para dentro de al
//              menos N horas, siempre dentro del horario de entrega.
//
// Todo se calcula en la zona horaria del NEGOCIO, no en la del celular: un
// pedido a las 22:30 de Buenos Aires es del dia 10 aunque en UTC ya sea el 11.
// El horario puede cruzar la medianoche (12:00 a 01:00): `hasta` menor que
// `desde` significa "hasta el dia siguiente".

import { estaOperativo, ventanaOperativa, horarioDelDia, aMinutos } from './estadoOperativo.js';

export const LEAD_MAX_HORAS = 72;

/** Horas de anticipacion del negocio. 0 = no trabaja por encargo. */
export function leadHoras(settings) {
  const n = Number(settings?.lead_time_hours);
  return Number.isFinite(n) && n > 0 ? Math.min(n, LEAD_MAX_HORAS) : 0;
}

/** Fecha (YYYY-MM-DD) y minutos del dia de `fecha` en la zona del negocio. */
export function fechaYMinutos(fecha, timezone) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || undefined,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(fecha);
  const v = (t) => partes.find(p => p.type === t)?.value;
  return {
    iso: `${v('year')}-${v('month')}-${v('day')}`,
    minutos: Number(v('hour')) * 60 + Number(v('minute')),
  };
}

// Minutos desde un origen comun para una fecha YYYY-MM-DD (sirve para restar).
const diaEnMinutos = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 60000;
};

/**
 * Si el local esta abierto ahora y un texto para mostrar.
 * Con horario que cruza la medianoche cuenta bien (a las 00:30 de un local
 * 12:00-01:00 sigue abierto).
 */
export function estadoDelLocal(settings, ahora, timezone) {
  const abierto = estaOperativo(settings, ahora, timezone);
  if (abierto) {
    const v = ventanaOperativa(settings, ahora, timezone);
    return { open: true, msg: v.horaObjetivo ? `Abierto hasta las ${v.horaObjetivo}` : '' };
  }
  return { open: false, msg: 'Ahora estamos cerrados. Podés programar tu pedido.' };
}

/**
 * Horas enteras en que se puede entregar el dia `fechaISO`.
 * Ver el encabezado para las dos reglas.
 *
 * Una hora puede ser 24 o mas: es la madrugada del dia SIGUIENTE dentro del
 * mismo horario (25 = 01:00 del dia siguiente). Asi un negocio 12:00 a 01:00
 * ofrece de 12 a 25. Por encargo los extremos son inclusivos: se entrega
 * justo a la apertura y justo al cierre. Al momento se conserva el margen de
 * una hora antes de cerrar. `entregaReal` traduce la hora a fecha y reloj.
 */
export function horasDisponibles({ settings, fechaISO, ahora, timezone }) {
  if (!fechaISO) return [];
  const encargo = leadHoras(settings);
  const horarios = settings?.store_hours;
  const diaSemanaJs = new Date(diaEnMinutos(fechaISO) * 60000).getUTCDay();

  let desde = 0;
  let hasta = 1440;
  if (horarios && Object.keys(horarios).length > 0) {
    const dia = horarioDelDia(horarios, diaSemanaJs);
    if (!dia || dia.cerrado) return [];
    if (!dia.h24) {
      const a = aMinutos(dia.desde);
      const b = aMinutos(dia.hasta);
      if (a != null && b != null && a !== b) { desde = a; hasta = b > a ? b : b + 1440; }
    }
  }

  const { iso, minutos } = fechaYMinutos(ahora, timezone);
  const ahoraAbs = diaEnMinutos(iso) + minutos;
  const minimo = ahoraAbs + (encargo > 0 ? encargo * 60 : 60);
  // Al momento: una hora despues de abrir (preparacion). Por encargo: el
  // margen ya lo da el lead, se entrega desde que abre hasta que cierra.
  const primera = Math.ceil((encargo > 0 ? desde : desde + 60) / 60);
  const ultima = Math.floor((hasta - (encargo > 0 ? 0 : 60)) / 60);

  const base = diaEnMinutos(fechaISO);
  const horas = [];
  for (let h = primera; h <= ultima; h += 1) {
    if (base + h * 60 >= minimo) horas.push(h);
  }
  return horas;
}

const dos = (n) => String(n).padStart(2, '0');

/**
 * La fecha y la hora de reloj reales de una entrega elegida como (dia, hora).
 * `hora` es "HH:MM" o "25:00" (madrugada del dia siguiente). Devuelve
 * { fechaISO, hhmm, diaSiguiente }.
 */
export function entregaReal(fechaISO, hora) {
  const [h, m] = String(hora || '').split(':').map(Number);
  if (!fechaISO || !Number.isFinite(h)) return { fechaISO, hhmm: hora || '', diaSiguiente: false };
  const minutos = Number.isFinite(m) ? m : 0;
  if (h < 24) return { fechaISO, hhmm: `${dos(h)}:${dos(minutos)}`, diaSiguiente: false };
  const [y, mes, d] = fechaISO.split('-').map(Number);
  const f = new Date(Date.UTC(y, mes - 1, d + Math.floor(h / 24)));
  return {
    fechaISO: `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`,
    hhmm: `${dos(h % 24)}:${dos(minutos)}`,
    diaSiguiente: true,
  };
}
