// Las cuentas del salon: estado de cada mesa y los cuatro numeros de arriba.
//
// Se prueban aca y no en la pantalla porque son reglas, no pintura: cuando una
// mesa cuenta como ocupada, que plata tiene sin cobrar y cual se esta
// demorando. La hora entra por parametro, asi que no hay nada que congelar.
import { describe, it, expect } from 'vitest';
import {
  panoramaDelSalon, estadoDeMesa, indexarPorMesa, minutosDesde, duracionCorta,
} from '../modules/salonDelDia';

const AHORA = new Date('2026-09-10T21:00:00Z').getTime();
const haceMin = (m) => new Date(AHORA - m * 60000).toISOString();

const mesa = (id, capacity = 4, extra = {}) => ({
  id, name: `Mesa ${id}`, capacity, active: true, ...extra,
});
const visita = (resource_id, minutos, extra = {}) => ({
  id: `v-${resource_id}`, resource_id, status: 'open',
  opened_at: haceMin(minutos), ...extra,
});
const orden = (resource_id, total, minutos, status = 'new') => ({
  id: `o-${resource_id}-${total}`, resource_id, total, status,
  created_at: haceMin(minutos),
});

describe('estado de una mesa', () => {
  const conIndice = (recurso, datos) => estadoDeMesa(recurso, indexarPorMesa(datos), AHORA);

  it('sin visita, sin pedidos y sin reserva esta libre', () => {
    const m = conIndice(mesa('m1'), {});
    expect(m.estado).toBe('libre');
    expect(m.consumo).toBe(0);
    expect(m.ocupantes).toBe(0);
  });

  it('con una reserva futura queda reservada, no ocupada', () => {
    const m = conIndice(mesa('m1'), {
      reservas: [{ resource_id: 'm1', status: 'confirmed', starts_at: '2026-09-10T23:30:00Z' }],
    });
    expect(m.estado).toBe('reservada');
    expect(m.proximaReserva.starts_at).toBe('2026-09-10T23:30:00Z');
  });

  // Lo que esta pasando le gana a lo que va a pasar: la mesa tiene gente.
  it('una visita abierta le gana a la reserva de mas tarde', () => {
    const m = conIndice(mesa('m1'), {
      visitas: [visita('m1', 112)],
      reservas: [{ resource_id: 'm1', status: 'confirmed', starts_at: '2026-09-10T23:30:00Z' }],
    });
    expect(m.estado).toBe('ocupada');
    expect(m.abiertaHace).toBe(112);
  });

  it('suma solo los pedidos que siguen abiertos', () => {
    const m = conIndice(mesa('m1'), {
      visitas: [visita('m1', 30)],
      ordenes: [
        orden('m1', 24800, 25, 'preparing'),
        orden('m1', 13200, 10, 'pending_review'),
        orden('m1', 99000, 40, 'completed'),   // ya se cobro: sale de la cuenta
        orden('m1', 5000, 35, 'cancelled'),
      ],
    });
    expect(m.consumo).toBe(38000);
    expect(m.ordenes).toHaveLength(2);
  });

  it('el pedido llega por la visita cuando no trae mesa', () => {
    const m = conIndice(mesa('m1'), {
      visitas: [visita('m1', 20)],
      ordenes: [{ id: 'o1', visit_id: 'v-m1', resource_id: null, total: 7000, status: 'new', created_at: haceMin(5) }],
    });
    expect(m.consumo).toBe(7000);
  });

  it('mide el tiempo desde el ultimo pedido, no desde el primero', () => {
    const m = conIndice(mesa('m1'), {
      visitas: [visita('m1', 112)],
      ordenes: [orden('m1', 1000, 90), orden('m1', 2000, 41)],
    });
    expect(m.sinPedirHace).toBe(41);
  });

  // Es el caso que hay que ver: sentados hace rato y sin pedir nada.
  it('sin pedidos el reloj corre desde que se abrio la mesa', () => {
    const m = conIndice(mesa('m1'), { visitas: [visita('m1', 38)] });
    expect(m.sinPedirHace).toBe(38);
  });

  // En el POS se carga un pedido sobre la mesa sin abrir visita. La mesa esta
  // ocupada igual, y el reloj tiene que arrancar en algun lado.
  it('sin visita, el reloj arranca con el primer pedido', () => {
    const m = conIndice(mesa('m1'), {
      ordenes: [orden('m1', 11000, 64), orden('m1', 4000, 20)],
    });
    expect(m.estado).toBe('ocupada');
    expect(m.abiertaHace).toBe(64);
    expect(m.sinPedirHace).toBe(20);
  });

  it('sin visita y sin pedidos no inventa una hora de apertura', () => {
    expect(conIndice(mesa('m1'), {}).abiertaHace).toBeNull();
  });

  it('los ocupantes salen de la visita y caen a la capacidad', () => {
    const conParty = conIndice(mesa('m1', 6), { visitas: [visita('m1', 10, { party_size: 2 })] });
    const sinParty = conIndice(mesa('m1', 6), { visitas: [visita('m1', 10)] });
    expect(conParty.ocupantes).toBe(2);
    expect(sinParty.ocupantes).toBe(6);
  });
});

