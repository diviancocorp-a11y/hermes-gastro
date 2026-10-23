/**
 * TurnoDetalle — un turno, y lo que se puede hacer con el.
 *
 * El primer boton del pie es la accion que sigue en el flujo (Confirmar,
 * Llegó, Empezar, Terminar). Cancelar y "No vino" son salidas: piden
 * confirmacion porque liberan o queman el horario.
 *
 * "Mover" muestra los huecos de la base. En esta fase el propio turno cuenta
 * como ocupado: si se lo mueve a un rato que se pisa con su horario actual, el
 * hueco no aparece. Mover a otro momento funciona; correrlo 15 minutos, no.
 */
import { useState } from 'react';
import {
  ACCION_HACIA, ESTADOS, siguientesEstados, hhmm, etiquetaDelDia, diaLocal,
  linkWhatsApp, mensajeDeRecordatorio, telefonoParaWhatsApp,
} from '../../../modules/agenda';
import { setAppointmentStatus, rescheduleAppointment } from '../../../services/platformScheduling';
import { Hoja, EstadoChip, Punto, Aviso } from './AgendaHoja';
import BuscaHorarios from './AgendaHorarios';

const SALIDAS = {
  cancelled: {
    pregunta: '¿Cancelar este turno?',
    detalle: 'El horario queda libre para otra reserva.',
    boton: 'Sí, cancelar turno',
  },
  no_show: {
    pregunta: '¿Marcar que no vino?',
    detalle: 'El horario queda ocupado y el turno figura como no asistido.',
    boton: 'Sí, no vino',
  },
};

