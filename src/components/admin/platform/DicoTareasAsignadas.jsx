import { useMemo, useState } from 'react';

const CLAVE_DECISIONES = 'dico:centro-decisiones:v1';
const CLAVE_TAREAS = 'dico:sala-control:tareas:v1';

function leerJson(clave, valorInicial) {
  try {
    const valor = JSON.parse(localStorage.getItem(clave) || JSON.stringify(valorInicial));
    return valor && typeof valor === 'object' ? valor : valorInicial;
  } catch {
    return valorInicial;
  }
}

function horaCorta(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function fechaCorta(fecha) {
  if (!fecha) return '';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(new Date(fecha));
}

function etiquetaEstado(estado) {
  return {
    asignada: 'Asignada',
    aceptada: 'Aceptada',
    rechazada: 'Rechazada',
    terminada: 'Terminada',
    evaluada: 'Evaluada',
  }[estado] || 'Asignada';
}

function tareaOrdenada(decisiones, tareasMeta, currentUserId, vista) {
  const prioridad = { alta: 0, media: 1, baja: 2 };
  return Object.entries(tareasMeta)
    .filter(([id, metadata]) => decisiones[id] === 'tarea' && metadata?.item)
    .filter(([, metadata]) => vista === 'propias'
      ? metadata.assignedBy === currentUserId
      : !metadata.assignedTo || !currentUserId || metadata.assignedTo === currentUserId)
    .map(([id, metadata]) => ({ ...metadata.item, id, metadata }))
    .sort((a, b) => (prioridad[a.gravedad] ?? 3) - (prioridad[b.gravedad] ?? 3));
}

function TareaAsignada({ item, vista, onActualizar, onIr, puedeEvaluar }) {
  const [motivo, setMotivo] = useState('');
  const [comentario, setComentario] = useState('');
  const metadata = item.metadata || {};
  const estado = metadata.workflowStatus || 'asignada';
  const recibida = vista === 'recibidas';
  const propia = vista === 'propias';

  return (
    <article className={`dico-panel-decision dico-panel-decision--${item.gravedad || 'baja'}`}>
      <div className="dico-panel-decision-copy">
        <div className="dico-panel-decision-meta">
          <span className="dico-panel-decision-zone">{item.zona || 'Operación'}</span>
          <span className="dico-panel-task-state">{etiquetaEstado(estado)}</span>
        </div>
        <h3>{item.titulo}</h3>
        <p>{item.recomendacion}</p>
        {metadata.assignedByName && <span className="dico-panel-task-detail">Asignada por {metadata.assignedByName}{metadata.assignedAt ? ` · ${horaCorta(metadata.assignedAt)}` : ''}</span>}
        {metadata.assignedToName && propia && <span className="dico-panel-task-detail">Para {metadata.assignedToName}{metadata.assignedToPosition ? ` · ${metadata.assignedToPosition}` : ''}</span>}
        {metadata.directSupervisorName && <span className="dico-panel-task-detail">Encargado directo: {metadata.directSupervisorName}</span>}
        {metadata.dueAt && <span className="dico-panel-task-detail">Para {fechaCorta(metadata.dueAt)}</span>}
        {metadata.gerencial && <span className="dico-panel-task-manager-mark">Orden gerencial</span>}
        {metadata.rejectionReason && <span className="dico-panel-task-detail">Motivo: {metadata.rejectionReason}</span>}
        {metadata.evidenceName && <span className="dico-panel-task-detail">Evidencia: {metadata.evidenceName}</span>}
      </div>
      <div className="dico-panel-decision-side">
        <span className="dico-panel-severity"><i />{item.gravedad || 'baja'}</span>
        <div className="dico-panel-decision-actions">
          {item.tab && <button type="button" className="dico-panel-button dico-panel-button--primary" onClick={() => onIr?.(item.tab)}>{item.accion || 'Ver pantalla'}</button>}
        </div>
      </div>
      <div className="dico-panel-task-workflow">
        {recibida && estado === 'asignada' && <div className="dico-panel-task-actions">
          <button type="button" className="dico-panel-button dico-panel-button--primary" onClick={() => onActualizar(item.id, 'aceptada', { acceptedAt: new Date().toISOString() })}>Aceptar</button>
          {!motivo ? <button type="button" className="dico-panel-button" onClick={() => setMotivo(' ')}>Rechazar</button> : <div className="dico-panel-reject-row">
            <input value={motivo.trim()} onChange={event => setMotivo(event.target.value)} placeholder="Motivo obligatorio" aria-label="Motivo del rechazo" autoFocus />
            <button type="button" className="dico-panel-button" disabled={!motivo.trim()} onClick={() => { onActualizar(item.id, 'rechazada', { rejectionReason: motivo.trim(), rejectedAt: new Date().toISOString() }); setMotivo(''); }}>Confirmar</button>
          </div>}
        </div>}
        {recibida && estado === 'aceptada' && <div className="dico-panel-task-actions">
          <button type="button" className="dico-panel-button dico-panel-button--primary" onClick={() => onActualizar(item.id, 'terminada', { completedAt: new Date().toISOString() })}>Marcar terminada</button>
          <label className="dico-panel-button dico-panel-button--quiet">Adjuntar evidencia<input type="file" accept="image/*" onChange={event => onActualizar(item.id, 'terminada', { completedAt: new Date().toISOString(), evidenceName: event.target.files?.[0]?.name || null })} /></label>
        </div>}
        {propia && puedeEvaluar && estado === 'terminada' && <div className="dico-panel-task-actions dico-panel-task-evaluation">
          <input value={comentario} onChange={event => setComentario(event.target.value)} placeholder="Comentario opcional" aria-label="Comentario de evaluación" />
          {['mal', 'regular', 'bien'].map(valor => <button type="button" key={valor} className="dico-panel-button" onClick={() => onActualizar(item.id, 'evaluada', { evaluation: valor, evaluationComment: comentario, evaluatedAt: new Date().toISOString() })}>{valor}</button>)}
        </div>}
      </div>
    </article>
  );
}

export default function DicoTareasAsignadas({ roles = [], currentUserId = null, onIr }) {
  const [decisiones, setDecisiones] = useState(() => leerJson(CLAVE_DECISIONES, {}));
  const [tareasMeta, setTareasMeta] = useState(() => leerJson(CLAVE_TAREAS, {}));
  const [vista, setVista] = useState('recibidas');

  const tareas = useMemo(() => tareaOrdenada(decisiones, tareasMeta, currentUserId, vista), [decisiones, tareasMeta, currentUserId, vista]);
  const recibidas = useMemo(() => tareaOrdenada(decisiones, tareasMeta, currentUserId, 'recibidas'), [decisiones, tareasMeta, currentUserId]);
  const propias = useMemo(() => tareaOrdenada(decisiones, tareasMeta, currentUserId, 'propias'), [decisiones, tareasMeta, currentUserId]);
  const puedeEvaluar = !roles.length || roles.some(rol => ['owner', 'manager'].includes(rol));
  const actualizar = (id, workflowStatus, extra = {}) => {
    const siguiente = { ...tareasMeta, [id]: { ...tareasMeta[id], workflowStatus, ...extra } };
    setTareasMeta(siguiente);
    try { localStorage.setItem(CLAVE_TAREAS, JSON.stringify(siguiente)); } catch { /* sin storage */ }
  };

  return (
    <section className="dico-panel-team-tasks" aria-labelledby="dico-equipo-tareas-titulo">
      <div className="dico-panel-team-tasks-heading">
        <div>
          <span className="dico-panel-kicker">Equipo</span>
          <h2 id="dico-equipo-tareas-titulo">Tareas asignadas</h2>
        </div>
        <span className="dico-panel-team-tasks-count">{recibidas.length} recibidas · {propias.length} asignadas por vos</span>
      </div>
      <div className="dico-panel-task-tabs" role="tablist" aria-label="Vistas de tareas asignadas">
        <button type="button" role="tab" aria-selected={vista === 'recibidas'} className={vista === 'recibidas' ? 'active' : ''} onClick={() => setVista('recibidas')}>Me asignaron ({recibidas.length})</button>
        <button type="button" role="tab" aria-selected={vista === 'propias'} className={vista === 'propias' ? 'active' : ''} onClick={() => setVista('propias')}>Asignadas por mí ({propias.length})</button>
      </div>
      {tareas.length ? <div className="dico-panel-list">{tareas.map(item => <TareaAsignada key={item.id} item={item} vista={vista} onActualizar={actualizar} onIr={onIr} puedeEvaluar={puedeEvaluar} />)}</div> : <p className="dico-panel-empty">No hay tareas en esta vista.</p>}
    </section>
  );
}
