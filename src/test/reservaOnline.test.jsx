// La reserva online publica (PLAN-AGENDA, fase 3), vista desde la clienta.
//
// Se prueba lo que ella necesita que sea cierto: que lo que elige llegue al
// servidor tal cual (local y domicilio), que la seña se avise y la mande a
// MercadoPago, que un horario ocupado no la deje a ciegas, que un negocio sin
// seña habilitada no la deje reservar, que cancelar solo aparezca cuando el
// servidor lo permite, y que los negocios sin el canal no vean nada nuevo.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/publicBooking', () => ({
  fetchBookingInfo: vi.fn(),
  fetchPublicSlots: vi.fn(),
  createBooking: vi.fn(),
  fetchBooking: vi.fn(),
  cancelBooking: vi.fn(),
}));
vi.mock('../services/catalog', () => ({ fetchCatalog: vi.fn().mockResolvedValue(null) }));

import * as api from '../services/publicBooking';
import { hoyEnZona } from '../catalog-pro/reservarHelpers';
import { sumarDias } from '../modules/agenda';
import Reservar from '../catalog-pro/Reservar';
import ReservarTurno from '../catalog-pro/ReservarTurno';
import ReservarEntrada from '../catalog-pro/ReservarEntrada';
import CatalogFooter from '../catalog-pro/CatalogFooter';

// No hay user-event en el repo: lo minimo que hace falta, sobre fireEvent.
const userEvent = {
  setup: () => ({
    click: async (el) => { await act(async () => { fireEvent.click(el); }); },
    type: async (el, texto) => { await act(async () => { fireEvent.change(el, { target: { value: texto } }); }); },
    selectOptions: async (el, valor) => { await act(async () => { fireEvent.change(el, { target: { value: valor } }); }); },
  }),
};

const TZ = 'America/Argentina/Buenos_Aires';
const HOY = hoyEnZona(TZ);
const MANANA = sumarDias(HOY, 1);
const PASADO = sumarDias(HOY, 2);
// 13:00 UTC = 10:00 en Buenos Aires
const slotDe = (dia, staff = 'st1', hora = '13:00') => ({
  staff_id: staff, starts_at: `${dia}T${hora}:00.000Z`, ends_at: `${dia}T${hora.replace(/^\d\d/, h => String(+h + 1).padStart(2, '0'))}:00.000Z`,
});

const INFO = (over = {}) => ({
  ok: true,
  negocio: { name: 'MiaEstudio', whatsapp: '11 5555-1234', address: 'Av. Siempreviva 123', instagram: null, timezone: TZ },
  servicios: [
    { id: 's1', name: 'Soft gel', price: 18000, duration_min: 150, category: 'Uñas', deposit_amount: 6000 },
    { id: 's2', name: 'Esmaltado', price: 8000, duration_min: 60, category: 'Uñas', deposit_amount: 0 },
  ],
  adicionales: [{ id: 'a1', name: 'Flores 3D', price: 700 }],
  staff: [{ id: 'st1', name: 'Mía', color: '#df0359' }, { id: 'st2', name: 'Lu', color: '#7a5af8' }],
  relaciones: [],
  zonas: [{ id: 'z1', name: 'Pilar', travel_min: 30 }, { id: 'z2', name: 'Escobar', travel_min: 45 }],
  reglas: { offers_local: true, offers_home: true, min_notice_min: 60, max_advance_days: 30, cancel_window_hours: 24, travel_min: 0 },
  sena: { activa: true, disponible: true, retencion_min: 30 },
  ...over,
});

const TURNO = (over = {}) => ({
  token: 'tok-1', status: 'booked', starts_at: `${MANANA}T13:00:00.000Z`, ends_at: `${MANANA}T15:30:00.000Z`,
  servicio: 'Soft gel', profesional: 'Mía', location_kind: 'local', address: null, zona: null,
  sena: null, puede_cancelar: true, cancel_window_hours: 24, ...over,
});

