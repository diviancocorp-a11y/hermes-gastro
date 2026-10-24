// @vitest-environment node
// Reglas puras de la reserva online (platform/functions/booking/reglas.ts):
// lo que el servidor decide solo y el navegador no puede pisar.
import { describe, it, expect } from 'vitest';
import {
  validarPedido, montoDeSena, elegirHueco, puedeCancelarSola, vencimientoDeRetencion,
  rangoDeConsulta, limpiarTelefono, limpiarEmail, diaValido, refDeSena, turnoDeRef,
} from '../../platform/functions/booking/reglas.ts';

const U1 = '3ee37a6b-b090-4236-9437-f6dcff3fe706';
const U2 = '9cd9e312-a0b6-4fc6-ad86-1b68cc5fc2f7';

const pedido = (over = {}) => ({
  tenant_slug: 'Mia-Estudio', service_id: U1, staff_id: 'any',
  starts_at: '2026-10-26T17:00:00.000Z', location_kind: 'local',
  customer_name: ' Lucía ', customer_phone: '+54 9 11 5555-1234',
  ...over,
});

describe('validarPedido', () => {
  it('limpia y normaliza lo que viene del navegador', () => {
    const r = validarPedido(pedido());
    expect(r.ok).toBe(true);
    expect(r.pedido.tenant_slug).toBe('mia-estudio');
    expect(r.pedido.customer_name).toBe('Lucía');
    expect(r.pedido.customer_phone).toBe('5491155551234');
    expect(r.pedido.staff_id).toBeNull();           // "any" = cualquiera
    expect(r.pedido.zone_id).toBeNull();
    expect(r.pedido.starts_at).toBe('2026-10-26T17:00:00.000Z');
  });
  it('a domicilio exige direccion; en el local la ignora junto con la zona', () => {
    expect(validarPedido(pedido({ location_kind: 'home' })).ok).toBe(false);
    const casa = validarPedido(pedido({ location_kind: 'home', address: ' Mitre 123 ', zone_id: U2 }));
    expect(casa.ok).toBe(true);
    expect(casa.pedido.address).toBe('Mitre 123');
    expect(casa.pedido.zone_id).toBe(U2);
    const local = validarPedido(pedido({ address: 'Mitre 123', zone_id: U2 }));
    expect(local.pedido.address).toBeNull();
    expect(local.pedido.zone_id).toBeNull();
  });
  it.each([
    [{ service_id: 'x' }, /servicio/],
    [{ staff_id: 'no-es-uuid' }, /Profesional/],
    [{ starts_at: 'ayer' }, /horario/],
    [{ customer_name: '   ' }, /nombre/],
    [{ customer_phone: '123' }, /telefono/],
    [{ customer_email: 'sin-arroba' }, /correo/],
    [{ zone_id: 'zzz', location_kind: 'home', address: 'x' }, /Zona/],
  ])('rechaza %j', (cambio, motivo) => {
    const r = validarPedido(pedido(cambio));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(motivo);
  });
  it('la clave de idempotencia solo vale si es uuid', () => {
    expect(validarPedido(pedido({ client_request_id: U1 })).pedido.client_request_id).toBe(U1);
    expect(validarPedido(pedido({ client_request_id: "x'; drop" })).pedido.client_request_id).toBeNull();
  });
  it('recorta notas y direccion largas', () => {
    const r = validarPedido(pedido({ notes: 'a'.repeat(900), location_kind: 'home', address: 'b'.repeat(900) }));
    expect(r.pedido.notes).toHaveLength(500);
    expect(r.pedido.address).toHaveLength(300);
  });
});

describe('montoDeSena', () => {
  it('sin regla, no hay sena', () => {
    expect(montoDeSena(null, 12000)).toBe(0);
    expect(montoDeSena({ deposit_mode: 'none', deposit_value: 6000 }, 12000)).toBe(0);
  });
  it('monto fijo y porcentaje, enteros', () => {
    expect(montoDeSena({ deposit_mode: 'fixed', deposit_value: '6000.00' }, 12000)).toBe(6000);
    expect(montoDeSena({ deposit_mode: 'percent', deposit_value: 33 }, 10000)).toBe(3300);
    expect(montoDeSena({ deposit_mode: 'percent', deposit_value: 33.3 }, 10001)).toBe(3330);
  });
  it('nunca pide mas que el servicio', () => {
    expect(montoDeSena({ deposit_mode: 'fixed', deposit_value: 6000 }, 1000)).toBe(1000);
  });
  it('valores rotos no inventan un monto', () => {
    expect(montoDeSena({ deposit_mode: 'fixed', deposit_value: null }, 12000)).toBe(0);
    expect(montoDeSena({ deposit_mode: 'fixed', deposit_value: -5 }, 12000)).toBe(0);
    expect(montoDeSena({ deposit_mode: 'fixed', deposit_value: 500 }, 0)).toBe(0);
  });
});

