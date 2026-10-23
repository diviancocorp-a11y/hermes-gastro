// La pantalla de agenda (PLAN-AGENDA, fase 2).
//
// Se prueba lo que la duenia necesita que sea cierto: que una agenda recien
// creada explique por que no ofrece horarios, que una profesional no vea lo
// ajeno, que el boton principal sea el paso que sigue y que reservar mande a la
// base los datos correctos (incluido el domicilio con su traslado).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { diaLocal } from '../modules/agenda';

vi.mock('../services/platformAgenda', () => ({
  fetchAgendaBase: vi.fn(),
  fetchSlots: vi.fn(),
  saveStaffMember: vi.fn(),
  saveWeeklySchedule: vi.fn(),
  addTimeOff: vi.fn(),
  removeTimeOff: vi.fn(),
  saveServiceTiming: vi.fn(),
  saveStaffServices: vi.fn(),
  saveBookingSettings: vi.fn(),
  REGLAS_POR_DEFECTO: {},
}));
vi.mock('../services/platformScheduling', () => ({
  fetchAppointmentsOrError: vi.fn(),
  createAppointment: vi.fn(),
  setAppointmentStatus: vi.fn(),
  rescheduleAppointment: vi.fn(),
}));

import AgendaPanel from '../components/admin/platform/AgendaPanel';
import * as agenda from '../services/platformAgenda';
import * as sched from '../services/platformScheduling';

const HOY = diaLocal();
const iso = (h, m = 0) => {
  const [y, mo, d] = HOY.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
};

const REGLAS = {
  min_notice_min: 120, max_advance_days: 60, slot_step_min: 15, cancel_window_hours: 24,
  offers_local: true, offers_home: false, travel_min: 0,
  deposit_mode: 'none', deposit_value: null, deposit_hold_min: 30,
};

const baseCompleta = (over = {}) => ({
  staff: [
    { id: 'ana', name: 'Ana', color: '#df0359', user_id: 'u-ana' },
    { id: 'bea', name: 'Bea', color: '#7a5af8', user_id: 'u-bea' },
  ],
  servicios: [{ id: 'sv1', name: 'Uñas semipermanentes', duration_min: 60, buffer_after_min: 0, active: true }],
  horarios: [
    { staff_id: 'ana', weekday: 1, start_time: '09:00:00', end_time: '18:00:00' },
    { staff_id: 'bea', weekday: 1, start_time: '09:00:00', end_time: '18:00:00' },
  ],
  ausencias: [],
  relaciones: [],
  reglas: { ...REGLAS },
  reglasGuardadas: true,
  ...over,
});

const turno = (over = {}) => ({
  id: 't1', staff_id: 'ana', service_id: 'sv1', customer_name: 'Lucía Pérez', customer_phone: '11 5555-1234',
  starts_at: iso(10), ends_at: iso(11), status: 'booked', location_kind: 'local', address: null, travel_min: 0, notes: null,
  ...over,
});

const hay = (lista) => sched.fetchAppointmentsOrError.mockResolvedValue({ ok: true, turnos: lista });

const montar = (props = {}) => render(
  <AgendaPanel tenantId="t" negocio="MiaEstudio" branch={{ id: 'b1' }} roles={['owner']}
    currentUserId="u-owner" onToast={vi.fn()} {...props} />,
);

beforeEach(() => {
  vi.clearAllMocks();
  agenda.fetchAgendaBase.mockResolvedValue(baseCompleta());
  hay([]);
  agenda.fetchSlots.mockResolvedValue({ ok: true, slots: [] });
});

