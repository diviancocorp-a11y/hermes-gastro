/**
 * Profesionales: quien atiende, cuando trabaja y que servicios hace.
 * Cada profesional se muestra con su horario resumido y se abre para editar.
 * Tres guardados separados (datos, horario, servicios): tocar uno no pisa el
 * borrador de los otros.
 */
import { useState } from 'react';
import {
  COLORES_STAFF, DIAS, ORDEN_SEMANA, resumenDeHorario, validarTramos,
} from '../../../modules/agenda';
import { saveStaffMember, saveWeeklySchedule, saveStaffServices } from '../../../services/platformAgenda';
import { Punto, PieGuardar, Aviso } from './AgendaHoja';

const hh = (t) => String(t).slice(0, 5);

const NOMBRES_COLOR = ['Rosa', 'Violeta', 'Verde azulado', 'Ámbar', 'Azul', 'Gris'];

function Colores({ valor, onCambio }) {
  return (
    <div className="ag-agd-colores" role="group" aria-label="Color de la profesional">
      {COLORES_STAFF.map((c, i) => (
        <button key={c} type="button" className="ag-agd-color" style={{ '--c': c }}
          aria-pressed={valor === c} aria-label={`${NOMBRES_COLOR[i] || `Color ${i + 1}`}${valor === c ? ', elegido' : ''}`}
          onClick={() => onCambio(c)}>
          {valor === c ? <span aria-hidden="true">{'✓'}</span> : null}
        </button>
      ))}
    </div>
  );
}

function Datos({ staff, tenantId, onGuardado, onListo }) {
  const [nombre, setNombre] = useState(staff?.name || '');
  const [color, setColor] = useState(staff?.color || COLORES_STAFF[0]);
  const [guardando, setGuardando] = useState(false);
  const [res, setRes] = useState(null);
  const id = staff?.id || 'nueva';

  const guardar = async () => {
    setGuardando(true);
    const r = await saveStaffMember(tenantId, { id: staff?.id, name: nombre, color });
    setGuardando(false);
    if (r?.__error) { setRes({ tipo: 'error', texto: r.message }); return; }
    setRes({ tipo: 'ok', texto: 'Datos guardados.' });
    onGuardado();
    onListo?.();
  };

  return (
    <div className="ag-agd-sub">
      <div className="ag-agd-campo">
        <label htmlFor={`ag-st-n-${id}`}>Nombre</label>
        <input id={`ag-st-n-${id}`} className="ag-agd-input" value={nombre} autoComplete="off"
          onChange={(e) => { setNombre(e.target.value); setRes(null); }} />
      </div>
      <div className="ag-agd-campo">
        <span className="ag-agd-rotulo">Color en la agenda</span>
        <Colores valor={color} onCambio={(c) => { setColor(c); setRes(null); }} />
      </div>
      <PieGuardar onGuardar={guardar} guardando={guardando} res={res} etiqueta={staff ? 'Guardar datos' : 'Agregar profesional'} />
    </div>
  );
}

function Horario({ staff, base, tenantId, onGuardado }) {
  const inicial = () => {
    const m = {};
    for (const h of base.horarios.filter(x => x.staff_id === staff.id)) {
      (m[h.weekday] ||= []).push({ start: hh(h.start_time), end: hh(h.end_time) });
    }
    return m;
  };
  const [dias, setDias] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [res, setRes] = useState(null);

  const cambiar = (fn) => { setDias(prev => fn({ ...prev })); setRes(null); };
  const alternar = (wd, on) => cambiar(m => { if (on) m[wd] = [{ start: '09:00', end: '18:00' }]; else delete m[wd]; return m; });
  const editar = (wd, i, campo, v) => cambiar(m => { m[wd] = m[wd].map((t, j) => (j === i ? { ...t, [campo]: v } : t)); return m; });
  const agregar = (wd) => cambiar(m => { m[wd] = [...m[wd], { start: '16:00', end: '20:00' }]; return m; });
  const quitar = (wd, i) => cambiar(m => {
    m[wd] = m[wd].filter((_, j) => j !== i);
    if (!m[wd].length) delete m[wd];
    return m;
  });

  const guardar = async () => {
    const tramos = Object.entries(dias).flatMap(([wd, lista]) =>
      lista.map(t => ({ weekday: Number(wd), start_time: t.start, end_time: t.end })));
    const problema = validarTramos(tramos);
    if (problema) { setRes({ tipo: 'error', texto: problema }); return; }
    setGuardando(true);
    const r = await saveWeeklySchedule(tenantId, staff.id, tramos);
    setGuardando(false);
    if (r?.__error) { setRes({ tipo: 'error', texto: r.message || 'No se pudo guardar el horario.' }); return; }
    setRes({ tipo: 'ok', texto: tramos.length ? 'Horario guardado.' : 'Horario guardado. Sin días de trabajo no hay horarios para ofrecer.' });
    onGuardado();
  };

  return (
    <div className="ag-agd-sub">
      <h4>Horario semanal</h4>
      <div className="ag-agd-dias">
        {ORDEN_SEMANA.map(wd => {
          const lista = dias[wd];
          return (
            <div key={wd} className="ag-agd-dia-cfg">
              <label className="ag-agd-opcion">
                <input type="checkbox" checked={!!lista} onChange={(e) => alternar(wd, e.target.checked)} />
                <span>{DIAS[wd]}{lista ? '' : ' · no trabaja'}</span>
              </label>
              {lista && lista.map((t, i) => (
                <div key={i} className="ag-agd-tramo">
                  <input type="time" className="ag-agd-input" value={t.start}
                    aria-label={`${DIAS[wd]}, tramo ${i + 1}, desde`} onChange={(e) => editar(wd, i, 'start', e.target.value)} />
                  <span aria-hidden="true">a</span>
                  <input type="time" className="ag-agd-input" value={t.end}
                    aria-label={`${DIAS[wd]}, tramo ${i + 1}, hasta`} onChange={(e) => editar(wd, i, 'end', e.target.value)} />
                  <button type="button" className="ag-agd-btn" data-chico="true"
                    aria-label={`Quitar tramo ${i + 1} del ${DIAS[wd].toLowerCase()}`} onClick={() => quitar(wd, i)}>Quitar</button>
                </div>
              ))}
              {lista && (
                <button type="button" className="ag-agd-btn" data-chico="true" onClick={() => agregar(wd)}>
                  Agregar otro tramo
                </button>
              )}
            </div>
          );
        })}
      </div>
      <PieGuardar onGuardar={guardar} guardando={guardando} res={res} etiqueta="Guardar horario" />
    </div>
  );
}

