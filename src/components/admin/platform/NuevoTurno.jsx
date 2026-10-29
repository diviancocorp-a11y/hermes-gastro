/**
 * NuevoTurno — reservar en una sola hoja, sin pasos que ir y volver.
 *
 * servicio -> modalidad (solo si el negocio ofrece las dos) -> profesional ->
 * dia y horario -> datos. Los horarios salen de la base: lo que se ofrece ya
 * descuenta turnos, ausencias, margen y traslado. Si igual dos personas piden
 * el mismo hueco, el EXCLUDE rebota y se muestra el mensaje y se recalcula.
 */
import { useMemo, useState } from 'react';
import { reservables, quienHace } from '../../../modules/agenda';
import { createAppointment } from '../../../services/platformScheduling';
import { Hoja, Aviso } from './AgendaHoja';
import BuscaHorarios from './AgendaHorarios';

export default function NuevoTurno({
  base, tenantId, branch, diaInicial, acceso, miStaffId, onCerrar, onCreado,
}) {
  const reglas = base.reglas;
  const ambas = reglas.offers_local && reglas.offers_home;
  const propio = acceso === 'propio';

  // Un servicio en borrador (active=false) no sale en el catalogo publico pero
  // se agenda igual desde el panel: la baja logica es is_archived y ya viene
  // filtrada en fetchAgendaBase.
  const servicios = useMemo(() => reservables(base.servicios), [base.servicios]);
  const sinDuracion = base.servicios.filter(s => !(s.duration_min > 0));

  const [servicioId, setServicioId] = useState('');
  const [modalidad, setModalidad] = useState(reglas.offers_local ? 'local' : 'home');
  const [staffId, setStaffId] = useState(propio ? miStaffId : 'any');
  const [dia, setDia] = useState(diaInicial);
  const [grupo, setGrupo] = useState(null);
  const [version, setVersion] = useState(0);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [zonaId, setZonaId] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [invalido, setInvalido] = useState('');   // campo con error de validacion
  const [salir, setSalir] = useState(false);       // pide confirmar antes de descartar

  // A domicilio el viaje depende de la zona. Sin zonas cargadas se cae al
  // traslado fijo de las reglas (el aviso de abajo lo dice).
  const zonas = base.zonas || [];
  const aDomicilio = modalidad === 'home';
  const zona = aDomicilio ? zonas.find(z => z.id === zonaId) : null;
  const viaje = aDomicilio ? (zona ? Number(zona.travel_min) || 0 : (zonas.length ? null : (Number(reglas.travel_min) || 0))) : 0;

  const profesionales = servicioId
    ? quienHace(servicioId, base.staff, base.relaciones).filter(s => !propio || s.id === miStaffId)
    : [];
  const staffElegido = profesionales.some(s => s.id === staffId) ? staffId : (propio ? miStaffId : 'any');

  const reiniciarHorario = () => setGrupo(null);

  // Con datos escritos, cerrar no descarta en silencio: Escape o Cancelar piden
  // confirmacion, y un toque en el fondo se ignora.
  const hayDatos = !!(servicioId || nombre || telefono || direccion || notas || grupo || zonaId);
  const intentarCerrar = () => { if (hayDatos) setSalir(s => !s); else onCerrar(); };

  const fallar = (campo, texto, enfocar) => {
    setInvalido(campo); setError(texto);
    const el = typeof enfocar === 'function' ? enfocar() : document.getElementById(enfocar);
    el?.focus();
  };

  const reservar = async () => {
    setInvalido('');
    if (!servicioId) return fallar('servicio', 'Elegí un servicio.', 'ag-agd-servicio');
    if (aDomicilio && zonas.length && !zona) return fallar('zona', 'Elegí la zona: de ahí sale el tiempo de viaje.', 'ag-agd-zona');
    if (!grupo) return fallar('hora', 'Elegí un horario.', () => document.querySelector('.ag-agd-hora') || document.getElementById('ag-agd-busca-dia'));
    if (!nombre.trim()) return fallar('nombre', 'Poné el nombre de quien reserva.', 'ag-agd-nombre');
    if (modalidad === 'home' && !direccion.trim()) return fallar('direccion', 'A domicilio hace falta la dirección.', 'ag-agd-dir');
    const op = grupo.opciones.find(o => o.staff_id === staffElegido) || grupo.opciones[0];
    setEnviando(true); setError('');
    const r = await createAppointment(tenantId, {
      branchId: branch?.id || null,
      staffId: op.staff_id,
      serviceId: servicioId,
      customerName: nombre,
      customerPhone: telefono,
      startsAt: op.starts_at,
      endsAt: op.ends_at,
      notes: notas,
      locationKind: modalidad,
      address: direccion,
      travelMin: viaje ?? 0,
      zoneId: zona ? zona.id : null,
      source: 'panel',
    });
    setEnviando(false);
    if (r?.__error) {
      setError(r.message || 'No se pudo reservar.');
      reiniciarHorario(); setVersion(v => v + 1);   // el hueco pudo haberse ocupado
      return;
    }
    onCreado(r.appointment);
  };

  return (
    <Hoja titulo="Nuevo turno" onCerrar={intentarCerrar} cerrarConFondo={false}
      error={salir ? '' : error} foco={salir ? 'salir' : 'datos'}
      pie={salir ? (
        <>
          <p className="ag-agd-ayuda" role="alert">Tenés datos escritos. Si salís ahora, se pierden.</p>
          <button type="button" className="ag-agd-btn" onClick={() => setSalir(false)}>Seguir editando</button>
          <button type="button" className="ag-agd-btn" data-peligro="true" onClick={onCerrar}>Descartar</button>
        </>
      ) : (
        <>
          <button type="button" className="ag-agd-btn" onClick={intentarCerrar}>Cancelar</button>
          <button type="button" className="ag-agd-btn" data-primario="true" onClick={reservar} disabled={enviando}>
            {enviando ? 'Reservando...' : 'Reservar'}
          </button>
        </>
      )}>
      {sinDuracion.length > 0 && (
        <Aviso>
          {sinDuracion.length === 1 ? 'Un servicio no aparece' : `${sinDuracion.length} servicios no aparecen`}
          {' '}porque no tienen duración cargada ({sinDuracion.map(s => s.name).join(', ')}). Sin duración no se pueden calcular horarios: se completa en Horarios y reglas.
        </Aviso>
      )}

      <div className="ag-agd-campo">
        <label htmlFor="ag-agd-servicio">Servicio</label>
        <select id="ag-agd-servicio" className="ag-agd-input" value={servicioId} aria-invalid={invalido === 'servicio'}
          onChange={(e) => { setServicioId(e.target.value); reiniciarHorario(); }}>
          <option value="">{servicios.length ? 'Elegí un servicio' : 'No hay servicios con duración'}</option>
          {servicios.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_min} min)</option>)}
        </select>
      </div>

      {ambas && (
        <fieldset className="ag-agd-grupo">
          <legend>Dónde</legend>
          <div className="ag-agd-opciones" data-fila="true">
            {[['local', 'En el local'], ['home', 'A domicilio']].map(([v, t]) => (
              <label key={v} className="ag-agd-opcion">
                <input type="radio" name="ag-agd-modalidad" checked={modalidad === v}
                  onChange={() => { setModalidad(v); setZonaId(''); reiniciarHorario(); }} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {aDomicilio && (
        zonas.length ? (
          <div className="ag-agd-campo">
            <label htmlFor="ag-agd-zona">Zona</label>
            <select id="ag-agd-zona" className="ag-agd-input" value={zonaId} aria-invalid={invalido === 'zona'}
              aria-describedby="ag-agd-zona-a"
              onChange={(e) => { setZonaId(e.target.value); reiniciarHorario(); }}>
              <option value="">Elegí la zona</option>
              {zonas.map(z => <option key={z.id} value={z.id}>{z.name} · {z.travel_min} min</option>)}
            </select>
            <span id="ag-agd-zona-a" className="ag-agd-ayuda">Los horarios descuentan el viaje hasta esa zona.</span>
          </div>
        ) : (
          <Aviso>
            Todavía no hay zonas de domicilio cargadas. Se usa el traslado fijo de {Number(reglas.travel_min) || 0} min; las zonas se cargan en Horarios y reglas.
          </Aviso>
        )
      )}

      {servicioId && !propio && (
        <fieldset className="ag-agd-grupo">
          <legend>Profesional</legend>
          <div className="ag-agd-opciones" data-fila="true">
            <label className="ag-agd-opcion">
              <input type="radio" name="ag-agd-staff" checked={staffElegido === 'any'}
                onChange={() => { setStaffId('any'); reiniciarHorario(); }} />
              Cualquiera
            </label>
            {profesionales.map(s => (
              <label key={s.id} className="ag-agd-opcion">
                <input type="radio" name="ag-agd-staff" checked={staffElegido === s.id}
                  onChange={() => { setStaffId(s.id); reiniciarHorario(); }} />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {servicioId && aDomicilio && zonas.length > 0 && !zona && (
        <p className="ag-agd-ayuda">Elegí la zona para ver los horarios.</p>
      )}
      {servicioId && viaje !== null && (
        <BuscaHorarios tenantId={tenantId} serviceId={servicioId}
          staffId={staffElegido === 'any' ? null : staffElegido}
          locationKind={modalidad} travelMin={aDomicilio ? viaje : null} dia={dia}
          onDia={(d) => { setDia(d); reiniciarHorario(); }}
          elegido={grupo?.hora} onElegir={setGrupo} version={version} />
      )}

      <fieldset className="ag-agd-grupo">
        <legend>Datos de quien reserva</legend>
        <div className="ag-agd-campo">
          <label htmlFor="ag-agd-nombre">Nombre</label>
          <input id="ag-agd-nombre" className="ag-agd-input" value={nombre} autoComplete="off" aria-invalid={invalido === 'nombre'}
            onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="ag-agd-campo">
          <label htmlFor="ag-agd-tel">Teléfono</label>
          <input id="ag-agd-tel" className="ag-agd-input" type="tel" inputMode="tel" value={telefono}
            autoComplete="off" onChange={(e) => setTelefono(e.target.value)} />
          <span className="ag-agd-ayuda">Con el teléfono podés mandarle el recordatorio por WhatsApp.</span>
        </div>
        {modalidad === 'home' && (
          <div className="ag-agd-campo">
            <label htmlFor="ag-agd-dir">Dirección</label>
            <input id="ag-agd-dir" className="ag-agd-input" value={direccion} autoComplete="off" aria-invalid={invalido === 'direccion'}
              onChange={(e) => setDireccion(e.target.value)} />
            {viaje > 0 && (
              <span className="ag-agd-ayuda">Se reservan {viaje} min antes para el traslado.</span>
            )}
          </div>
        )}
        <div className="ag-agd-campo">
          <label htmlFor="ag-agd-notas">Notas</label>
          <textarea id="ag-agd-notas" className="ag-agd-input" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
      </fieldset>

    </Hoja>
  );
}
