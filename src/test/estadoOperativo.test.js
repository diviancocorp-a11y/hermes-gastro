import { describe, expect, it } from 'vitest';
import {
  duracionCorta, estaOperativo, horaDelLocal, ventanaOperativa,
} from '../modules/estadoOperativo';

const fechaUtc = (iso) => new Date(iso);
const TZ = 'America/Argentina/Buenos_Aires';

describe('estado operativo del local', () => {
  const horarioEditor = {
    0: { open: '09:00', close: '23:00', closed: false },
    1: { open: '09:00', close: '23:00', closed: false },
    2: { open: '09:00', close: '23:00', closed: false },
    3: { open: '09:00', close: '23:00', closed: false },
    4: { open: '18:00', close: '02:00', closed: false },
    5: { closed: true },
    6: { closed: true },
  };

  it('respeta apertura, cierre y zona horaria', () => {
    expect(estaOperativo({ store_hours: horarioEditor }, fechaUtc('2026-09-07T15:00:00Z'), TZ)).toBe(true);
    expect(estaOperativo({ store_hours: horarioEditor }, fechaUtc('2026-09-07T06:00:00Z'), TZ)).toBe(false);
  });

  it('mantiene abierto el turno que cruza medianoche', () => {
    expect(estaOperativo({ store_hours: horarioEditor }, fechaUtc('2026-09-05T04:00:00Z'), TZ)).toBe(true);
    expect(estaOperativo({ store_hours: horarioEditor }, fechaUtc('2026-09-05T06:00:00Z'), TZ)).toBe(false);
  });

  it('lee el formato historico del edificio', () => {
    const historico = {
      lunes: { open: true, from: '09:00', to: '23:00' },
      martes: { open: false, from: '09:00', to: '23:00' },
    };
    expect(estaOperativo({ store_hours: historico }, fechaUtc('2026-09-07T15:00:00Z'), TZ)).toBe(true);
    expect(estaOperativo({ store_hours: historico }, fechaUtc('2026-09-08T15:00:00Z'), TZ)).toBe(false);
  });

  it('un dia de 24 horas no invade el dia siguiente cerrado', () => {
    const horarios = {
      lunes: { open: true },
      martes: { open: false },
    };
    expect(estaOperativo({ store_hours: horarios }, fechaUtc('2026-09-07T15:00:00Z'), TZ)).toBe(true);
    expect(estaOperativo({ store_hours: horarios }, fechaUtc('2026-09-08T15:00:00Z'), TZ)).toBe(false);
  });

  it('el cierre manual manda y sin horarios queda operativo', () => {
    expect(estaOperativo({ store_open: false, store_hours: horarioEditor }, fechaUtc('2026-09-07T15:00:00Z'), TZ)).toBe(false);
    expect(estaOperativo({ store_open: true, store_hours: null }, fechaUtc('2026-09-07T15:00:00Z'), TZ)).toBe(true);
  });

  it('muestra la hora de la sucursal', () => {
    expect(horaDelLocal(fechaUtc('2026-09-07T15:04:05Z'), TZ)).toBe('12:04:05');
  });

  it('carga la barra durante la ventana operativa', () => {
    const todos = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [
      i, { open: '09:00', close: '23:00', closed: false },
    ]));
    const ventana = ventanaOperativa(
      { store_hours: todos }, fechaUtc('2026-09-07T15:00:00Z'), TZ,
    );
    expect(ventana).toMatchObject({
      operativo: true,
      etiqueta: 'Ventana operativa',
      valor: '09:00 — 23:00',
      detalle: 'Cierra en 11 h',
      horaObjetivo: '23:00',
      minutosRestantes: 660,
      minutosTranscurridos: 180,
    });
    expect(ventana.progreso).toBeCloseTo(3 / 14);
  });

  it('carga la barra de reposo hacia la proxima apertura', () => {
    const todos = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [
      i, { open: '09:00', close: '23:00', closed: false },
    ]));
    const ventana = ventanaOperativa(
      { store_hours: todos }, fechaUtc('2026-09-07T06:00:00Z'), TZ,
    );
    expect(ventana).toMatchObject({
      operativo: false,
      etiqueta: 'Próxima apertura',
      valor: 'Hoy · 09:00',
      detalle: 'Abre en 6 h',
      horaObjetivo: '09:00',
      minutosRestantes: 360,
      diaObjetivo: 'Hoy',
    });
    expect(ventana.progreso).toBeCloseTo(0.4);
  });

  it('resume duraciones operativas sin ceros innecesarios', () => {
    expect(duracionCorta(47)).toBe('47 m');
    expect(duracionCorta(120)).toBe('2 h');
    expect(duracionCorta(167)).toBe('2 h 47 m');
    expect(duracionCorta(1580)).toBe('1 d 2 h');
  });
});
