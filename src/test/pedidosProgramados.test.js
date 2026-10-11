import { describe, it, expect } from 'vitest';
import {
  leadHoras, fechaYMinutos, estadoDelLocal, horasDisponibles, LEAD_MAX_HORAS,
} from '../modules/pedidosProgramados';

const TZ = 'America/Argentina/Buenos_Aires'; // UTC-3 todo el año
const semana = (open, close) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(i => [i, { open, close }]));
// El horario real de Crazy Miga: 12:00 a 01:00, todos los dias.
const CRAZY = { store_hours: semana('12:00', '01:00'), lead_time_hours: 4 };
// 2026-10-10 es sabado. Los instantes se dan en UTC; ART = UTC-3.
const art = (dia, hhmm) => new Date(`${dia}T${hhmm}:00-03:00`);

describe('leadHoras', () => {
  it('lee el numero y trata vacio, cero y basura como "sin encargo"', () => {
    expect(leadHoras({ lead_time_hours: 4 })).toBe(4);
    expect(leadHoras({ lead_time_hours: '4' })).toBe(4);
    expect(leadHoras({ lead_time_hours: 0 })).toBe(0);
    expect(leadHoras({ lead_time_hours: null })).toBe(0);
    expect(leadHoras({ lead_time_hours: 'abc' })).toBe(0);
    expect(leadHoras({ lead_time_hours: -3 })).toBe(0);
    expect(leadHoras(undefined)).toBe(0);
  });
  it('topea en 72 horas', () => {
    expect(leadHoras({ lead_time_hours: 500 })).toBe(LEAD_MAX_HORAS);
  });
});

describe('fechaYMinutos', () => {
  it('usa la zona del negocio: a las 01:30 UTC en Buenos Aires todavia es el dia anterior', () => {
    expect(fechaYMinutos(new Date('2026-10-11T01:30:00Z'), TZ)).toEqual({ iso: '2026-10-10', minutos: 22 * 60 + 30 });
  });
});

describe('estadoDelLocal con horario que cruza la medianoche', () => {
  it('abierto a las 15:00 y a las 00:30', () => {
    expect(estadoDelLocal(CRAZY, art('2026-10-10', '15:00'), TZ).open).toBe(true);
    expect(estadoDelLocal(CRAZY, art('2026-10-11', '00:30'), TZ).open).toBe(true);
  });
  it('cerrado a las 03:00 y a las 11:00', () => {
    expect(estadoDelLocal(CRAZY, art('2026-10-10', '03:00'), TZ).open).toBe(false);
    expect(estadoDelLocal(CRAZY, art('2026-10-10', '11:00'), TZ).open).toBe(false);
  });
  it('sin horarios cargados queda abierto', () => {
    expect(estadoDelLocal({}, art('2026-10-10', '03:00'), TZ).open).toBe(true);
  });
});

describe('horasDisponibles por encargo (4 h, 12:00 a 01:00)', () => {
  const horas = (dia, ahora) => horasDisponibles({ settings: CRAZY, fechaISO: dia, ahora, timezone: TZ });

  it('de manana pide con 4 h de margen: 10:00 -> desde las 14', () => {
    expect(horas('2026-10-10', art('2026-10-10', '10:00'))).toEqual([14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  });
  it('a las 10:30 el primer horario entero posible es las 15', () => {
    expect(horas('2026-10-10', art('2026-10-10', '10:30'))[0]).toBe(15);
  });
  it('de madrugada (fuera de horario) se puede pedir: a las 03:00 hoy se entrega desde las 12', () => {
    expect(horas('2026-10-10', art('2026-10-10', '03:00'))[0]).toBe(12);
  });
  it('de noche ya no queda nada hoy y manana arranca a las 12', () => {
    const ahora = art('2026-10-10', '21:00');
    expect(horas('2026-10-10', ahora)).toEqual([]);
    expect(horas('2026-10-11', ahora)[0]).toBe(12);
  });
  it('nunca ofrece una hora anterior a la apertura ni la de la madrugada siguiente', () => {
    const lista = horas('2026-10-11', art('2026-10-10', '09:00'));
    expect(Math.min(...lista)).toBe(12);
    expect(Math.max(...lista)).toBe(23);
  });
  it('mide el margen en la zona del negocio, no en UTC', () => {
    // 22:30 ART del sabado es 01:30 UTC del domingo: el dia de hoy sigue siendo el 10.
    const ahora = new Date('2026-10-11T01:30:00Z');
    expect(horas('2026-10-10', ahora)).toEqual([]);
    expect(horas('2026-10-11', ahora)[0]).toBe(12);
  });
});

describe('horasDisponibles al momento (sin encargo)', () => {
  const normal = { store_hours: semana('09:00', '23:00') };
  it('desde una hora despues de abrir hasta una hora antes de cerrar', () => {
    const h = horasDisponibles({ settings: normal, fechaISO: '2026-10-12', ahora: art('2026-10-10', '08:00'), timezone: TZ });
    expect(h[0]).toBe(10);
    expect(h[h.length - 1]).toBe(22);
  });
  it('hoy deja una hora de margen: a las 14:10 el primero es las 16', () => {
    const h = horasDisponibles({ settings: normal, fechaISO: '2026-10-10', ahora: art('2026-10-10', '14:10'), timezone: TZ });
    expect(h[0]).toBe(16);
  });
  it('un dia cerrado no tiene horas', () => {
    const settings = { store_hours: { ...semana('09:00', '23:00'), 5: { closed: true } } }; // sabado (indice 5: la semana empieza el lunes)
    expect(horasDisponibles({ settings, fechaISO: '2026-10-10', ahora: art('2026-10-08', '10:00'), timezone: TZ })).toEqual([]);
  });
  it('sin horarios cargados ofrece el dia entero en vez de dejar al cliente sin opciones', () => {
    const h = horasDisponibles({ settings: {}, fechaISO: '2026-10-12', ahora: art('2026-10-10', '10:00'), timezone: TZ });
    expect(h.length).toBeGreaterThan(10);
  });
});
