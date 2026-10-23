/**
 * AgendaPanel — la agenda de turnos de un negocio de servicios.
 *
 * Dos vistas: la agenda del dia y "Horarios y reglas". La segunda solo la ve
 * quien administra (acceso COMPLETO); una profesional (PROPIO) ve y mueve solo
 * sus turnos. Es navegacion, no seguridad: la proteccion real es RLS y el
 * EXCLUDE de la base. La UI simplemente no ofrece lo que no se puede hacer.
 *
 * El estado vive aca: se recarga tras cada cambio, sin tapar la pantalla con
 * un cargando (quien esta editando horarios no pierde lo que escribio).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAgendaBase } from '../../../services/platformAgenda';
import { fetchAppointmentsOrError } from '../../../services/platformScheduling';
import { accesoDeRoles, ACCESO } from '../../../modules/roles';
import { diaLocal, sumarDias, rangoDelDia, faltaConfigurar } from '../../../modules/agenda';
import AgendaDia from './AgendaDia';
import AgendaConfig from './AgendaConfig';
import TurnoDetalle from './TurnoDetalle';
import NuevoTurno from './NuevoTurno';
import '../../../styles/admin-agenda.css';

export default function AgendaPanel({
  tenantId, negocio, branch, roles, currentUserId, onToast,
}) {
  const acceso = accesoDeRoles(roles, 'agenda');
  const completo = acceso === ACCESO.COMPLETO;
  const propio = acceso === ACCESO.PROPIO;

  const [base, setBase] = useState(undefined);        // undefined = cargando, null = fallo
  const [vista, setVista] = useState('agenda');
  const [hoy] = useState(() => diaLocal());
  const [dia, setDia] = useState(hoy);
  const [turnos, setTurnos] = useState([]);
  const [cargado, setCargado] = useState(null);       // el dia cuyos turnos ya llegaron
  const [filtro, setFiltro] = useState(null);
  const [abiertoId, setAbiertoId] = useState(null);
  const [nuevo, setNuevo] = useState(false);

  const cargarBase = useCallback(async () => {
    const b = await fetchAgendaBase(tenantId);
    setBase(prev => b || (prev ?? null));
  }, [tenantId]);

  useEffect(() => {
    if (acceso === ACCESO.NADA) return undefined;
    let vigente = true;
    (async () => {
      const b = await fetchAgendaBase(tenantId);
      if (vigente) setBase(prev => b || (prev ?? null));
    })();
    return () => { vigente = false; };
  }, [tenantId, acceso]);

  // Los turnos se piden en UN efecto con guardia: una respuesta vieja (otro dia,
  // o una recarga anterior) no pisa a la actual ni deja la pantalla cargando.
  const [version, setVersion] = useState(0);
  const [errorTurnos, setErrorTurnos] = useState('');
  useEffect(() => {
    if (acceso === ACCESO.NADA) return undefined;
    let vigente = true;
    (async () => {
      const { desde, hasta } = rangoDelDia(dia);
      const r = await fetchAppointmentsOrError(tenantId, { branchId: branch?.id || null, desde, hasta });
      if (!vigente) return;
      if (r.__error) {
        setErrorTurnos(r.message || 'No se pudieron cargar los turnos.');
        setTurnos([]);
      } else {
        setErrorTurnos('');
        setTurnos(r.turnos || []);
      }
      setCargado(dia);
    })();
    return () => { vigente = false; };
  }, [tenantId, branch?.id, dia, acceso, version]);

  const cargarTurnos = () => setVersion(v => v + 1);

  const cargando = cargado !== dia;

  const miStaff = useMemo(
    () => (base ? base.staff.filter(s => currentUserId && s.user_id === currentUserId) : []),
    [base, currentUserId],
  );
  const misIds = useMemo(() => miStaff.map(s => s.id), [miStaff]);

  const visibles = useMemo(() => {
    const lista = propio ? turnos.filter(t => misIds.includes(t.staff_id))
      : (filtro ? turnos.filter(t => t.staff_id === filtro) : turnos);
    return [...lista].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [turnos, propio, misIds, filtro]);

  const staffVisibles = useMemo(() => {
    if (!base) return [];
    if (propio) return miStaff;
    return filtro ? base.staff.filter(s => s.id === filtro) : base.staff;
  }, [base, propio, miStaff, filtro]);

  const cambiarDia = (a) => {
    if (typeof a === 'string') setDia(a);
    else if (a === 0) setDia(hoy);
    else setDia(d => sumarDias(d, a));
  };

  const recargarTodo = () => { cargarBase(); cargarTurnos(); };

  if (acceso === ACCESO.NADA) {
    return (
      <div className="ag-agenda"><p className="ag-agd-cargando" role="status">No tenés acceso a la agenda.</p></div>
    );
  }
  if (base === undefined) {
    return <div className="ag-agenda"><p className="ag-agd-cargando" role="status">Cargando la agenda...</p></div>;
  }
  if (base === null) {
    return (
      <div className="ag-agenda">
        <div className="ag-agd-vacio" role="alert">
          <h3>No pudimos cargar la agenda</h3>
          <p>Revisá la conexión y probá de nuevo.</p>
          <button type="button" className="ag-agd-btn" onClick={() => { setBase(undefined); cargarBase(); }}>Reintentar</button>
        </div>
      </div>
    );
  }

  const abierto = abiertoId ? turnos.find(t => t.id === abiertoId) : null;
  const puedeOperar = (t) => completo || (propio && misIds.includes(t.staff_id));
  const puedeCrear = completo || (propio && misIds.length > 0);
  const sinVinculo = propio && misIds.length === 0;

  return (
    <div className="ag-agenda">
      {completo && (
        <div className="ag-agd-segmento" role="group" aria-label="Vista de la agenda">
          <button type="button" aria-pressed={vista === 'agenda'} onClick={() => setVista('agenda')}>Agenda</button>
          <button type="button" aria-pressed={vista === 'config'} onClick={() => setVista('config')}>Horarios y reglas</button>
        </div>
      )}

      {vista === 'config' && completo ? (
        <AgendaConfig base={base} tenantId={tenantId} onGuardado={cargarBase} />
      ) : sinVinculo ? (
        <div className="ag-agd-vacio">
          <h3>Tu usuario no está vinculado a una profesional</h3>
          <p>Pedile a quien administra el negocio que te vincule para ver tus turnos.</p>
        </div>
      ) : (
        <AgendaDia
          base={base} dia={dia} onDia={cambiarDia} hoy={hoy}
          turnos={visibles} cargando={cargando} errorTurnos={errorTurnos} onReintentar={cargarTurnos}
          staffVisibles={staffVisibles} filtro={filtro} onFiltro={setFiltro}
          acceso={acceso} puedeCrear={puedeCrear} pendientes={faltaConfigurar(base)}
          onAbrir={setAbiertoId} onNuevo={() => setNuevo(true)} onIrConfig={() => setVista('config')}
        />
      )}

      {abierto && (
        <TurnoDetalle
          key={abierto.id} turno={abierto} base={base} tenantId={tenantId} negocio={negocio}
          puedeOperar={puedeOperar(abierto)}
          onCerrar={() => setAbiertoId(null)} onCambio={recargarTodo} onToast={onToast}
        />
      )}
      {nuevo && (
        <NuevoTurno
          base={base} tenantId={tenantId} branch={branch} diaInicial={dia}
          acceso={acceso} miStaffId={misIds[0] || null}
          onCerrar={() => setNuevo(false)}
          onCreado={() => { setNuevo(false); cargarTurnos(); onToast?.('Turno reservado'); }}
        />
      )}
    </div>
  );
}
