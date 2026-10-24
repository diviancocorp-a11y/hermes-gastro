/**
 * Horarios y reglas: lo que la agenda necesita saber para ofrecer horarios.
 * Orden de las secciones = orden en que se destraba la agenda: primero cuanto
 * dura cada servicio, despues quien atiende y cuando, despues las ausencias y
 * por ultimo las reglas de reserva.
 */
import { useState } from 'react';
import { addTimeOff, removeTimeOff, saveServiceTiming } from '../../../services/platformAgenda';
import { diaLocal, hhmm, etiquetaDelDia } from '../../../modules/agenda';
import { Punto, PieGuardar, Aviso } from './AgendaHoja';
import AgendaProfesionales from './AgendaProfesionales';
import AgendaReglas from './AgendaReglas';
import AgendaZonas from './AgendaZonas';

/* ───────────────────────────── Servicios ───────────────────────────── */

function Servicios({ base, tenantId, onGuardado }) {
  const [cambios, setCambios] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [res, setRes] = useState(null);

  const valor = (s, k) => (cambios[s.id]?.[k] ?? s[k] ?? '');
  const editar = (s, k, v) => {
    setCambios(prev => ({ ...prev, [s.id]: { ...prev[s.id], [k]: v } }));
    setRes(null);
  };

  const guardar = async () => {
    const ids = Object.keys(cambios);
    if (!ids.length) { setRes({ tipo: 'ok', texto: 'No hay cambios para guardar.' }); return; }
    setGuardando(true);
    for (const id of ids) {
      const s = base.servicios.find(x => x.id === id);
      const r = await saveServiceTiming(tenantId, id, {
        duration_min: valor(s, 'duration_min'),
        buffer_after_min: valor(s, 'buffer_after_min'),
        is_addon: !!valor(s, 'is_addon'),
      });
      if (r?.__error) {
        setGuardando(false);
        setRes({ tipo: 'error', texto: `${s.name}: ${r.message}` });
        return;
      }
    }
    setGuardando(false);
    setCambios({});
    setRes({ tipo: 'ok', texto: 'Servicios guardados.' });
    onGuardado();
  };

  return (
    <section className="ag-agd-seccion" aria-labelledby="ag-agd-h-serv">
      <header>
        <h3 id="ag-agd-h-serv">Servicios</h3>
        <p className="ag-agd-ayuda">
          La duración es lo que ocupa el turno. El margen es el tiempo libre que queda después, para ordenar o descansar. Un adicional se suma a otro servicio y no se reserva solo.
        </p>
      </header>
      {!base.servicios.length && <Aviso>No hay servicios cargados. Se cargan en Productos.</Aviso>}
      <ul className="ag-agd-dias">
        {base.servicios.map(s => {
          const adicional = !!valor(s, 'is_addon');
          const falta = !adicional && !(Number(valor(s, 'duration_min')) > 0);
          return (
            <li key={s.id} className="ag-agd-fila-serv" data-falta={falta}>
              <div className="ag-agd-nombre">
                {s.name}
                {falta && <span className="ag-agd-chip" data-tono="alerta"><i aria-hidden="true" />Falta la duración</span>}
                {adicional && <span className="ag-agd-chip" data-tono="neutro"><i aria-hidden="true" />Adicional</span>}
              </div>
              <label className="ag-agd-opcion" data-ancho="completo">
                <input type="checkbox" checked={adicional} onChange={(e) => editar(s, 'is_addon', e.target.checked)} />
                Es un adicional (se suma a otro servicio, no se reserva solo)
              </label>
              <div className="ag-agd-campo">
                <label htmlFor={`ag-s-d-${s.id}`}>{adicional ? 'Duración (min, opcional)' : 'Duración (min)'}</label>
                <input id={`ag-s-d-${s.id}`} className="ag-agd-input" type="number" inputMode="numeric" min={1}
                  value={valor(s, 'duration_min')} onChange={(e) => editar(s, 'duration_min', e.target.value)} />
              </div>
              <div className="ag-agd-campo">
                <label htmlFor={`ag-s-m-${s.id}`}>{adicional ? 'Margen (min, opcional)' : 'Margen (min)'}</label>
                <input id={`ag-s-m-${s.id}`} className="ag-agd-input" type="number" inputMode="numeric" min={0}
                  value={valor(s, 'buffer_after_min')} onChange={(e) => editar(s, 'buffer_after_min', e.target.value)} />
              </div>
            </li>
          );
        })}
      </ul>
      {base.servicios.length > 0 && (
        <PieGuardar onGuardar={guardar} guardando={guardando} res={res} etiqueta="Guardar servicios" />
      )}
    </section>
  );
}

/* ───────────────────────────── Ausencias ───────────────────────────── */

const cuando = (a) => {
  const d1 = diaLocal(a.starts_at); const d2 = diaLocal(a.ends_at);
  const h1 = hhmm(a.starts_at); const h2 = hhmm(a.ends_at);
  const todo = h1 === '00:00' && (h2 === '23:59' || h2 === '00:00');
  if (d1 === d2) return `${etiquetaDelDia(d1)}${todo ? ', todo el día' : `, de ${h1} a ${h2}`}`;
  return `${etiquetaDelDia(d1)} ${h1} → ${etiquetaDelDia(d2)} ${h2}`;
};