describe('AgendaPanel', () => {
  it('una agenda sin duraciones ni horarios explica que falta, con camino a configurarlo', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(baseCompleta({
      servicios: [{ id: 'sv1', name: 'Uñas', duration_min: null, active: true }],
      horarios: [],
    }));
    montar();
    expect(await screen.findByText('Todavía no hay horarios para ofrecer')).toBeInTheDocument();
    expect(screen.getByText(/Ningún servicio tiene duración/)).toBeInTheDocument();
    expect(screen.getByText(/Sin horario de trabajo: Ana, Bea/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Completar en Horarios y reglas' }));
    expect(await screen.findByRole('heading', { name: 'Servicios' })).toBeInTheDocument();
    expect(screen.getByText('Falta la duración')).toBeInTheDocument();
  });

  it('el dia vacio lo dice y ofrece crear un turno', async () => {
    montar();
    expect(await screen.findByText('No hay turnos este día')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nuevo turno' }).length).toBeGreaterThan(0);
  });

  it('un acceso PROPIO no ve la configuracion ni los turnos ajenos', async () => {
    hay([
      turno({ id: 'mio', customer_name: 'Clienta de Ana', staff_id: 'ana' }),
      turno({ id: 'ajeno', customer_name: 'Clienta de Bea', staff_id: 'bea', starts_at: iso(12), ends_at: iso(13) }),
    ]);
    montar({ roles: ['attendant'], currentUserId: 'u-ana' });
    expect(await screen.findByText('Clienta de Ana')).toBeInTheDocument();
    expect(screen.queryByText('Clienta de Bea')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Horarios y reglas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filtrar por profesional' })).not.toBeInTheDocument();
  });

  it('el boton principal de un turno reservado es Confirmar y cambia el estado', async () => {
    hay([turno()]);
    sched.setAppointmentStatus.mockResolvedValue({ ok: true });
    montar();
    fireEvent.click(await screen.findByText('Lucía Pérez'));
    const dialogo = await screen.findByRole('dialog');
    const botones = within(dialogo).getAllByRole('button').map(b => b.textContent);
    // Cerrar (x) va primero en la cabecera; la primera accion del pie es la principal.
    expect(botones[1]).toBe('Confirmar');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(sched.setAppointmentStatus).toHaveBeenCalledWith('t', 't1', 'confirmed'));
  });

  it('cancelar pide confirmacion antes de tocar la base', async () => {
    hay([turno()]);
    sched.setAppointmentStatus.mockResolvedValue({ ok: true });
    montar();
    fireEvent.click(await screen.findByText('Lucía Pérez'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar turno' }));
    expect(sched.setAppointmentStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar turno' }));
    await waitFor(() => expect(sched.setAppointmentStatus).toHaveBeenCalledWith('t', 't1', 'cancelled'));
  });

  it('un telefono que no sirve deshabilita WhatsApp y dice por que', async () => {
    hay([turno({ customer_phone: '123' })]);
    montar();
    fireEvent.click(await screen.findByText('Lucía Pérez'));
    const wa = await screen.findByRole('button', { name: 'Recordar por WhatsApp' });
    expect(wa).toBeDisabled();
    expect(screen.getByText(/no alcanza para armar un número/)).toBeInTheDocument();
  });

  it('la hoja cierra con Escape', async () => {
    hay([turno()]);
    montar();
    fireEvent.click(await screen.findByText('Lucía Pérez'));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Errores y foco', () => {
  it('un error al cargar los turnos no se confunde con un dia vacio', async () => {
    sched.fetchAppointmentsOrError.mockResolvedValueOnce({ __error: 'db', message: 'No se pudieron cargar los turnos.' });
    montar();
    expect(await screen.findByText('No pudimos cargar los turnos')).toBeInTheDocument();
    expect(screen.queryByText('No hay turnos este día')).not.toBeInTheDocument();
    hay([turno()]);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Lucía Pérez')).toBeInTheDocument();
  });

  it('Escape sigue cerrando despues de tocar Mover o Cancelar turno', async () => {
    hay([turno()]);
    montar();
    fireEvent.click(await screen.findByText('Lucía Pérez'));
    let dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Mover' }));
    dialogo = await screen.findByRole('dialog', { name: 'Mover turno' });
    // El boton tocado desaparecio: el foco tiene que haber quedado dentro de la hoja.
    await waitFor(() => expect(dialogo).toHaveFocus());
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Volver' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar turno' }));
    dialogo = await screen.findByRole('dialog', { name: '¿Cancelar este turno?' });
    await waitFor(() => expect(dialogo).toHaveFocus());
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('un error de validacion se ve en el pie, marca el campo y lleva el foco', async () => {
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo turno' }))[0]);
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Reservar' }));
    const alerta = await within(dialogo).findByRole('alert');
    expect(alerta).toHaveTextContent('Elegí un servicio');
    expect(alerta.closest('footer')).not.toBeNull();
    const servicio = within(dialogo).getByLabelText('Servicio');
    expect(servicio).toHaveAttribute('aria-invalid', 'true');
    expect(servicio).toHaveFocus();
  });

  it('con datos escritos, ni Escape ni el fondo descartan en silencio', async () => {
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo turno' }))[0]);
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Marta' } });
    fireEvent.mouseDown(dialogo.parentElement);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(await within(dialogo).findByText(/se pierden/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Nuevo turno', () => {
  const slots = [{ staff_id: 'ana', starts_at: iso(15), ends_at: iso(16) }];

  it('reserva a domicilio con direccion y traslado', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(baseCompleta({
      reglas: { ...REGLAS, offers_home: true, travel_min: 30 },
    }));
    agenda.fetchSlots.mockResolvedValue({ ok: true, slots });
    sched.createAppointment.mockResolvedValue({ ok: true, appointment: { id: 'n1' } });
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo turno' }))[0]);
    const dialogo = await screen.findByRole('dialog');

    fireEvent.change(within(dialogo).getByLabelText('Servicio'), { target: { value: 'sv1' } });
    fireEvent.click(within(dialogo).getByLabelText('A domicilio'));
    fireEvent.click(await within(dialogo).findByRole('button', { name: '15:00' }));
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Marta' } });
    fireEvent.change(within(dialogo).getByLabelText('Teléfono'), { target: { value: '11 4444-5555' } });

    // Sin direccion no reserva.
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Reservar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('hace falta la dirección');
    expect(sched.createAppointment).not.toHaveBeenCalled();

    fireEvent.change(within(dialogo).getByLabelText('Dirección'), { target: { value: 'Mitre 123, Olivos' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Reservar' }));

    await waitFor(() => expect(sched.createAppointment).toHaveBeenCalledTimes(1));
    expect(sched.createAppointment).toHaveBeenCalledWith('t', expect.objectContaining({
      staffId: 'ana', serviceId: 'sv1', customerName: 'Marta', customerPhone: '11 4444-5555',
      startsAt: slots[0].starts_at, endsAt: slots[0].ends_at,
      locationKind: 'home', address: 'Mitre 123, Olivos', travelMin: 30, branchId: 'b1',
    }));
    // La consulta de huecos pidio la modalidad que se eligio.
    expect(agenda.fetchSlots).toHaveBeenCalledWith('t', 'sv1', HOY, HOY, expect.objectContaining({ locationKind: 'home' }));
  });

  it('solo ofrece servicios con duracion y avisa de los que faltan', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(baseCompleta({
      servicios: [
        { id: 'sv1', name: 'Uñas', duration_min: 60, active: true },
        { id: 'sv2', name: 'Cejas', duration_min: null, active: true },
      ],
    }));
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo turno' }))[0]);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).queryByRole('option', { name: /Cejas/ })).not.toBeInTheDocument();
    expect(within(dialogo).getByText(/no aparece porque no tienen duración|no aparece/)).toBeInTheDocument();
  });

  it('muestra el error de la base si el hueco ya no esta', async () => {
    agenda.fetchSlots.mockResolvedValue({ ok: true, slots });
    sched.createAppointment.mockResolvedValue({ __error: 'db', message: 'Esa profesional ya tiene un turno en ese horario.' });
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo turno' }))[0]);
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Servicio'), { target: { value: 'sv1' } });
    fireEvent.click(await within(dialogo).findByRole('button', { name: '15:00' }));
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Marta' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Reservar' }));
    expect(await within(dialogo).findByText('Esa profesional ya tiene un turno en ese horario.')).toBeInTheDocument();
    // Y recalcula los huecos: el cliente no se queda mirando uno que ya no existe.
    await waitFor(() => expect(agenda.fetchSlots.mock.calls.length).toBeGreaterThan(1));
  });

  it('si no hay horarios ese dia, ofrece el siguiente con lugar', async () => {
    const manana = new Date(); manana.setDate(manana.getDate() + 3); manana.setHours(10, 0, 0, 0);
    const fin = new Date(manana); fin.setHours(11);
    agenda.fetchSlots
      .mockResolvedValueOnce({ ok: true, slots: [] })
      .mockResolvedValue({ ok: true, slots: [{ staff_id: 'ana', starts_at: manana.toISOString(), ends_at: fin.toISOString() }] });
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo turno' }))[0]);
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Servicio'), { target: { value: 'sv1' } });
    expect(await within(dialogo).findByText('No hay horarios este día.')).toBeInTheDocument();
    expect(within(dialogo).getByText(/El próximo con lugar es el/)).toBeInTheDocument();
  });
});

describe('Horarios y reglas (seña)', () => {
  it('la seña fija pide pesos enteros y muestra la vista previa', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Horarios y reglas' }));
    fireEvent.change(await screen.findByLabelText('Tipo de seña'), { target: { value: 'fixed' } });
    const monto = await screen.findByLabelText('Monto');
    fireEvent.change(monto, { target: { value: '1500' } });
    expect(screen.getByText(/Se va a pedir .*1.500 de seña/)).toBeInTheDocument();
    fireEvent.change(monto, { target: { value: '1500.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar reglas' }));
    expect(await screen.findByText(/sin puntos ni comas./)).toBeInTheDocument();
    expect(monto).toHaveAttribute('aria-invalid', 'true');
    expect(agenda.saveBookingSettings).not.toHaveBeenCalled();
  });
});

describe('Horarios y reglas', () => {
  it('guarda la duracion de un servicio y muestra la confirmacion', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(baseCompleta({
      servicios: [{ id: 'sv1', name: 'Uñas', duration_min: null, buffer_after_min: 0, active: true }],
    }));
    agenda.saveServiceTiming.mockResolvedValue({ ok: true });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Horarios y reglas' }));
    fireEvent.change(await screen.findByLabelText('Duración (min)'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar servicios' }));
    await waitFor(() => expect(agenda.saveServiceTiming).toHaveBeenCalledWith('t', 'sv1',
      expect.objectContaining({ duration_min: '90' })));
    expect(await screen.findByText('Servicios guardados.')).toBeInTheDocument();
  });

  it('un error del servicio se muestra en lenguaje llano', async () => {
    agenda.saveBookingSettings.mockResolvedValue({ __error: 'db', message: 'Tiene que atender en el local, a domicilio o las dos.' });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Horarios y reglas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar reglas' }));
    expect(await screen.findByText('Tiene que atender en el local, a domicilio o las dos.')).toBeInTheDocument();
  });

  it('no deja guardar un horario con tramos pisados', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Horarios y reglas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Ana' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Agregar otro tramo' })[0]);
    // Lunes: 09-18 y el nuevo 16-20 se pisan.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horario' }));
    expect(await screen.findByText(/dos tramos se pisan/)).toBeInTheDocument();
    expect(agenda.saveWeeklySchedule).not.toHaveBeenCalled();
  });
});