function Servicios({ staff, base, tenantId, onGuardado }) {
  const [sel, setSel] = useState(() => new Set(base.relaciones.filter(r => r.staff_id === staff.id).map(r => r.service_id)));
  const [guardando, setGuardando] = useState(false);
  const [res, setRes] = useState(null);

  const alternar = (id) => {
    setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setRes(null);
  };
  const guardar = async () => {
    setGuardando(true);
    const r = await saveStaffServices(tenantId, staff.id, [...sel]);
    setGuardando(false);
    if (r?.__error) { setRes({ tipo: 'error', texto: r.message || 'No se pudieron guardar los servicios.' }); return; }
    setRes({ tipo: 'ok', texto: sel.size ? 'Servicios guardados.' : 'Guardado. Sin ninguno marcado, puede hacer todos.' });
    onGuardado();
  };

  return (
    <fieldset className="ag-agd-grupo">
      <legend>Qué servicios hace</legend>
      <p className="ag-agd-ayuda">Si no marcás ninguno, puede hacer todos los servicios.</p>
      <div className="ag-agd-opciones">
        {base.servicios.map(s => (
          <label key={s.id} className="ag-agd-opcion">
            <input type="checkbox" checked={sel.has(s.id)} onChange={() => alternar(s.id)} />
            {s.name}
          </label>
        ))}
        {!base.servicios.length && <p className="ag-agd-ayuda">Todavía no hay servicios cargados.</p>}
      </div>
      <PieGuardar onGuardar={guardar} guardando={guardando} res={res} etiqueta="Guardar servicios" />
    </fieldset>
  );
}

function Tarjeta({ staff, base, tenantId, onGuardado }) {
  const [abierta, setAbierta] = useState(false);
  const resumen = resumenDeHorario(base.horarios.filter(h => h.staff_id === staff.id));
  return (
    <li className="ag-agd-staff">
      <div className="ag-agd-staff-cab">
        <div>
          <strong><Punto color={staff.color} />{staff.name}</strong>
          <span>{resumen || 'Sin horario de trabajo: no tiene horarios para ofrecer.'}</span>
        </div>
        <button type="button" className="ag-agd-btn" aria-expanded={abierta}
          aria-label={`${abierta ? 'Cerrar' : 'Editar'} ${staff.name}`} onClick={() => setAbierta(a => !a)}>
          {abierta ? 'Cerrar' : 'Editar'}
        </button>
      </div>
      {abierta && (
        <div className="ag-agd-staff-cuerpo">
          <Datos staff={staff} tenantId={tenantId} onGuardado={onGuardado} />
          <Horario staff={staff} base={base} tenantId={tenantId} onGuardado={onGuardado} />
          <Servicios staff={staff} base={base} tenantId={tenantId} onGuardado={onGuardado} />
        </div>
      )}
    </li>
  );
}

export default function AgendaProfesionales({ base, tenantId, onGuardado }) {
  const [agregando, setAgregando] = useState(false);
  return (
    <section className="ag-agd-seccion" aria-labelledby="ag-agd-h-staff">
      <header>
        <h3 id="ag-agd-h-staff">Profesionales</h3>
        <p className="ag-agd-ayuda">Cada una tiene su horario y sus servicios. Sin horario no se ofrecen turnos.</p>
      </header>
      {!base.staff.length && <Aviso>Todavía no cargaste a nadie que atienda.</Aviso>}
      <ul className="ag-agd-dias">
        {base.staff.map(s => <Tarjeta key={s.id} staff={s} base={base} tenantId={tenantId} onGuardado={onGuardado} />)}
      </ul>
      {agregando ? (
        <div className="ag-agd-staff">
          <Datos tenantId={tenantId} onGuardado={onGuardado} onListo={() => setAgregando(false)} />
          <button type="button" className="ag-agd-btn" onClick={() => setAgregando(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="ag-agd-btn" onClick={() => setAgregando(true)}>Agregar profesional</button>
      )}
    </section>
  );
}
