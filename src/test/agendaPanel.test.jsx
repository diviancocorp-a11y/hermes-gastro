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
  saveZone: vi.fn(),
  removeZone: vi.fn(),
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
  zonas: [],
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

  it('un servicio en borrador tambien se agenda desde el panel', async () => {
    // MiaEstudio carga sus servicios como borrador (active=false) hasta abrir la
    // tienda: la agenda tiene que andar igual.
    agenda.fetchAgendaBase.mockResolvedValue(baseCompleta({
      servicios: [{ id: 'sv1', name: 'Soft gel', duration_min: 150, active: false }],
    }));
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo turno' }))[0]);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('option', { name: /Soft gel/ })).toBeInTheDocument();
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

describe('Zonas de domicilio y adicionales', () => {
  const slots = [{ staff_id: 'ana', starts_at: iso(15), ends_at: iso(16) }];
  const ZONAS = [
    { id: 'z1', name: 'Del Viso', travel_min: 25, active: true },
    { id: 'z2', name: 'Pilar centro', travel_min: 10, active: true },
  ];
  const conDomicilio = (over = {}) => baseCompleta({
    reglas: { ...REGLAS, offers_home: true, travel_min: 20 }, ...over,
  });

  it('agrega una zona, la guarda con saveZone y se ve', async () => {
    agenda.saveZone.mockResolvedValue({ ok: true, zona: { id: 'z9' } });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Horarios y reglas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar zona' }));
    fireEvent.change(screen.getByLabelText('Zona nueva'), { target: { value: 'Del Viso' } });
    fireEvent.change(screen.getByLabelText('Viaje (min)'), { target: { value: '25' } });
    agenda.fetchAgendaBase.mockResolvedValue(baseCompleta({ zonas: [{ id: 'z9', name: 'Del Viso', travel_min: 25, active: true }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar zonas' }));
    await waitFor(() => expect(agenda.saveZone).toHaveBeenCalledWith('t', { name: 'Del Viso', travel_min: '25' }));
    expect(await screen.findByText('Zonas guardadas.')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Del Viso')).toBeInTheDocument();
  });

  it('quitar una zona pide confirmacion antes de tocar la base', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(conDomicilio({ zonas: ZONAS }));
    agenda.removeZone.mockResolvedValue(true);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Horarios y reglas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar zona Del Viso' }));
    expect(agenda.removeZone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar zona' }));
    await waitFor(() => expect(agenda.removeZone).toHaveBeenCalledWith('t', 'z1'));
  });

  it('un error al guardar una zona se dice en lenguaje llano', async () => {
    agenda.saveZone.mockResolvedValue({ __error: 'db', message: 'Ya hay una zona con ese nombre.' });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Horarios y reglas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar zona' }));
    fireEvent.change(screen.getByLabelText('Zona nueva'), { target: { value: 'Pilar' } });
    fireEvent.change(screen.getByLabelText('Viaje (min)'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar zonas' }));
    expect(await screen.findByText('Ya hay una zona con ese nombre.')).toBeInTheDocument();
  });

  it('marcar un servicio como adicional guarda is_addon y deja de ser pendiente', async () => {
    const servicios = (addon) => [
      { id: 'sv1', name: 'Uñas', duration_min: 60, buffer_after_min: 0, active: true },
      { id: 'sv2', name: 'Flores 3D', duration_min: null, buffer_after_min: 0, active: true, is_addon: addon },
    ];
    agenda.fetchAgendaBase.mockResolvedValue(baseCompleta({ servicios: servicios(false) }));
    agenda.saveServiceTiming.mockResolvedValue({ ok: true });
    montar();
    expect(await screen.findByText(/1 servicio\(s\) sin duración: Flores 3D/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Completar en Horarios y reglas' }));
    expect(await screen.findByText('Falta la duración')).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText(/Es un adicional/)[1]);
    // Marcado: la duracion pasa a opcional y ya no figura como falta.
    expect(screen.queryByText('Falta la duración')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Duración (min, opcional)')).toBeInTheDocument();
    agenda.fetchAgendaBase.mockResolvedValue(baseCompleta({ servicios: servicios(true) }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar servicios' }));
    await waitFor(() => expect(agenda.saveServiceTiming).toHaveBeenCalledWith('t', 'sv2',
      expect.objectContaining({ is_addon: true, duration_min: '' })));
    expect(await screen.findByText('Servicios guardados.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    await screen.findAllByRole('button', { name: 'Nuevo turno' });
    expect(screen.queryByText(/sin duración/)).not.toBeInTheDocument();
  });

  it('a domicilio exige zona y manda el viaje de la zona a los horarios y a la reserva', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(conDomicilio({ zonas: ZONAS }));
    agenda.fetchSlots.mockResolvedValue({ ok: true, slots });
    sched.createAppointment.mockResolvedValue({ ok: true, appointment: { id: 'n1' } });
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo turno' }))[0]);
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Servicio'), { target: { value: 'sv1' } });
    fireEvent.click(within(dialogo).getByLabelText('A domicilio'));
    expect(within(dialogo).getByRole('option', { name: 'Del Viso · 25 min' })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: '15:00' })).not.toBeInTheDocument();

    // Sin zona no reserva.
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Marta' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Reservar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Elegí la zona');
    expect(sched.createAppointment).not.toHaveBeenCalled();

    fireEvent.change(within(dialogo).getByLabelText('Zona'), { target: { value: 'z1' } });
    fireEvent.click(await within(dialogo).findByRole('button', { name: '15:00' }));
    expect(agenda.fetchSlots).toHaveBeenCalledWith('t', 'sv1', HOY, HOY,
      expect.objectContaining({ locationKind: 'home', travelMin: 25 }));
    expect(within(dialogo).getByText('Se reservan 25 min antes para el traslado.')).toBeInTheDocument();

    // Cambiar de zona recalcula y descarta el horario elegido.
    fireEvent.change(within(dialogo).getByLabelText('Zona'), { target: { value: 'z2' } });
    await waitFor(() => expect(agenda.fetchSlots).toHaveBeenCalledWith('t', 'sv1', HOY, HOY,
      expect.objectContaining({ travelMin: 10 })));
    const hora = await within(dialogo).findByRole('button', { name: '15:00' });
    expect(hora).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(hora);
    fireEvent.change(within(dialogo).getByLabelText('Dirección'), { target: { value: 'Mitre 123' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Reservar' }));
    await waitFor(() => expect(sched.createAppointment).toHaveBeenCalledTimes(1));
    expect(sched.createAppointment).toHaveBeenCalledWith('t', expect.objectContaining({
      locationKind: 'home', zoneId: 'z2', travelMin: 10, address: 'Mitre 123',
    }));
  });

  it('sin zonas cargadas avisa y usa el traslado fijo de las reglas', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(conDomicilio());
    agenda.fetchSlots.mockResolvedValue({ ok: true, slots });
    sched.createAppointment.mockResolvedValue({ ok: true, appointment: { id: 'n1' } });
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo turno' }))[0]);
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Servicio'), { target: { value: 'sv1' } });
    fireEvent.click(within(dialogo).getByLabelText('A domicilio'));
    expect(within(dialogo).getByText(/Todavía no hay zonas de domicilio cargadas/)).toBeInTheDocument();
    expect(within(dialogo).queryByLabelText('Zona')).not.toBeInTheDocument();
    fireEvent.click(await within(dialogo).findByRole('button', { name: '15:00' }));
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Marta' } });
    fireEvent.change(within(dialogo).getByLabelText('Dirección'), { target: { value: 'Mitre 123' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Reservar' }));
    await waitFor(() => expect(sched.createAppointment).toHaveBeenCalledTimes(1));
    expect(sched.createAppointment).toHaveBeenCalledWith('t', expect.objectContaining({
      travelMin: 20, zoneId: null, locationKind: 'home',
    }));
    expect(agenda.fetchSlots).toHaveBeenCalledWith('t', 'sv1', HOY, HOY,
      expect.objectContaining({ locationKind: 'home', travelMin: 20 }));
  });

  it('el selector de servicio no ofrece adicionales', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(baseCompleta({
      servicios: [
        { id: 'sv1', name: 'Uñas', duration_min: 60, active: true },
        { id: 'sv2', name: 'Flores 3D', duration_min: 15, active: true, is_addon: true },
      ],
    }));
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo turno' }))[0]);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('option', { name: /Uñas/ })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('option', { name: /Flores 3D/ })).not.toBeInTheDocument();
  });

  it('el detalle muestra la zona y Mover busca huecos con el viaje del turno', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(conDomicilio({ zonas: ZONAS }));
    hay([turno({ location_kind: 'home', address: 'Mitre 123', travel_min: 25, zone_id: 'z1' })]);
    montar();
    fireEvent.click(await screen.findByText('Lucía Pérez'));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Del Viso')).toBeInTheDocument();
    expect(within(dialogo).getByText('25 min antes')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Mover' }));
    await waitFor(() => expect(agenda.fetchSlots).toHaveBeenCalledWith('t', 'sv1', expect.any(String), expect.any(String),
      expect.objectContaining({ locationKind: 'home', travelMin: 25 })));
  });

  it('minutos vacios no se guardan como cero: se muestra el error y el foco va a los minutos', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(conDomicilio({ zonas: ZONAS }));
    agenda.saveZone.mockResolvedValue({ __error: 'minutos', message: 'Poné los minutos de viaje (cero o más).' });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Horarios y reglas' }));
    const minutos = (await screen.findAllByLabelText('Viaje (min)'))[0];
    fireEvent.change(minutos, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar zonas' }));
    expect(await screen.findByText(/Poné los minutos de viaje/)).toBeInTheDocument();
    expect(document.activeElement).toBe(minutos);
  });

  it('si falla la tercera fila, las dos primeras quedan reflejadas', async () => {
    agenda.saveZone
      .mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ __error: 'db', message: 'Ya hay una zona con ese nombre.' });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Horarios y reglas' }));
    for (const [n, m] of [['Alfa', '5'], ['Beta', '6'], ['Gama', '7']]) {
      fireEvent.click(await screen.findByRole('button', { name: 'Agregar zona' }));
      const nombres = screen.getAllByLabelText('Zona nueva');
      fireEvent.change(nombres[nombres.length - 1], { target: { value: n } });
      const mins = screen.getAllByLabelText('Viaje (min)');
      fireEvent.change(mins[mins.length - 1], { target: { value: m } });
    }
    const antes = agenda.fetchAgendaBase.mock.calls.length;
    agenda.fetchAgendaBase.mockResolvedValue(baseCompleta({ zonas: [
      { id: 'a', name: 'Alfa', travel_min: 5, active: true }, { id: 'b', name: 'Beta', travel_min: 6, active: true },
    ] }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar zonas' }));
    expect(await screen.findByText('Ya hay una zona con ese nombre.')).toBeInTheDocument();
    await waitFor(() => expect(agenda.fetchAgendaBase.mock.calls.length).toBeGreaterThan(antes));
    expect(await screen.findByDisplayValue('Alfa')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Beta')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Gama')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Zona nueva')).toHaveLength(1);
  });

  it('la confirmacion de quitar recibe el foco y lo devuelve al cerrar', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(conDomicilio({ zonas: ZONAS }));
    agenda.removeZone.mockResolvedValue(true);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Horarios y reglas' }));
    const quitar = await screen.findByRole('button', { name: 'Quitar zona Del Viso' });
    fireEvent.click(quitar);
    const confirma = screen.getByRole('alertdialog');
    expect(document.activeElement).toBe(confirma);
    expect(confirma).toHaveAttribute('aria-describedby');
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Quitar zona Del Viso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar zona Del Viso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar zona' }));
    await waitFor(() => expect(agenda.removeZone).toHaveBeenCalled());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Agregar zona' })));
  });

  it('el detalle muestra la zona aunque se haya dado de baja', async () => {
    agenda.fetchAgendaBase.mockResolvedValue(conDomicilio({
      zonas: [], zonasTodas: [{ id: 'z3', name: 'Escobar', travel_min: 40, active: false }],
    }));
    hay([turno({ location_kind: 'home', address: 'Mitre 123', travel_min: 40, zone_id: 'z3' })]);
    montar();
    fireEvent.click(await screen.findByText('Lucía Pérez'));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Escobar')).toBeInTheDocument();
  });
});