function Ausencias({ base, tenantId, onGuardado }) {
  const hoy = diaLocal();
  const [quien, setQuien] = useState('');
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [todoElDia, setTodoElDia] = useState(true);
  const [h1, setH1] = useState('09:00');
  const [h2, setH2] = useState('18:00');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [res, setRes] = useState(null);
  const [borrando, setBorrando] = useState(null);
  const [resBorrar, setResBorrar] = useState(null);

  const agregar = async () => {
    const ini = new Date(`${desde}T${todoElDia ? '00:00' : h1}`);
    const fin = new Date(`${hasta}T${todoElDia ? '23:59' : h2}`);
    if (!(fin > ini)) { setRes({ tipo: 'error', texto: 'La fecha de fin tiene que ser posterior al inicio.' }); return; }
    setGuardando(true);
    const r = await addTimeOff(tenantId, {
      staffId: quien || null, startsAt: ini.toISOString(), endsAt: fin.toISOString(), reason: motivo,
    });
    setGuardando(false);
    if (r?.__error) { setRes({ tipo: 'error', texto: r.message || 'No se pudo guardar la ausencia.' }); return; }
    setMotivo('');
    setRes({ tipo: 'ok', texto: 'Ausencia guardada. Esos horarios dejan de ofrecerse.' });
    onGuardado();
  };

  const borrar = async (a) => {
    setBorrando(a.id); setResBorrar(null);
    const ok = await removeTimeOff(tenantId, a.id);
    setBorrando(null);
    if (!ok) { setResBorrar({ tipo: 'error', texto: 'No se pudo borrar la ausencia. Probá de nuevo.' }); return; }
    setResBorrar({ tipo: 'ok', texto: 'Ausencia borrada.' });
    onGuardado();
  };

  return (
    <section className="ag-agd-seccion" aria-labelledby="ag-agd-h-aus">
      <header>
        <h3 id="ag-agd-h-aus">Ausencias</h3>
        <p className="ag-agd-ayuda">Vacaciones, feriados o un día que no se atiende. En esos horarios no se ofrecen turnos.</p>
      </header>

      {base.ausencias.length === 0 ? (
        <p className="ag-agd-ayuda">No hay ausencias próximas.</p>
      ) : (
        <ul className="ag-agd-dias">
          {base.ausencias.map(a => {
            const s = base.staff.find(x => x.id === a.staff_id);
            return (
              <li key={a.id} className="ag-agd-ausencia">
                <div>
                  <strong>{s ? <><Punto color={s.color} /> {s.name}</> : 'Todo el negocio'}</strong>
                  <span>{cuando(a)}{a.reason ? ` · ${a.reason}` : ''}</span>
                </div>
                <button type="button" className="ag-agd-btn" data-chico="true" disabled={borrando !== null}
                  aria-label={`Borrar ausencia: ${s ? s.name : 'todo el negocio'}, ${cuando(a)}`} onClick={() => borrar(a)}>
                  {borrando === a.id ? 'Borrando...' : 'Borrar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {resBorrar && <Aviso tipo={resBorrar.tipo}>{resBorrar.texto}</Aviso>}

      <fieldset className="ag-agd-grupo">
        <legend>Agregar una ausencia</legend>
        <div className="ag-agd-campo">
          <label htmlFor="ag-a-quien">Quién</label>
          <select id="ag-a-quien" className="ag-agd-input" value={quien} onChange={(e) => setQuien(e.target.value)}>
            <option value="">Todo el negocio</option>
            {base.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="ag-agd-dos">
          <div className="ag-agd-campo">
            <label htmlFor="ag-a-desde">Desde</label>
            <input id="ag-a-desde" type="date" className="ag-agd-input" value={desde}
              onChange={(e) => { setDesde(e.target.value); if (e.target.value > hasta) setHasta(e.target.value); }} />
          </div>
          <div className="ag-agd-campo">
            <label htmlFor="ag-a-hasta">Hasta</label>
            <input id="ag-a-hasta" type="date" className="ag-agd-input" value={hasta} min={desde}
              onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
        <label className="ag-agd-opcion">
          <input type="checkbox" checked={todoElDia} onChange={(e) => setTodoElDia(e.target.checked)} />
          Todo el día
        </label>
        {!todoElDia && (
          <div className="ag-agd-dos">
            <div className="ag-agd-campo">
              <label htmlFor="ag-a-h1">Hora de inicio</label>
              <input id="ag-a-h1" type="time" className="ag-agd-input" value={h1} onChange={(e) => setH1(e.target.value)} />
            </div>
            <div className="ag-agd-campo">
              <label htmlFor="ag-a-h2">Hora de fin</label>
              <input id="ag-a-h2" type="time" className="ag-agd-input" value={h2} onChange={(e) => setH2(e.target.value)} />
            </div>
          </div>
        )}
        <div className="ag-agd-campo">
          <label htmlFor="ag-a-motivo">Motivo (opcional)</label>
          <input id="ag-a-motivo" className="ag-agd-input" value={motivo} autoComplete="off"
            onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <PieGuardar onGuardar={agregar} guardando={guardando} res={res} etiqueta="Agregar ausencia" />
      </fieldset>
    </section>
  );
}

export default function AgendaConfig({ base, tenantId, onGuardado }) {
  return (
    <>
      <Servicios base={base} tenantId={tenantId} onGuardado={onGuardado} />
      <AgendaProfesionales base={base} tenantId={tenantId} onGuardado={onGuardado} />
      <Ausencias base={base} tenantId={tenantId} onGuardado={onGuardado} />
      <AgendaReglas base={base} tenantId={tenantId} onGuardado={onGuardado} />
      <AgendaZonas base={base} tenantId={tenantId} onGuardado={onGuardado} />
    </>
  );
}
