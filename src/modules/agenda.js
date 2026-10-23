// src/modules/agenda.js
// Reglas puras de la agenda de servicios: fechas locales, estados del turno,
// posicion en la grilla, resumen de horarios, WhatsApp y que falta configurar.
// Sin React ni red: se prueba en src/test/agenda.test.js.
//
// Las fechas son las del navegador de quien mira el panel. El negocio atiende
// en su zona (tenants.timezone) y quien abre la agenda esta ahi; la funcion de
// huecos de la base, en cambio, siempre calcula en la zona del negocio.

export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
// La semana empieza el lunes; en la base 0 es domingo (extract(dow)).
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** Los colores que se ofrecen para identificar a cada profesional. */
export const COLORES_STAFF = ['#df0359', '#7a5af8', '#0e9384', '#d97706', '#2563eb', '#475467'];

const dos = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' del dia local (no el UTC: a las 22 ya es otro dia en UTC). */
export function diaLocal(fecha = new Date()) {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Suma dias a un 'YYYY-MM-DD' sin pasar por UTC. */
export function sumarDias(dia, n) {
  const [y, m, d] = dia.split('-').map(Number);
  return diaLocal(new Date(y, m - 1, d + n));
}

/** Medianoche local de un 'YYYY-MM-DD'. */
export function inicioDelDia(dia) {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Rango ISO [desde, hasta] que cubre el dia local completo. */
export function rangoDelDia(dia) {
  const ini = inicioDelDia(dia);
  const fin = new Date(ini); fin.setHours(23, 59, 59, 999);
  return { desde: ini.toISOString(), hasta: fin.toISOString() };
}

export function weekdayDe(dia) {
  return inicioDelDia(dia).getDay();
}

/** 'HH:MM' local de un instante. */
export function hhmm(instante) {
  const d = new Date(instante);
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Minutos desde medianoche de 'HH:MM' o 'HH:MM:SS'. */
export function aMinutos(hora) {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 'HH:MM' desde minutos (para el input type=time). */
export function deMinutos(min) {
  return `${dos(Math.floor(min / 60))}:${dos(min % 60)}`;
}

/** 'lunes 12 de octubre' */
export function etiquetaDelDia(dia) {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(inicioDelDia(dia));
}

/* ─────────────────────────────── Estados ────────────────────────────── */

export const ESTADOS = {
  booked:     { label: 'Reservado',    tono: 'neutro' },
  confirmed:  { label: 'Confirmado',   tono: 'info' },
  arrived:    { label: 'Llegó',        tono: 'info' },
  in_service: { label: 'En atención',  tono: 'activo' },
  done:       { label: 'Terminado',    tono: 'ok' },
  no_show:    { label: 'No vino',      tono: 'alerta' },
  cancelled:  { label: 'Cancelado',    tono: 'apagado' },
};

// Lo que se puede hacer desde cada estado. El primero es la accion principal.
const SIGUIENTES = {
  booked:     ['confirmed', 'arrived', 'cancelled', 'no_show'],
  confirmed:  ['arrived', 'cancelled', 'no_show'],
  arrived:    ['in_service', 'cancelled', 'no_show'],
  in_service: ['done'],
  done: [],
  no_show: [],
  cancelled: [],
};

export function siguientesEstados(status) {
  return SIGUIENTES[status] || [];
}

/** Verbo del boton que lleva a ese estado. */
export const ACCION_HACIA = {
  confirmed: 'Confirmar',
  arrived: 'Llegó',
  in_service: 'Empezar',
  done: 'Terminar',
  no_show: 'No vino',
  cancelled: 'Cancelar turno',
};

/** Un turno cancelado no ocupa lugar; un no_show si (igual que la base). */
export const ocupaLugar = (t) => t.status !== 'cancelled';

/* ──────────────────────────── Grilla del dia ────────────────────────── */

/**
 * Tramo del dia que se dibuja: del primer horario de trabajo al ultimo,
 * ampliado si hay un turno fuera de ese horario (nunca se oculta un turno).
 * Devuelve minutos desde medianoche, redondeados a la hora.
 */
export function ventanaDelDia(horarios = [], turnos = [], weekday, { porDefecto = [9 * 60, 20 * 60] } = {}) {
  let ini = Infinity;
  let fin = -Infinity;
  for (const h of horarios) {
    if (h.weekday !== weekday) continue;
    ini = Math.min(ini, aMinutos(h.start_time));
    fin = Math.max(fin, aMinutos(h.end_time));
  }
  for (const t of turnos) {
    if (!ocupaLugar(t)) continue;
    const a = new Date(t.starts_at); const b = new Date(t.ends_at);
    ini = Math.min(ini, a.getHours() * 60 + a.getMinutes());
    fin = Math.max(fin, b.getHours() * 60 + b.getMinutes());
  }
  if (!Number.isFinite(ini)) [ini, fin] = porDefecto;
  return { inicio: Math.floor(ini / 60) * 60, fin: Math.ceil(fin / 60) * 60 };
}

/** Posicion vertical y alto de un turno, en la unidad que se elija (px, %). */
export function posicionDeTurno(turno, inicioMin, porMinuto) {
  const a = new Date(turno.starts_at); const b = new Date(turno.ends_at);
  const desde = a.getHours() * 60 + a.getMinutes();
  const hasta = b.getHours() * 60 + b.getMinutes();
  return { top: (desde - inicioMin) * porMinuto, alto: Math.max(hasta - desde, 15) * porMinuto };
}

/* ───────────────────────────── Horarios ─────────────────────────────── */

/**
 * "Lun a vie 10:00–18:00 · Sáb 10:00–14:00". Junta dias seguidos con el mismo
 * horario. Vacio si la profesional no tiene horario (y por lo tanto no tiene
 * huecos: eso hay que decirlo, no esconderlo).
 */
export function resumenDeHorario(tramos = []) {
  if (!tramos.length) return '';
  const porDia = new Map();
  for (const t of tramos) {
    const clave = `${String(t.start_time).slice(0, 5)}–${String(t.end_time).slice(0, 5)}`;
    const lista = porDia.get(t.weekday) || [];
    lista.push(clave);
    porDia.set(t.weekday, lista.sort());
  }
  const grupos = [];
  for (const wd of ORDEN_SEMANA) {
    if (!porDia.has(wd)) continue;
    const firma = porDia.get(wd).join(' y ');
    const ultimo = grupos[grupos.length - 1];
    const pos = ORDEN_SEMANA.indexOf(wd);
    if (ultimo && ultimo.firma === firma && ultimo.hasta === pos - 1) {
      ultimo.hasta = pos;
      ultimo.dias.push(wd);
    } else {
      grupos.push({ firma, desde: pos, hasta: pos, dias: [wd] });
    }
  }
  return grupos.map(g => {
    const nombre = g.dias.length === 1
      ? DIAS_CORTOS[g.dias[0]]
      : `${DIAS_CORTOS[g.dias[0]]} a ${DIAS_CORTOS[g.dias[g.dias.length - 1]].toLowerCase()}`;
    return `${nombre} ${g.firma}`;
  }).join(' · ');
}

/** Los tramos de un dia de la semana, en orden. */
export function tramosDelDia(tramos = [], weekday) {
  return tramos.filter(t => t.weekday === weekday)
    .sort((a, b) => aMinutos(a.start_time) - aMinutos(b.start_time));
}

/**
 * Valida el horario semanal antes de mandarlo: fin posterior al inicio y sin
 * tramos pisados dentro del mismo dia. Devuelve el primer problema o null.
 */
export function validarTramos(tramos = []) {
  const porDia = new Map();
  for (const t of tramos) {
    if (aMinutos(t.end_time) <= aMinutos(t.start_time)) {
      return `${DIAS[t.weekday]}: la hora de fin tiene que ser posterior a la de inicio.`;
    }
    const lista = porDia.get(t.weekday) || [];
    lista.push(t);
    porDia.set(t.weekday, lista);
  }
  for (const [wd, lista] of porDia) {
    const orden = [...lista].sort((a, b) => aMinutos(a.start_time) - aMinutos(b.start_time));
    for (let i = 1; i < orden.length; i++) {
      if (aMinutos(orden[i].start_time) < aMinutos(orden[i - 1].end_time)) {
        return `${DIAS[wd]}: dos tramos se pisan.`;
      }
    }
  }
  return null;
}

/* ───────────────────────────── Huecos ───────────────────────────────── */

/**
 * Agrupa los huecos de la base por hora de comienzo: { 'HH:MM': [staff_id] }.
 * Con "cualquiera" la pantalla muestra la hora una sola vez y elige quien.
 */
export function agruparPorHora(slots = []) {
  const grupos = new Map();
  for (const s of slots) {
    const clave = hhmm(s.starts_at);
    const lista = grupos.get(clave) || [];
    lista.push({ staff_id: s.staff_id, starts_at: s.starts_at, ends_at: s.ends_at });
    grupos.set(clave, lista);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hora, opciones]) => ({ hora, opciones }));
}

/* ───────────────────────── Que falta configurar ─────────────────────── */

/**
 * Pasos que faltan para que haya algun hueco que ofrecer. La agenda recien
 * creada esta vacia por una razon, y quien la abre tiene que ver cual en vez
 * de una grilla en blanco.
 */
export function faltaConfigurar(base) {
  if (!base) return [];
  const faltan = [];
  if (!base.staff.length) faltan.push({ id: 'staff', texto: 'Cargá quién atiende.' });
  const sinDuracion = base.servicios.filter(s => !(s.duration_min > 0));
  if (!base.servicios.length) {
    faltan.push({ id: 'servicios', texto: 'No hay servicios cargados.' });
  } else if (sinDuracion.length) {
    faltan.push({
      id: 'duraciones',
      texto: sinDuracion.length === base.servicios.length
        ? 'Ningún servicio tiene duración: sin eso no se pueden calcular horarios.'
        : `${sinDuracion.length} servicio(s) sin duración: ${sinDuracion.map(s => s.name).join(', ')}.`,
    });
  }
  const conHorario = new Set(base.horarios.map(h => h.staff_id));
  const sinHorario = base.staff.filter(s => !conHorario.has(s.id));
  if (base.staff.length && sinHorario.length) {
    faltan.push({
      id: 'horarios',
      texto: `Sin horario de trabajo: ${sinHorario.map(s => s.name).join(', ')}.`,
    });
  }
  return faltan;
}

/** Servicios con los que ya se puede reservar (tienen duracion). */
export const reservables = (servicios = []) => servicios.filter(s => s.duration_min > 0);

/** Profesionales que pueden hacer un servicio (todas si nadie lo tiene asignado). */
export function quienHace(servicioId, staff = [], relaciones = []) {
  const asignadas = relaciones.filter(r => r.service_id === servicioId).map(r => r.staff_id);
  return asignadas.length ? staff.filter(s => asignadas.includes(s.id)) : staff;
}

/* ───────────────────────────── WhatsApp ─────────────────────────────── */

/**
 * Numero para wa.me. Acepta como lo escribe la gente en Argentina:
 * '11 5555-1234', '011 15 5555 1234', '+54 9 11 5555 1234'. Devuelve null si
 * no alcanza para armar un numero, en vez de mandar el mensaje a cualquier lado.
 */
export function telefonoParaWhatsApp(crudo) {
  let n = String(crudo || '').replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('54')) {
    n = n.slice(2);
    if (n.startsWith('9')) n = n.slice(1);
  }
  n = n.replace(/^0+/, '');
  // El 15 del celular viejo: 11 15 5555 1234 -> 11 5555 1234.
  const m = n.match(/^(\d{2,4})15(\d{6,8})$/);
  if (m && (m[1].length + m[2].length) === 10) n = m[1] + m[2];
  if (n.length !== 10) return null;
  return `549${n}`;
}

export function linkWhatsApp(telefono, texto) {
  const num = telefonoParaWhatsApp(telefono);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

/** Recordatorio listo para mandar a mano. */
export function mensajeDeRecordatorio({ turno, servicio, negocio, profesional }) {
  const cuando = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(turno.starts_at));
  const nombre = (turno.customer_name || '').trim().split(/\s+/)[0];
  const donde = turno.location_kind === 'home' && turno.address
    ? ` En ${turno.address}.` : '';
  return `Hola${nombre ? ` ${nombre}` : ''}! Te recuerdo tu turno${servicio ? ` de ${servicio}` : ''}` +
    `${profesional ? ` con ${profesional}` : ''} el ${cuando} a las ${hhmm(turno.starts_at)}.${donde}` +
    ` ¿Me confirmás?${negocio ? ` — ${negocio}` : ''}`;
}