describe('elegirHueco', () => {
  const h = (staff_id, iso) => ({ staff_id, starts_at: iso, ends_at: iso });
  const huecos = [
    h('a', '2026-10-26T17:00:00+00:00'), h('b', '2026-10-26T17:00:00+00:00'), h('a', '2026-10-26T18:00:00+00:00'),
  ];
  it('compara instantes: +00:00 y Z son lo mismo', () => {
    expect(elegirHueco(huecos, '2026-10-26T17:00:00.000Z', 'a').staff_id).toBe('a');
  });
  it('con profesional pedida, tiene que ser ella', () => {
    expect(elegirHueco(huecos, '2026-10-26T18:00:00.000Z', 'b')).toBeNull();
  });
  it('un horario que la base no ofrecio no se reserva', () => {
    expect(elegirHueco(huecos, '2026-10-26T19:00:00.000Z', null)).toBeNull();
  });
  it('sin pedir profesional reparte por carga y desempata estable', () => {
    expect(elegirHueco(huecos, '2026-10-26T17:00:00.000Z', null, { a: 3, b: 1 }).staff_id).toBe('b');
    expect(elegirHueco(huecos, '2026-10-26T17:00:00.000Z', null).staff_id).toBe('a');
  });
});

describe('cancelar sola', () => {
  const ahora = Date.parse('2026-10-25T12:00:00Z');
  it('hasta el plazo si, pasado el plazo no', () => {
    expect(puedeCancelarSola('2026-10-26T13:00:00Z', ahora, 24)).toBe(true);   // 25 h antes
    expect(puedeCancelarSola('2026-10-26T11:59:00Z', ahora, 24)).toBe(false);  // 23 h 59
    expect(puedeCancelarSola('2026-10-26T12:00:00Z', ahora, 24)).toBe(true);   // justo 24 h
  });
  it('un turno pasado o una fecha rota no se cancela sola', () => {
    expect(puedeCancelarSola('2026-10-24T12:00:00Z', ahora, 0)).toBe(false);
    expect(puedeCancelarSola('nunca', ahora, 24)).toBe(false);
  });
});

describe('retencion de la sena', () => {
  const ahora = Date.parse('2026-10-25T12:00:00Z');
  it('suma los minutos con piso de 5 y techo de 120', () => {
    expect(vencimientoDeRetencion(ahora, 30)).toBe('2026-10-25T12:30:00.000Z');
    expect(vencimientoDeRetencion(ahora, 1)).toBe('2026-10-25T12:05:00.000Z');
    expect(vencimientoDeRetencion(ahora, 9999)).toBe('2026-10-25T14:00:00.000Z');
    expect(vencimientoDeRetencion(ahora, 'x')).toBe('2026-10-25T12:30:00.000Z');
  });
});

describe('consulta de huecos', () => {
  it('fechas reales y rango acotado', () => {
    expect(diaValido('2026-02-31')).toBe(false);
    expect(diaValido('2026-10-26')).toBe(true);
    expect(rangoDeConsulta('2026-10-26', '2026-10-30')).toEqual({ desde: '2026-10-26', hasta: '2026-10-30' });
    expect(rangoDeConsulta('2026-10-26', '2026-12-30').error).toMatch(/hasta 14/);
    expect(rangoDeConsulta('2026-10-30', '2026-10-26').error).toBeDefined();
    expect(rangoDeConsulta('hoy', '2026-10-26').error).toBeDefined();
  });
});

describe('contacto', () => {
  it('telefono y correo', () => {
    expect(limpiarTelefono('(011) 5555-1234')).toBe('01155551234');
    expect(limpiarTelefono('12345')).toBeNull();
    expect(limpiarEmail(' Lu@Mail.com ')).toBe('lu@mail.com');
    expect(limpiarEmail('')).toBeNull();
    expect(limpiarEmail('a@b')).toBeNull();
  });
});

describe('referencia de la sena en MercadoPago', () => {
  it('ida y vuelta, y un pedido comun no se confunde con un turno', () => {
    expect(turnoDeRef(refDeSena(U1))).toBe(U1);
    expect(turnoDeRef(U1)).toBeNull();            // external_reference de un pedido
    expect(turnoDeRef('turno:no-es-uuid')).toBeNull();
    expect(turnoDeRef(undefined)).toBeNull();
  });
});