function renderReservar() {
  return render(
    <MemoryRouter initialEntries={['/reservar']}>
      <Routes>
        <Route path="/reservar" element={<Reservar />} />
        <Route path="/reservar/turno/:token" element={<p>PAGINA DEL TURNO</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderTurno(url = '/reservar/turno/tok-1') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/reservar/turno/:token" element={<ReservarTurno />} /></Routes>
    </MemoryRouter>,
  );
}

async function elegirHastaElHorario(user, { servicio = /Soft gel/, donde = 'En el local' } = {}) {
  await user.click(await screen.findByRole('radio', { name: servicio }));
  if (donde) await user.click(await screen.findByRole('radio', { name: new RegExp(donde) }));
}

async function llenarDatos(user, { nombre = 'Ana Pérez', telefono = '11 5555 9999' } = {}) {
  await user.type(await screen.findByLabelText(/^Nombre/), nombre);
  await user.type(screen.getByLabelText(/^Teléfono/), telefono);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchBookingInfo.mockResolvedValue(INFO());
  api.fetchPublicSlots.mockResolvedValue({ ok: true, slots: [slotDe(MANANA), slotDe(MANANA, 'st2', '14:00'), slotDe(PASADO)] });
});

afterEach(() => { vi.useRealTimers(); });

describe('Reservar: el flujo hasta createBooking', () => {
  it('reserva en el local con los datos que eligió y avisa la seña', async () => {
    const user = userEvent.setup();
    api.createBooking.mockResolvedValue({ ok: true, turno: TURNO() });
    renderReservar();

    // El servicio avisa la seña y los adicionales se mencionan sin poder elegirse
    expect(await screen.findByText(/Seña \$6\.000 para confirmar/)).toBeTruthy();
    expect(screen.getByText(/Flores 3D \$700/)).toBeTruthy();
    expect(screen.getByText(/2 h 30/)).toBeTruthy();

    await elegirHastaElHorario(user);
    await user.click(await screen.findByRole('radio', { name: '10:00 horas' }));
    await llenarDatos(user);

    const boton = screen.getByRole('button', { name: /Reservar y pagar seña \$6\.000/ });
    await user.click(boton);

    await waitFor(() => expect(api.createBooking).toHaveBeenCalledTimes(1));
    expect(api.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      serviceId: 's1', staffId: 'st1', startsAt: `${MANANA}T13:00:00.000Z`,
      locationKind: 'local', zoneId: null, address: null,
      nombre: 'Ana Pérez', telefono: '11 5555 9999',
    }));
    // Sin seña en la respuesta: va directo a la pagina del turno
    expect(await screen.findByText('PAGINA DEL TURNO')).toBeTruthy();
  });

  it('a domicilio pide la zona a los horarios y exige la dirección', async () => {
    const user = userEvent.setup();
    api.createBooking.mockResolvedValue({ ok: true, turno: TURNO({ location_kind: 'home', address: 'Calle 1 234', zona: 'Pilar' }) });
    renderReservar();

    await elegirHastaElHorario(user, { donde: 'A domicilio' });
    // Hasta no elegir zona no se piden horarios
    expect(api.fetchPublicSlots).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Zona'), 'z1');
    await waitFor(() => expect(api.fetchPublicSlots).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 's1', locationKind: 'home', zoneId: 'z1' }),
    ));

    await user.click(await screen.findByRole('radio', { name: '10:00 horas' }));
    await llenarDatos(user);
    await user.click(screen.getByRole('button', { name: /Reservar/ }));

    // Sin dirección no se envía y el error queda junto al campo
    expect(await screen.findByText(/dirección completa/)).toBeTruthy();
    expect(api.createBooking).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/^Dirección/), 'Calle 1 234');
    await user.click(screen.getByRole('button', { name: /Reservar/ }));
    await waitFor(() => expect(api.createBooking).toHaveBeenCalledTimes(1));
    expect(api.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      locationKind: 'home', zoneId: 'z1', address: 'Calle 1 234',
    }));
  });

  it('un doble toque no crea dos reservas', async () => {
    const user = userEvent.setup();
    let resolver;
    api.createBooking.mockReturnValue(new Promise(r => { resolver = r; }));
    renderReservar();
    await elegirHastaElHorario(user);
    await user.click(await screen.findByRole('radio', { name: '10:00 horas' }));
    await llenarDatos(user);

    const form = screen.getByRole('button', { name: /Reservar y pagar/ }).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(api.createBooking).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Reservando/ }).disabled).toBe(true);
    await act(async () => { resolver({ ok: true, turno: TURNO() }); });
  });

  it('con seña va a la página del turno (una sola pantalla de pago), sin redirigir solo', async () => {
    const user = userEvent.setup();
    const asignar = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign: asignar } });
    try {
      api.createBooking.mockResolvedValue({
        ok: true,
        turno: TURNO({ sena: { monto: 6000, estado: 'pending', vence: new Date(Date.now() + 28 * 60000).toISOString(), init_point: 'https://mp.test/pagar/123' } }),
      });
      renderReservar();
      await elegirHastaElHorario(user);
      await user.click(await screen.findByRole('radio', { name: '10:00 horas' }));
      await llenarDatos(user);
      await user.click(screen.getByRole('button', { name: /Reservar y pagar/ }));

      expect(await screen.findByText('PAGINA DEL TURNO')).toBeTruthy();
      await act(async () => { await new Promise(r => setTimeout(r, 4500)); });
      expect(asignar).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('si el horario se ocupó, avisa, recalcula y ofrece el próximo día con lugar', async () => {
    const user = userEvent.setup();
    api.createBooking.mockResolvedValue({ ok: false, code: 'slot_taken', error: 'Ese horario se acaba de ocupar.' });
    renderReservar();
    await elegirHastaElHorario(user);
    await user.click(await screen.findByRole('radio', { name: '10:00 horas' }));
    await llenarDatos(user);

    // Al recalcular, mañana ya no tiene lugar y pasado mañana sí
    api.fetchPublicSlots.mockResolvedValue({ ok: true, slots: [slotDe(PASADO)] });
    const llamadasAntes = api.fetchPublicSlots.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /Reservar y pagar/ }));

    expect(await screen.findByText(/se ocupó justo recién/)).toBeTruthy();
    // El foco va al aviso: al perder "Tus datos" la página se acorta
    await waitFor(() => expect(document.activeElement?.textContent || '').toMatch(/se ocupó justo recién/));
    expect(api.fetchPublicSlots.mock.calls.length).toBeGreaterThan(llamadasAntes);
    const proximo = await screen.findByRole('button', { name: /próximo día con lugar/ });
    await user.click(proximo);
    expect(await screen.findByRole('radio', { name: '10:00 horas' })).toBeTruthy();
    // El formulario de datos ya no está: tiene que volver a elegir horario
    expect(screen.queryByLabelText(/^Nombre/)).toBeNull();
  });

  it('los días sin lugar quedan deshabilitados y dicen "sin lugar"', async () => {
    const user = userEvent.setup();
    api.fetchPublicSlots.mockResolvedValue({ ok: true, slots: [slotDe(PASADO)] });
    renderReservar();
    await elegirHastaElHorario(user);
    // Se elige solo el primer día con lugar
    await waitFor(() => expect(screen.getByRole('radio', { name: '10:00 horas' })).toBeTruthy());
    const dias = screen.getAllByRole('radio').filter(r => r.name === 'rv-dia');
    expect(dias.some(d => d.disabled && /sin lugar/.test(d.getAttribute('aria-label')))).toBe(true);
    expect(dias.find(d => d.value === PASADO).checked).toBe(true);
  });

  it('un error de red al pedir horarios se puede reintentar', async () => {
    const user = userEvent.setup();
    api.fetchPublicSlots.mockResolvedValueOnce({ ok: false, error: 'Sin conexión. Probá de nuevo.', code: 'red' });
    renderReservar();
    await elegirHastaElHorario(user);
    expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
    api.fetchPublicSlots.mockResolvedValue({ ok: true, slots: [slotDe(MANANA)] });
    await user.click(screen.getByRole('button', { name: /Probar de nuevo/ }));
    expect(await screen.findByRole('radio', { name: '10:00 horas' })).toBeTruthy();
  });

  it('si el negocio exige seña y no la tiene disponible, no deja reservar y ofrece WhatsApp', async () => {
    api.fetchBookingInfo.mockResolvedValue(INFO({ sena: { activa: true, disponible: false, retencion_min: 30 } }));
    renderReservar();
    expect(await screen.findByText(/todavía no habilita reservas con seña/)).toBeTruthy();
    const wa = screen.getByRole('link', { name: /WhatsApp/ });
    expect(wa.getAttribute('href')).toContain('https://wa.me/5491155551234');
    expect(screen.queryByRole('radio', { name: /Soft gel/ })).toBeNull();
    expect(api.fetchPublicSlots).not.toHaveBeenCalled();
  });

  it('con una sola profesional y solo local no pregunta ni dónde ni con quién', async () => {
    const user = userEvent.setup();
    api.fetchBookingInfo.mockResolvedValue(INFO({
      staff: [{ id: 'st1', name: 'Mía', color: '#df0359' }],
      reglas: { offers_local: true, offers_home: false, min_notice_min: 60, max_advance_days: 30, cancel_window_hours: 24, travel_min: 0 },
    }));
    renderReservar();
    await user.click(await screen.findByRole('radio', { name: /Esmaltado/ }));
    expect(screen.queryByText('Dónde')).toBeNull();
    expect(screen.queryByText('Con quién')).toBeNull();
    expect(await screen.findByRole('radio', { name: '10:00 horas' })).toBeTruthy();
  });
});

