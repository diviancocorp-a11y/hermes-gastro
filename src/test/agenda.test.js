import { describe, it, expect } from 'vitest';
import {
  diaLocal, sumarDias, rangoDelDia, weekdayDe, aMinutos, deMinutos,
  siguientesEstados, ventanaDelDia, posicionDeTurno, resumenDeHorario,
  validarTramos, agruparPorHora, faltaConfigurar, quienHace, reservables, adicionales,
  telefonoParaWhatsApp, linkWhatsApp, mensajeDeRecordatorio,
} from '../modules/agenda.js';

const tramo = (weekday, start_time, end_time, staff_id = 's1') =>
  ({ weekday, start_time, end_time, staff_id });

describe('fechas locales', () => {
  it('diaLocal usa el dia local y no el UTC', () => {
    // 23:30 del 5/oct local es el 6/oct en UTC-3: tiene que dar el 5.
    expect(diaLocal(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05');
  });
  it('sumarDias cruza mes y anio', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('rangoDelDia cubre de 00:00 a 23:59 locales', () => {
    const { desde, hasta } = rangoDelDia('2026-10-05');
    expect(new Date(desde).getHours()).toBe(0);
    expect(new Date(hasta).getHours()).toBe(23);
    expect(new Date(hasta).getMinutes()).toBe(59);
  });
  it('weekdayDe: 0 es domingo', () => {
    expect(weekdayDe('2026-10-04')).toBe(0);
    expect(weekdayDe('2026-10-05')).toBe(1);
  });
  it('minutos de ida y vuelta', () => {
    expect(aMinutos('10:30:00')).toBe(630);
    expect(deMinutos(630)).toBe('10:30');
  });
});

describe('estados', () => {
  it('el flujo del salon', () => {
    expect(siguientesEstados('booked')).toContain('confirmed');
    expect(siguientesEstados('arrived')[0]).toBe('in_service');
    expect(siguientesEstados('in_service')).toEqual(['done']);
  });
  it('los estados finales no tienen salida', () => {
    for (const e of ['done', 'no_show', 'cancelled']) expect(siguientesEstados(e)).toEqual([]);
  });
  it('un estado desconocido no rompe', () => {
    expect(siguientesEstados('zzz')).toEqual([]);
  });
});

describe('grilla del dia', () => {
  const horarios = [tramo(1, '10:00', '18:00')];
  it('toma del primer al ultimo horario de trabajo', () => {
    expect(ventanaDelDia(horarios, [], 1)).toEqual({ inicio: 600, fin: 1080 });
  });
  it('un dia sin horario usa el tramo por defecto', () => {
    expect(ventanaDelDia(horarios, [], 2)).toEqual({ inicio: 540, fin: 1200 });
  });
  it('nunca esconde un turno fuera de horario', () => {
    const turno = {
      status: 'booked',
      starts_at: new Date(2026, 9, 5, 19, 0).toISOString(),
      ends_at: new Date(2026, 9, 5, 20, 30).toISOString(),
    };
    expect(ventanaDelDia(horarios, [turno], 1).fin).toBe(21 * 60);
  });
  it('un turno cancelado no estira la grilla', () => {
    const turno = {
      status: 'cancelled',
      starts_at: new Date(2026, 9, 5, 22, 0).toISOString(),
      ends_at: new Date(2026, 9, 5, 23, 0).toISOString(),
    };
    expect(ventanaDelDia(horarios, [turno], 1).fin).toBe(1080);
  });
  it('posicion y alto proporcionales a los minutos', () => {
    const t = {
      starts_at: new Date(2026, 9, 5, 11, 0).toISOString(),
      ends_at: new Date(2026, 9, 5, 12, 30).toISOString(),
    };
    expect(posicionDeTurno(t, 600, 1)).toEqual({ top: 60, alto: 90 });
  });
});

describe('resumen de horario', () => {
  it('junta dias seguidos con el mismo horario', () => {
    const t = [1, 2, 3, 4, 5].map(d => tramo(d, '10:00:00', '18:00:00'));
    expect(resumenDeHorario(t)).toBe('Lun a vie 10:00–18:00');
  });
  it('separa horarios distintos y dias sueltos', () => {
    const t = [tramo(1, '10:00', '18:00'), tramo(2, '10:00', '18:00'), tramo(6, '10:00', '14:00')];
    expect(resumenDeHorario(t)).toBe('Lun a mar 10:00–18:00 · Sáb 10:00–14:00');
  });
  it('el domingo va al final de la semana', () => {
    const t = [tramo(6, '10:00', '14:00'), tramo(0, '10:00', '14:00')];
    expect(resumenDeHorario(t)).toBe('Sáb a dom 10:00–14:00');
  });
  it('dia partido', () => {
    const t = [tramo(1, '09:00', '13:00'), tramo(1, '16:00', '20:00')];
    expect(resumenDeHorario(t)).toBe('Lun 09:00–13:00 y 16:00–20:00');
  });
  it('sin horario devuelve vacio', () => {
    expect(resumenDeHorario([])).toBe('');
  });
});

describe('validarTramos', () => {
  it('acepta un horario normal y partido', () => {
    expect(validarTramos([tramo(1, '09:00', '13:00'), tramo(1, '16:00', '20:00')])).toBeNull();
  });
  it('rechaza fin anterior al inicio', () => {
    expect(validarTramos([tramo(1, '18:00', '10:00')])).toMatch(/Lunes/);
  });
  it('rechaza tramos pisados del mismo dia', () => {
    expect(validarTramos([tramo(3, '09:00', '14:00'), tramo(3, '13:00', '18:00')])).toMatch(/se pisan/);
  });
  it('tramos pegados no se pisan', () => {
    expect(validarTramos([tramo(3, '09:00', '13:00'), tramo(3, '13:00', '18:00')])).toBeNull();
  });
});

describe('huecos', () => {
  it('agrupa por hora y junta a las profesionales libres', () => {
    const a = new Date(2026, 9, 5, 10, 0).toISOString();
    const b = new Date(2026, 9, 5, 11, 0).toISOString();
    const r = agruparPorHora([
      { staff_id: 'x', starts_at: b, ends_at: b },
      { staff_id: 'x', starts_at: a, ends_at: a },
      { staff_id: 'y', starts_at: a, ends_at: a },
    ]);
    expect(r.map(g => g.hora)).toEqual(['10:00', '11:00']);
    expect(r[0].opciones.map(o => o.staff_id).sort()).toEqual(['x', 'y']);
  });
});

describe('que falta configurar', () => {
  const base = (o = {}) => ({ staff: [], servicios: [], horarios: [], ...o });
  it('agenda vacia: dice por donde empezar', () => {
    const ids = faltaConfigurar(base()).map(f => f.id);
    expect(ids).toEqual(['staff', 'servicios']);
  });
  it('servicios sin duracion', () => {
    const r = faltaConfigurar(base({
      staff: [{ id: 's1', name: 'Mía' }],
      servicios: [{ id: 'a', name: 'Alisado', duration_min: null }],
    }));
    expect(r.map(f => f.id)).toEqual(['duraciones', 'horarios']);
    expect(r[1].texto).toMatch(/Mía/);
  });
  it('un adicional sin duracion no es una pendiente ni se reserva solo', () => {
    const servicios = [
      { id: 'a', name: 'Soft gel', duration_min: 150 },
      { id: 'f', name: 'Flores 3D', duration_min: null, is_addon: true },
    ];
    expect(faltaConfigurar(base({
      staff: [{ id: 's1', name: 'Mía' }], servicios, horarios: [tramo(1, '10:00', '18:00')],
    }))).toEqual([]);
    expect(reservables(servicios).map(s => s.id)).toEqual(['a']);
    expect(adicionales(servicios).map(s => s.id)).toEqual(['f']);
  });
  it('a domicilio sin zonas ni traslado fijo avisa; con zonas o traslado, no', () => {
    const completa = {
      staff: [{ id: 's1', name: 'Mía' }],
      servicios: [{ id: 'a', name: 'Soft gel', duration_min: 150 }],
      horarios: [tramo(1, '10:00', '18:00')],
    };
    const ids = (extra) => faltaConfigurar(base({ ...completa, ...extra })).map(f => f.id);
    expect(ids({ reglas: { offers_home: true, travel_min: 0 }, zonas: [] })).toEqual(['zonas']);
    expect(ids({ reglas: { offers_home: true, travel_min: 0 }, zonas: [{ id: 'z', name: 'Del Viso', travel_min: 25 }] })).toEqual([]);
    expect(ids({ reglas: { offers_home: true, travel_min: 30 }, zonas: [] })).toEqual([]);
    expect(ids({ reglas: { offers_home: false, travel_min: 0 }, zonas: [] })).toEqual([]);
  });
  it('todo cargado: nada falta', () => {
    expect(faltaConfigurar(base({
      staff: [{ id: 's1', name: 'Mía' }],
      servicios: [{ id: 'a', name: 'Alisado', duration_min: 90 }],
      horarios: [tramo(1, '10:00', '18:00')],
    }))).toEqual([]);
  });
});

describe('quienHace', () => {
  const staff = [{ id: 'a' }, { id: 'b' }];
  it('sin asignaciones lo hace cualquiera', () => {
    expect(quienHace('x', staff, [])).toHaveLength(2);
  });
  it('con asignacion, solo las asignadas', () => {
    expect(quienHace('x', staff, [{ service_id: 'x', staff_id: 'b' }]).map(s => s.id)).toEqual(['b']);
  });
});

describe('WhatsApp', () => {
  it.each([
    ['11 5555-1234', '5491155551234'],
    ['011 15 5555 1234', '5491155551234'],
    ['+54 9 11 5555 1234', '5491155551234'],
    ['(0348) 4 55-1234', '5493484551234'],
    ['', null],
    ['123', null],
  ])('telefono %s', (crudo, esperado) => {
    expect(telefonoParaWhatsApp(crudo)).toBe(esperado);
  });
  it('un numero invalido no arma link', () => {
    expect(linkWhatsApp('123', 'hola')).toBeNull();
  });
  it('el link lleva el texto codificado', () => {
    expect(linkWhatsApp('11 5555 1234', 'hola mundo')).toBe('https://wa.me/5491155551234?text=hola%20mundo');
  });
  it('el recordatorio nombra servicio, hora y domicilio', () => {
    const txt = mensajeDeRecordatorio({
      turno: {
        starts_at: new Date(2026, 9, 5, 15, 30).toISOString(),
        customer_name: 'Lucía Pérez', location_kind: 'home', address: 'Belgrano 123',
      },
      servicio: 'Soft gel', negocio: 'MIA ESTUDIO', profesional: 'Mía',
    });
    expect(txt).toContain('Hola Lucía!');
    expect(txt).toContain('Soft gel');
    expect(txt).toContain('15:30');
    expect(txt).toContain('Belgrano 123');
  });
});