export default function TurnoDetalle({
  turno, base, tenantId, negocio, puedeOperar, onCerrar, onCambio, onToast,
}) {
  const [confirmar, setConfirmar] = useState(null);
  const [moviendo, setMoviendo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const [dia, setDia] = useState(diaLocal(turno.starts_at));
  const [grupo, setGrupo] = useState(null);
  const [version, setVersion] = useState(0);

  const servicio = base.servicios.find(s => s.id === turno.service_id);
  const staff = base.staff.find(s => s.id === turno.staff_id);
  const domicilio = turno.location_kind === 'home';
  const siguientes = siguientesEstados(turno.status);
  const [principal, ...otros] = siguientes.filter(e => !SALIDAS[e]);
  const salidas = siguientes.filter(e => SALIDAS[e]);
  const abierto = ['booked', 'confirmed', 'arrived'].includes(turno.status);

  const mensaje = mensajeDeRecordatorio({ turno, servicio: servicio?.name, negocio, profesional: staff?.name });
  const wa = linkWhatsApp(turno.customer_phone, mensaje);
  const sinTelefono = !String(turno.customer_phone || '').trim();
  const motivoWa = sinTelefono
    ? 'Este turno no tiene teléfono cargado.'
    : (!telefonoParaWhatsApp(turno.customer_phone) ? 'El teléfono no alcanza para armar un número de WhatsApp. Revisalo.' : '');

  const cambiarEstado = async (estado) => {
    setTrabajando(true); setError('');
    const r = await setAppointmentStatus(tenantId, turno.id, estado);
    setTrabajando(false);
    if (r?.__error) { setError(r.message || 'No se pudo cambiar el estado.'); return; }
    onToast?.(`Turno ${ESTADOS[estado]?.label.toLowerCase() || estado}`);
    onCambio();
    onCerrar();
  };

  const mover = async () => {
    if (!grupo) { setError('Elegí un horario.'); return; }
    const op = grupo.opciones[0];
    setTrabajando(true); setError('');
    const r = await rescheduleAppointment(tenantId, turno.id, {
      startsAt: op.starts_at, endsAt: op.ends_at, staffId: op.staff_id,
    });
    setTrabajando(false);
    if (r?.__error) {
      setError(r.message || 'No se pudo mover el turno.');
      setGrupo(null); setVersion(v => v + 1);   // el hueco ya no esta: recalcular
      return;
    }
    onToast?.('Turno movido');
    onCambio();
    onCerrar();
  };

  const modo = moviendo ? 'mover' : (confirmar ? 'confirmar' : 'detalle');
  const volver = () => { setMoviendo(false); setConfirmar(null); setError(''); };
  const salida = confirmar ? SALIDAS[confirmar] : null;

  let titulo = turno.customer_name || 'Turno sin nombre';
  let pie = null;
  let cuerpo;

  if (modo === 'mover') {
    titulo = 'Mover turno';
    pie = (
      <>
        <button type="button" className="ag-agd-btn" onClick={volver}>Volver</button>
        <button type="button" className="ag-agd-btn" data-primario="true" onClick={mover} disabled={trabajando}>
          {trabajando ? 'Moviendo...' : 'Mover acá'}
        </button>
      </>
    );
    cuerpo = (
      <>
        <p className="ag-agd-ayuda">
          {turno.customer_name || 'Sin nombre'} · {servicio?.name || 'Sin servicio'}, el {etiquetaDelDia(diaLocal(turno.starts_at))} a las {hhmm(turno.starts_at)}.
          {' '}Elegí un horario que no se pise con el actual.
        </p>
        {turno.service_id ? (
          <BuscaHorarios tenantId={tenantId} serviceId={turno.service_id} staffId={turno.staff_id}
            locationKind={domicilio ? 'home' : 'local'} dia={dia}
            onDia={(d) => { setDia(d); setGrupo(null); }}
            elegido={grupo?.hora} onElegir={setGrupo} version={version} />
        ) : (
          <Aviso>Este turno no tiene servicio, así que no se pueden calcular horarios para moverlo.</Aviso>
        )}
      </>
    );
  } else if (modo === 'confirmar') {
    titulo = salida.pregunta;
    pie = (
      <>
        <button type="button" className="ag-agd-btn" onClick={volver}>Volver</button>
        <button type="button" className="ag-agd-btn" data-peligro="true" disabled={trabajando}
          onClick={() => cambiarEstado(confirmar)}>
          {trabajando ? 'Guardando...' : salida.boton}
        </button>
      </>
    );
    cuerpo = <p>{salida.detalle}</p>;
  } else {
    if (puedeOperar && siguientes.length > 0) {
      pie = (
        <>
          {principal && (
            <button type="button" className="ag-agd-btn" data-primario="true" disabled={trabajando}
              onClick={() => cambiarEstado(principal)}>
              {ACCION_HACIA[principal]}
            </button>
          )}
          {otros.map(e => (
            <button key={e} type="button" className="ag-agd-btn" disabled={trabajando} onClick={() => cambiarEstado(e)}>
              {ACCION_HACIA[e]}
            </button>
          ))}
          {abierto && (
            <button type="button" className="ag-agd-btn" onClick={() => { setMoviendo(true); setError(''); }}>Mover</button>
          )}
          {salidas.map(e => (
            <button key={e} type="button" className="ag-agd-btn" onClick={() => { setConfirmar(e); setError(''); }}>
              {ACCION_HACIA[e]}
            </button>
          ))}
        </>
      );
    }
    cuerpo = (
      <>
        <div><EstadoChip status={turno.status} /></div>
        <dl className="ag-agd-ficha">
          <div><dt>Cuándo</dt><dd>{etiquetaDelDia(diaLocal(turno.starts_at))}, de {hhmm(turno.starts_at)} a {hhmm(turno.ends_at)}</dd></div>
          <div><dt>Servicio</dt><dd>{servicio?.name || 'Sin servicio'}</dd></div>
          <div><dt>Profesional</dt><dd>{staff ? <><Punto color={staff.color} /> {staff.name}</> : 'Sin asignar'}</dd></div>
          <div><dt>Teléfono</dt><dd>{turno.customer_phone || 'Sin teléfono'}</dd></div>
          <div><dt>Dónde</dt><dd>{domicilio ? `A domicilio${turno.address ? `: ${turno.address}` : ''}` : 'Local'}</dd></div>
          {domicilio && turno.travel_min > 0 && <div><dt>Traslado</dt><dd>{turno.travel_min} min antes</dd></div>}
          {turno.notes && <div><dt>Notas</dt><dd>{turno.notes}</dd></div>}
        </dl>
        {abierto && puedeOperar && (
          <div className="ag-agd-sub">
            {wa ? (
              <a className="ag-agd-btn" href={wa} target="_blank" rel="noopener noreferrer">
                Recordar por WhatsApp<span className="ag-agd-ayuda"> (se abre en otra pestaña)</span>
              </a>
            ) : (
              <>
                <button type="button" className="ag-agd-btn" disabled aria-describedby="ag-agd-wa-motivo">Recordar por WhatsApp</button>
                <p id="ag-agd-wa-motivo" className="ag-agd-ayuda">{motivoWa}</p>
              </>
            )}
          </div>
        )}
        {!puedeOperar && <Aviso>Solo podés mirar este turno: es de otra persona o tu rol es de lectura.</Aviso>}
      </>
    );
  }

  // Una sola hoja para los tres modos: cambiar de modo no la desmonta, y "foco"
  // lleva el foco adentro cada vez para que Escape siga cerrando.
  return (
    <Hoja titulo={titulo} onCerrar={onCerrar} pie={pie} error={error} foco={modo}>
      {cuerpo}
    </Hoja>
  );
}
