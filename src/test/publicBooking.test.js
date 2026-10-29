// El servicio de reserva online del front: arma el body correcto, devuelve el
// mensaje del servidor y reusa la clave de idempotencia en un reintento.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }));
vi.mock('../lib/activeTenant', () => ({ resolveTenantSlug: vi.fn(async () => 'mia-estudio') }));

const svc = await import('../services/publicBooking.js');

const datos = {
  serviceId: 'sv1', staffId: null, startsAt: '2026-10-26T17:00:00.000Z',
  locationKind: 'home', zoneId: 'z1', address: 'Mitre 123', nombre: 'Lucía', telefono: '11 5555-1234',
};

describe('publicBooking', () => {
  beforeEach(() => { invoke.mockReset(); });

  it('manda el tenant y la accion; el monto y el traslado no viajan', async () => {
    invoke.mockResolvedValue({ data: { ok: true, turno: { token: 't' } }, error: null });
    await svc.createBooking(datos);
    const [nombre, { body }] = invoke.mock.calls[0];
    expect(nombre).toBe('booking');
    expect(body).toMatchObject({
      action: 'create', tenant_slug: 'mia-estudio', service_id: 'sv1', location_kind: 'home',
      zone_id: 'z1', address: 'Mitre 123', customer_name: 'Lucía', customer_phone: '11 5555-1234',
    });
    expect(body).not.toHaveProperty('deposit_amount');
    expect(body).not.toHaveProperty('travel_min');
  });

  it('un reintento del mismo turno repite la clave; otro turno, no', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ error: 'caído' }) } } });
    await svc.createBooking(datos);
    await svc.createBooking(datos);
    const [a, b] = invoke.mock.calls.map(c => c[1].body.client_request_id);
    expect(a).toBe(b);
    await svc.createBooking({ ...datos, startsAt: '2026-10-27T17:00:00.000Z' });
    expect(invoke.mock.calls[2][1].body.client_request_id).not.toBe(a);
  });

  it('al reservar bien, la proxima reserva ya no repite la clave', async () => {
    invoke.mockResolvedValue({ data: { ok: true, turno: {} }, error: null });
    await svc.createBooking(datos);
    await svc.createBooking(datos);
    const [a, b] = invoke.mock.calls.map(c => c[1].body.client_request_id);
    expect(a).not.toBe(b);
  });

  it('devuelve el mensaje y el codigo del servidor en un error http', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ error: 'Ese horario se acaba de ocupar.', code: 'slot_taken' }) } },
    });
    const r = await svc.createBooking(datos);
    expect(r).toEqual({ ok: false, error: 'Ese horario se acaba de ocupar.', code: 'slot_taken' });
  });

  it('un cuerpo sin ok tambien es un error, y una caida de red no revienta', async () => {
    invoke.mockResolvedValueOnce({ data: { error: 'Elegí la zona.' }, error: null });
    expect(await svc.fetchBookingInfo()).toMatchObject({ ok: false, error: 'Elegí la zona.' });
    invoke.mockRejectedValueOnce(new Error('offline'));
    expect(await svc.fetchBooking('tok')).toMatchObject({ ok: false, code: 'red' });
  });

  it('slots y cancelar usan sus acciones', async () => {
    invoke.mockResolvedValue({ data: { ok: true, slots: [] }, error: null });
    await svc.fetchPublicSlots({ serviceId: 'sv1', desde: '2026-10-26', hasta: '2026-10-27', zoneId: 'z1', locationKind: 'home' });
    expect(invoke.mock.calls[0][1].body).toMatchObject({ action: 'slots', from: '2026-10-26', to: '2026-10-27', zone_id: 'z1', location_kind: 'home' });
    await svc.cancelBooking('tok');
    expect(invoke.mock.calls[1][1].body).toMatchObject({ action: 'cancel', token: 'tok' });
  });
});