describe('panorama del salon', () => {
  const SALON = [mesa('m1', 4), mesa('m2', 4), mesa('m3', 6), mesa('m4', 2)];

  const datos = {
    visitas: [visita('m1', 112, { party_size: 4 }), visita('m3', 22, { party_size: 5 })],
    ordenes: [orden('m1', 45900, 41), orden('m3', 21300, 12)],
    reservas: [{ resource_id: 'm2', status: 'confirmed', starts_at: '2026-09-10T23:30:00Z' }],
  };

  it('cuenta lugares, no horas', () => {
    const p = panoramaDelSalon(SALON, datos, AHORA);
    expect(p.lugares).toBe(16);
    expect(p.ocupados).toBe(9);
    expect(p.capacidadPct).toBe(56);
  });

  it('separa ocupadas, libres y reservadas', () => {
    const p = panoramaDelSalon(SALON, datos, AHORA);
    expect(p.mesasOcupadas).toBe(2);
    expect(p.mesasReservadas).toBe(1);
    expect(p.mesasLibres).toBe(1);
    expect(p.mesasTotales).toBe(4);
  });

  it('el consumo abierto es la suma de lo que no se cobro', () => {
    expect(panoramaDelSalon(SALON, datos, AHORA).consumoAbierto).toBe(67200);
  });

  it('la mesa mas demorada es la que lleva mas tiempo abierta', () => {
    const p = panoramaDelSalon(SALON, datos, AHORA);
    expect(p.demorada.recurso.id).toBe('m1');
    expect(p.demorada.abiertaHace).toBe(112);
    expect(p.demorada.sinPedirHace).toBe(41);
  });

  it('las mesas archivadas no cuentan para nada', () => {
    const p = panoramaDelSalon([...SALON, mesa('m9', 10, { active: false })], datos, AHORA);
    expect(p.lugares).toBe(16);
    expect(p.mesasTotales).toBe(4);
  });

  // El primer dia el negocio no tiene mesas y la pantalla se dibuja igual.
  it('sin mesas no divide por cero', () => {
    const p = panoramaDelSalon([], {}, AHORA);
    expect(p.capacidadPct).toBe(0);
    expect(p.demorada).toBeNull();
    expect(p.consumoAbierto).toBe(0);
  });
});

describe('formato de tiempo', () => {
  it('sin fecha no inventa un cero', () => {
    expect(minutosDesde(null, AHORA)).toBeNull();
    expect(duracionCorta(null)).toBe('—');
  });

  it('escribe minutos sueltos y horas con minutos', () => {
    expect(duracionCorta(41)).toBe('41 m');
    expect(duracionCorta(112)).toBe('1 h 52 m');
    expect(duracionCorta(60)).toBe('1 h 00 m');
  });
});