describe('ReservarTurno: la página del turno', () => {
  it('permite cancelar con confirmación solo si el servidor dice puede_cancelar', async () => {
    const user = userEvent.setup();
    api.fetchBooking.mockResolvedValue({ ok: true, turno: TURNO({ status: 'confirmed' }) });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    api.cancelBooking.mockResolvedValue({ ok: true, status: 'cancelled', sena_pagada: false });
    renderTurno();

    expect(await screen.findByText('Confirmado')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancelar turno' }));
    expect(api.cancelBooking).not.toHaveBeenCalled(); // pide confirmación en la misma página
    api.fetchBooking.mockResolvedValue({ ok: true, turno: TURNO({ status: 'cancelled', puede_cancelar: false }) });
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    await waitFor(() => expect(api.cancelBooking).toHaveBeenCalledWith('tok-1'));
    expect(await screen.findByText('Turno cancelado')).toBeTruthy();
  });

  it('fuera de plazo no ofrece cancelar: explica el plazo y ofrece WhatsApp', async () => {
    api.fetchBooking.mockResolvedValue({ ok: true, turno: TURNO({ status: 'confirmed', puede_cancelar: false, cancel_window_hours: 24 }) });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno();
    expect(await screen.findByText(/hasta 24 h antes del turno/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancelar turno' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('link', { name: /WhatsApp/ })).toBeTruthy());
  });

  it('seña pendiente: cuenta regresiva y botón para pagar', async () => {
    api.fetchBooking.mockResolvedValue({
      ok: true,
      turno: TURNO({ sena: { monto: 6000, estado: 'pending', vence: new Date(Date.now() + 10 * 60000).toISOString(), init_point: 'https://mp.test/p/9' } }),
    });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno();
    expect(await screen.findByText('Seña pendiente')).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toMatch(/^(9|10):\d\d$/);
    expect(screen.getByRole('link', { name: /Pagar seña \$6\.000/ }).getAttribute('href')).toBe('https://mp.test/p/9');
  });

  it('seña vencida: dice que se liberó el horario y no deja pagar', async () => {
    api.fetchBooking.mockResolvedValue({
      ok: true,
      turno: TURNO({ sena: { monto: 6000, estado: 'pending', vence: new Date(Date.now() - 60000).toISOString(), init_point: null } }),
    });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno();
    expect((await screen.findAllByText(/Se liberó el horario/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Pagar seña/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar turno' })).toBeNull();
  });

  it('retorno ?pago=ok: reintenta hasta que pasa a pagado y se detiene', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const pendiente = TURNO({ sena: { monto: 6000, estado: 'pending', vence: new Date(Date.now() + 20 * 60000).toISOString(), init_point: 'https://mp.test/p/9' } });
    const pagado = TURNO({ status: 'confirmed', sena: { monto: 6000, estado: 'paid', vence: null, init_point: null } });
    api.fetchBooking.mockResolvedValueOnce({ ok: true, turno: pendiente }).mockResolvedValue({ ok: true, turno: pagado });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno('/reservar/turno/tok-1?pago=ok');

    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByText(/Estamos confirmando tu pago/)).toBeTruthy();
    // Ya pagó: ni cuenta regresiva, ni botón de pagar, ni "se liberó"
    expect(screen.getByRole('heading', { name: 'Confirmando tu pago' })).toBeTruthy();
    expect(screen.queryByText(/Falta pagar la seña/)).toBeNull();
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.queryByRole('link', { name: /Pagar seña/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Reservar otro turno/ })).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(screen.getByText('Confirmado')).toBeTruthy();
    expect(screen.queryByText(/Estamos confirmando tu pago/)).toBeNull();
    const llamadas = api.fetchBooking.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(api.fetchBooking.mock.calls.length).toBe(llamadas); // no sigue consultando
  });

  it('retorno ?pago=ok que no se acredita: reintenta un número acotado de veces', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    api.fetchBooking.mockResolvedValue({
      ok: true,
      turno: TURNO({ sena: { monto: 6000, estado: 'pending', vence: new Date(Date.now() + 90 * 60000).toISOString(), init_point: 'https://mp.test/p/9' } }),
    });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno('/reservar/turno/tok-1?pago=ok');
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    for (let i = 0; i < 12; i += 1) await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(screen.getByText(/Todavía no vemos el pago/)).toBeTruthy();
    expect(api.fetchBooking.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it('retorno ?pago=ok con la seña vencida según el servidor tampoco dice que se liberó el horario', async () => {
    api.fetchBooking.mockResolvedValue({
      ok: true,
      turno: TURNO({ sena: { monto: 6000, estado: 'pending', vence: new Date(Date.now() - 60000).toISOString(), init_point: null } }),
    });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno('/reservar/turno/tok-1?pago=ok');
    expect(await screen.findByRole('heading', { name: 'Confirmando tu pago' })).toBeTruthy();
    expect(screen.queryByText(/Se liberó el horario/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Reservar otro turno/ })).toBeNull();
  });

  it('el reloj adelantado del celular no oculta el botón de pagar: manda server_now', async () => {
    const servidor = Date.now() - 3 * 3600 * 1000; // el celular va 3 h adelantado
    api.fetchBooking.mockResolvedValue({
      ok: true,
      turno: TURNO({
        server_now: new Date(servidor).toISOString(),
        sena: { monto: 6000, estado: 'pending', vence: new Date(servidor + 10 * 60000).toISOString(), init_point: 'https://mp.test/p/9' },
      }),
    });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno();
    expect(await screen.findByRole('link', { name: /Pagar seña \$6\.000/ })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toMatch(/^(9|10):\d\d$/);
    expect(screen.queryByText(/Se liberó el horario/)).toBeNull();
  });

  it('al llegar la cuenta a cero consulta UNA vez al servidor y muestra lo que diga (pudo pagarse)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const ahora = Date.now();
    api.fetchBooking
      .mockResolvedValueOnce({
        ok: true,
        turno: TURNO({ server_now: new Date(ahora).toISOString(), sena: { monto: 6000, estado: 'pending', vence: new Date(ahora + 3000).toISOString(), init_point: 'https://mp.test/p/9' } }),
      })
      .mockResolvedValue({
        ok: true,
        turno: TURNO({ status: 'confirmed', server_now: new Date(ahora + 4000).toISOString(), sena: { monto: 6000, estado: 'paid', vence: null, init_point: null } }),
      });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByRole('timer')).toBeTruthy();
    for (let i = 0; i < 6; i += 1) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText('Confirmado')).toBeTruthy();
    expect(screen.queryByText(/Se liberó el horario/)).toBeNull();
    expect(api.fetchBooking).toHaveBeenCalledTimes(2); // la carga inicial + una sola consulta al llegar a cero
  });

  it('si el refresco falla durante el polling, conserva el turno y no muestra error', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    api.fetchBooking
      .mockResolvedValueOnce({
        ok: true,
        turno: TURNO({ sena: { monto: 6000, estado: 'pending', vence: new Date(Date.now() + 20 * 60000).toISOString(), init_point: 'https://mp.test/p/9' } }),
      })
      .mockResolvedValue({ ok: false, error: 'Sin conexión. Probá de nuevo.', code: 'red' });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno('/reservar/turno/tok-1?pago=ok');
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(api.fetchBooking.mock.calls.length).toBeGreaterThan(1);
    expect(screen.getByRole('heading', { name: 'Confirmando tu pago' })).toBeTruthy();
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
  });

  it('el diálogo de cancelar tiene nombre, enfoca "No, mantenerlo" y devuelve el foco; avisa si la seña está pagada', async () => {
    const user = userEvent.setup();
    api.fetchBooking.mockResolvedValue({
      ok: true,
      turno: TURNO({ status: 'confirmed', sena: { monto: 6000, estado: 'paid', vence: null, init_point: null } }),
    });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno();
    await user.click(await screen.findByRole('button', { name: 'Cancelar turno' }));
    const dialogo = screen.getByRole('alertdialog', { name: /Seguro que querés cancelar este turno/ });
    expect(dialogo.textContent).toMatch(/Ya pagaste la seña: la devolución la coordinás con el negocio/);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'No, mantenerlo' }));
    await user.click(screen.getByRole('button', { name: 'No, mantenerlo' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar turno' }));
  });

  it('si el refresco falla tras cancelar, la pantalla igual dice que está cancelado', async () => {
    const user = userEvent.setup();
    api.fetchBooking.mockResolvedValue({ ok: true, turno: TURNO({ status: 'confirmed' }) });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    api.cancelBooking.mockResolvedValue({ ok: true, status: 'cancelled', sena_pagada: false });
    renderTurno();
    await user.click(await screen.findByRole('button', { name: 'Cancelar turno' }));
    api.fetchBooking.mockResolvedValue({ ok: false, error: 'Sin conexión.', code: 'red' });
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Turno cancelado' })).toBeTruthy();
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
  });

  it('turno inexistente: estado "no encontrado"', async () => {
    api.fetchBooking.mockResolvedValue({ ok: false, error: 'No encontramos ese turno', code: 'no_encontrado' });
    api.fetchBookingInfo.mockResolvedValue(INFO());
    renderTurno('/reservar/turno/zzz');
    expect(await screen.findByText('No encontrado')).toBeTruthy();
  });
});

describe('El acceso desde el catálogo', () => {
  it('aparece solo cuando el negocio tiene online_booking', () => {
    const { rerender, container } = render(<MemoryRouter><ReservarEntrada settings={{ online_booking: true }} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /Reservar turno/ });
    expect(link.getAttribute('href')).toBe('/reservar');
    rerender(<MemoryRouter><ReservarEntrada settings={{ online_booking: false }} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
    rerender(<MemoryRouter><ReservarEntrada settings={{}} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });

  it('el pie suma el enlace corto solo con online_booking', () => {
    const { unmount } = render(<CatalogFooter settings={{ biz_name: 'Mía', online_booking: true }} />);
    expect(screen.getByRole('link', { name: 'Reservar turno' }).getAttribute('href')).toBe('/reservar');
    unmount();
    render(<CatalogFooter settings={{ biz_name: 'Mía', online_booking: false }} />);
    expect(screen.queryByRole('link', { name: 'Reservar turno' })).toBeNull();
  });
});
