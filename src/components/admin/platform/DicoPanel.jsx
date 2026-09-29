import { useEffect, useMemo, useRef, useState } from 'react';
import DicoPhysical from '../../dico/DicoPhysical';
import useDicoPetMotion from '../../dico/useDicoPetMotion';
import { avisosDe } from '../../../modules/dico/reglas';
import { oportunidadesDe } from '../../../modules/dico/oportunidades';

const CLAVE_DECISIONES = 'dico:centro-decisiones:v1';
const CLAVE_CHAT = 'dico:sala-control:chat:v1';
const CLAVE_CONVERSACIONES = 'dico:sala-control:conversaciones:v1';
const CLAVE_TAREAS = 'dico:sala-control:tareas:v1';
const RUTINA_PANEL = ['respirar', 'pensar'];

function leerDecisiones() {
  try { return JSON.parse(localStorage.getItem(CLAVE_DECISIONES) || '{}'); } catch { return {}; }
}

function guardarDecisiones(value) {
  try { localStorage.setItem(CLAVE_DECISIONES, JSON.stringify(value)); } catch { /* sin storage */ }
}

function leerTareas() {
  try {
    const valor = JSON.parse(localStorage.getItem(CLAVE_TAREAS) || '{}');
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
  } catch { return {}; }
}

function guardarTareas(value) {
  try { localStorage.setItem(CLAVE_TAREAS, JSON.stringify(value)); } catch { /* sin storage */ }
}

function leerMensajes() {
  try {
    const valor = JSON.parse(localStorage.getItem(CLAVE_CHAT) || '[]');
    return Array.isArray(valor) ? valor.filter(item => item?.rol && item?.texto) : [];
  } catch { return []; }
}

function guardarMensajes(value) {
  try { localStorage.setItem(CLAVE_CHAT, JSON.stringify(value)); } catch { /* sin storage */ }
}

function leerConversaciones() {
  try {
    const valor = JSON.parse(localStorage.getItem(CLAVE_CONVERSACIONES) || '[]');
    return Array.isArray(valor) ? valor.filter(item => item?.id && Array.isArray(item.messages)).slice(0, 5) : [];
  } catch { return []; }
}

function guardarConversaciones(value) {
  try { localStorage.setItem(CLAVE_CONVERSACIONES, JSON.stringify(value.slice(0, 5))); } catch { /* sin storage */ }
}

function idDeConversacion(prefijo = 'chat') {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function tituloDeConversacion(mensajes) {
  const primerMensaje = mensajes.find(mensaje => mensaje.rol === 'usuario')?.texto?.trim();
  if (!primerMensaje) return 'Nueva conversación';
  return primerMensaje.length > 28 ? `${primerMensaje.slice(0, 28)}…` : primerMensaje;
}

const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 };

function ordenarPorPrioridad(items) {
  return [...items].sort((a, b) => (ORDEN_PRIORIDAD[a.gravedad] ?? 3) - (ORDEN_PRIORIDAD[b.gravedad] ?? 3));
}

function mananaIso() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  return fecha.toISOString();
}

function fechaCorta(fecha) {
  if (!fecha) return '';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(new Date(fecha));
}

function nivelDe(nivel) {
  return nivel === 'alerta' ? 'alta' : nivel === 'aviso' ? 'media' : 'baja';
}

function zonaDe(item) {
  if (item.zona) return item.zona;
  const tab = String(item.tab || '').toLocaleLowerCase('es-AR');
  if (tab === 'stock') return 'Stock';
  if (tab === 'finanzas') return 'Compras y gastos';
  if (tab === 'crm') return 'Clientes';
  if (tab === 'mesas') return 'Salón';
  if (tab === 'caja') return 'Caja';
  if (tab === 'products') return 'Catálogo';
  return item.origen === 'intervencion' ? 'Operación' : 'Oportunidad';
}

function recomendacionesDe(datos, historial = []) {
  const avisos = avisosDe(datos).map(aviso => ({
    id: `aviso:${aviso.id}`,
    origen: 'aviso',
    gravedad: nivelDe(aviso.nivel),
    titulo: aviso.titulo,
    recomendacion: aviso.detalle,
    accion: aviso.ir?.texto,
    tab: aviso.ir?.tab,
  }));
  const oportunidades = oportunidadesDe(datos).map(oportunidad => ({
    id: `oportunidad:${oportunidad.id}`,
    origen: 'oportunidad',
    gravedad: 'baja',
    titulo: oportunidad.titulo,
    recomendacion: `${oportunidad.porque} ${oportunidad.hacer}`,
    accion: oportunidad.ir?.texto,
    tab: oportunidad.ir?.tab,
  }));
  const archivadas = historial.map(item => ({
    ...item,
    origen: 'intervencion',
    gravedad: item.gravedad || 'media',
    accion: item.cta?.texto,
  }));
  const porId = new Map();
  [...avisos, ...oportunidades, ...archivadas].forEach(item => porId.set(item.id, item));
  return [...porId.values()];
}

function Chevron({ abierto }) {
  return <i className={`dico-panel-chevron${abierto ? ' dico-panel-chevron--abierto' : ''}`} aria-hidden="true" />;
}

function PaperclipIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 12.5 6.2-6.2a3.2 3.2 0 0 1 4.5 4.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l7.5-7.5a2.8 2.8 0 0 1 4 4l-7.2 7.2a1.5 1.5 0 0 1-2.1-2.1l6.6-6.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
}

function UserPlusIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M3.8 19c.5-3 2.2-4.6 5.2-4.6 2.1 0 3.7.8 4.6 2.4M17 8v6m-3-3h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="m9 9 6 6m0-6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
}

function CameraIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5 9 5h6l1.5 2.5H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>;
}

function MicIcon({ activo = false }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.5" width="6" height="11" rx="3" fill={activo ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-3 0h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
}

function MoreIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="19" r="1.5" fill="currentColor" /></svg>;
}

function MensajeChat({ mensaje }) {
  const esDico = mensaje.rol === 'dico';
  return (
    <div className={`dico-panel-chat-message dico-panel-chat-message--${esDico ? 'dico' : 'usuario'}`}>
      <p>{mensaje.texto}</p>
    </div>
  );
}

function respuestaPara(pregunta, activas, adjuntos) {
  const limpia = pregunta.trim().toLocaleLowerCase('es-AR').replace(/[¡!¿?.,]/g, '').trim();
  if (limpia === 'hola') {
    return '¡Hola! Soy Dico. Estoy listo para ayudarte a ordenar lo que necesites en tu operación.';
  }
  const contexto = adjuntos.length
    ? ` Revisemos también ${adjuntos.map(adjunto => adjunto.name).join(', ')}.`
    : '';
  return `Puedo ayudarte a resolverlo desde esta pantalla. Para empezar, revisemos ${activas[0]?.titulo?.toLocaleLowerCase('es-AR') || 'las decisiones pendientes'}.${contexto}`;
}

function DecisionCard({
  item,
  estado,
  metadata = {},
  onDecision,
  onIr,
  menuAbierto,
  onMenu,
  asignando = false,
  usuariosAsignables = [],
  usuarioSeleccionado = '',
  onSeleccionarUsuario,
  onAsignarConfirmar,
  onPosponer,
  puedeAsignar = false,
  puedePosponer = false,
}) {
  const archivada = ['descartado', 'resuelto'].includes(estado);
  const esAlta = item.gravedad === 'alta';
  return (
    <article className={`dico-panel-decision dico-panel-decision--${item.gravedad}${archivada ? ' dico-panel-decision--archivada' : ''}`}>
      <div className="dico-panel-decision-copy">
        <div className="dico-panel-decision-meta">
          <span className="dico-panel-decision-zone">{zonaDe(item)}</span>
        </div>
        <h3>{item.titulo}</h3>
        <p>{item.recomendacion}</p>
        {metadata.assignedByName && <span className="dico-panel-task-detail">Asignada por {metadata.assignedByName}{metadata.assignedAt ? ` · ${new Date(metadata.assignedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>}
        {metadata.dueAt && <span className="dico-panel-task-detail">Para {fechaCorta(metadata.dueAt)}</span>}
        {metadata.gerencial && <span className="dico-panel-task-manager-mark">Orden gerencial</span>}
        {metadata.rejectionReason && <span className="dico-panel-task-detail">Motivo: {metadata.rejectionReason}</span>}
        {metadata.evidenceName && <span className="dico-panel-task-detail">Evidencia: {metadata.evidenceName}</span>}
      </div>
      {!archivada && (
        <div className="dico-panel-decision-side">
          <span className="dico-panel-severity"><i />{item.gravedad}</span>
          <div className="dico-panel-decision-actions">
            {item.tab && (
              <button type="button" className="dico-panel-button dico-panel-button--primary" onClick={() => onIr?.(item.tab)}>
                {item.accion || 'Ver pantalla'}
              </button>
            )}
            <div className="dico-panel-decision-menu-wrap">
              <button type="button" className="dico-panel-button dico-panel-action-menu" onClick={() => onMenu?.(menuAbierto ? null : item.id)} aria-label={`Más acciones: ${item.titulo}`} aria-expanded={menuAbierto} title="Más acciones"><MoreIcon /></button>
              {menuAbierto && <div className="dico-panel-decision-menu" role="menu">
                {puedeAsignar && <button type="button" role="menuitem" onClick={() => onMenu?.(`asignar:${item.id}`)}><UserPlusIcon />Asignar</button>}
                <button type="button" role="menuitem" onClick={() => onDecision(item.id, 'descartado')}><CloseIcon />Descartar</button>
                <button type="button" role="menuitem" disabled={!puedePosponer || esAlta} title={esAlta ? 'Las prioridades altas no se pueden posponer' : undefined} onClick={() => onPosponer?.(item.id)}><ClockIcon />Posponer</button>
              </div>}
            </div>
          </div>
          {asignando && <div className="dico-panel-assignment-picker" role="group" aria-label={`Asignar ${item.titulo}`}>
            <select value={usuarioSeleccionado} onChange={event => onSeleccionarUsuario?.(event.target.value)} aria-label="Seleccionar usuario">
              <option value="">Seleccionar persona…</option>
              {usuariosAsignables.map(usuario => <option key={usuario.id} value={usuario.id}>{usuario.name} · {usuario.position}</option>)}
            </select>
            <button type="button" className="dico-panel-button dico-panel-button--primary" disabled={!usuarioSeleccionado} onClick={() => onAsignarConfirmar?.(item.id)}>Confirmar</button>
          </div>}
        </div>
      )}
    </article>
  );
}

export default function DicoPanel({
  productos = [],
  ventas = [],
  pedidos = [],
  clientes = [],
  utilizacion = [],
  esperaPerdida = [],
  gastos = [],
  settings = {},
  turno = null,
  listo = true,
  vertical,
  historial = [],
  intervencionActiva = null,
  personal = [],
  roles = [],
  currentUserId = null,
  currentUserName = 'Vos',
  onIr,
}) {
  const [decisiones, setDecisiones] = useState(leerDecisiones);
  const [tareasMeta, setTareasMeta] = useState(leerTareas);
  const [pendientesAbiertos, setPendientesAbiertos] = useState(true);
  const [menuTareaAbierta, setMenuTareaAbierta] = useState(null);
  const [asignandoId, setAsignandoId] = useState(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('');
  const [pregunta, setPregunta] = useState('');
  const [mensajes, setMensajes] = useState(() => []);
  const [conversaciones, setConversaciones] = useState(leerConversaciones);
  const [idConversacion, setIdConversacion] = useState(() => idDeConversacion());
  const [chat, setChat] = useState(null);
  const [adjuntos, setAdjuntos] = useState([]);
  const [dicoHover, setDicoHover] = useState(false);
  const [dicoEnRespuesta, setDicoEnRespuesta] = useState(false);
  const [respondiendo, setRespondiendo] = useState(false);
  const [avisoChat, setAvisoChat] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const archivoInputRef = useRef(null);
  const imagenInputRef = useRef(null);
  const respuestaTimerRef = useRef(null);
  const reconocimientoRef = useRef(null);
  const mensajesRef = useRef(mensajes);
  const idConversacionRef = useRef(idConversacion);
  const movimiento = useDicoPetMotion({ pose: 'idle', enabled: !intervencionActiva, rutina: RUTINA_PANEL, repetir: false });

  useEffect(() => guardarDecisiones(decisiones), [decisiones]);
  useEffect(() => guardarTareas(tareasMeta), [tareasMeta]);
  useEffect(() => {
    const anteriores = leerMensajes();
    if (!anteriores.length) return;
    setConversaciones(previas => [{
      id: idConversacionRef.current,
      title: tituloDeConversacion(anteriores),
      messages: anteriores,
      updatedAt: Date.now(),
    }, ...previas].slice(0, 5));
    try { localStorage.removeItem(CLAVE_CHAT); } catch { /* sin storage */ }
  }, []);
  useEffect(() => guardarMensajes(mensajes), [mensajes]);
  useEffect(() => guardarConversaciones(conversaciones), [conversaciones]);
  useEffect(() => { mensajesRef.current = mensajes; }, [mensajes]);
  useEffect(() => { idConversacionRef.current = idConversacion; }, [idConversacion]);

  useEffect(() => () => {
    if (respuestaTimerRef.current) clearInterval(respuestaTimerRef.current);
    reconocimientoRef.current?.stop?.();
    const actuales = mensajesRef.current;
    if (actuales.length) {
      const previas = leerConversaciones();
      guardarConversaciones([{
        id: idConversacionRef.current,
        title: tituloDeConversacion(actuales),
        messages: actuales,
        updatedAt: Date.now(),
      }, ...previas.filter(item => item.id !== idConversacionRef.current)]);
    }
    try { localStorage.removeItem(CLAVE_CHAT); } catch { /* sin storage */ }
  }, []);

  const datos = useMemo(() => ({
    productos,
    ventas,
    pedidos,
    clientes,
    utilizacion,
    esperaPerdida,
    gastos,
    settings: settings || {},
    turno,
    listo,
    vertical,
    hoy: new Date(),
  }), [productos, ventas, pedidos, clientes, utilizacion, esperaPerdida, gastos, settings, turno, listo, vertical]);

  const recomendaciones = useMemo(
    () => recomendacionesDe(datos, historial), [datos, historial]
  );
  const estados = useMemo(() => recomendaciones.reduce((acc, item) => {
    acc[item.id] = decisiones[item.id] || item.estado || 'pendiente';
    return acc;
  }, {}), [recomendaciones, decisiones]);
  const activas = recomendaciones.filter(item => !['descartado', 'resuelto'].includes(estados[item.id]));
  const tareasPendientes = useMemo(() => ordenarPorPrioridad(
    activas.filter(item => estados[item.id] !== 'tarea')
  ), [activas, estados]);
  useEffect(() => {
    const faltantes = recomendaciones.filter(item => decisiones[item.id] === 'tarea' && !tareasMeta[item.id]?.item);
    if (!faltantes.length) return;
    setTareasMeta(previas => {
      const siguiente = { ...previas };
      faltantes.forEach(item => {
        siguiente[item.id] = {
          ...siguiente[item.id],
          item: {
            id: item.id,
            titulo: item.titulo,
            recomendacion: item.recomendacion,
            gravedad: item.gravedad,
            zona: zonaDe(item),
            accion: item.accion,
            tab: item.tab,
          },
        };
      });
      return siguiente;
    });
  }, [recomendaciones, decisiones, tareasMeta]);
  const personas = useMemo(() => personal
    .map(persona => ({
      id: persona.user_id || persona.id,
      name: persona.name || persona.full_name || persona.email || 'Sin nombre',
      position: persona.job || persona.position || persona.role || 'Empleado',
      roles: persona.roles || (persona.role ? [persona.role] : []),
      supervisorId: persona.supervisor_id || null,
    }))
    .filter(persona => persona.id), [personal]);
  const puedeAsignar = !roles.length || roles.some(rol => ['owner', 'manager'].includes(rol));
  const puedePosponer = !roles.length || roles.some(rol => ['owner', 'manager'].includes(rol));
  const esDuenio = !roles.length || roles.includes('owner');
  const usuariosAsignables = useMemo(() => personas.filter(persona => {
    if (persona.id === currentUserId) return false;
    if (esDuenio) return true;
    const puesto = String(persona.position).toLocaleLowerCase('es-AR');
    const esGerencial = persona.roles.some(rol => ['owner', 'manager'].includes(rol))
      || /dueñ|duen|gerent|encargad|jef/.test(puesto);
    return !esGerencial;
  }), [personas, currentUserId, esDuenio]);
  const limpiarAccionesTarea = () => {
    setMenuTareaAbierta(null);
    setAsignandoId(null);
    setUsuarioSeleccionado('');
  };
  const decidir = (id, estado) => {
    setDecisiones(prev => ({ ...prev, [id]: estado }));
    limpiarAccionesTarea();
  };
  const abrirMenuTarea = (valor) => {
    if (typeof valor === 'string' && valor.startsWith('asignar:')) {
      setAsignandoId(valor.slice('asignar:'.length));
      setUsuarioSeleccionado('');
      setMenuTareaAbierta(null);
      return;
    }
    setMenuTareaAbierta(valor);
    setAsignandoId(null);
  };
  const asignarTarea = (id) => {
    const persona = usuariosAsignables.find(usuario => usuario.id === usuarioSeleccionado);
    const item = recomendaciones.find(recomendacion => recomendacion.id === id);
    if (!persona || !item) return;
    setDecisiones(prev => ({ ...prev, [id]: 'tarea' }));
    setTareasMeta(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        item: {
          id: item.id,
          titulo: item.titulo,
          recomendacion: item.recomendacion,
          gravedad: item.gravedad,
          zona: zonaDe(item),
          accion: item.accion,
          tab: item.tab,
        },
        assignedBy: currentUserId,
        assignedByName: currentUserName,
        assignedTo: persona.id,
        assignedToName: persona.name,
        assignedToPosition: persona.position,
        directSupervisorId: persona.supervisorId,
        directSupervisorName: personas.find(usuario => usuario.id === persona.supervisorId)?.name || null,
        assignedAt: new Date().toISOString(),
        workflowStatus: 'asignada',
        gerencial: esDuenio,
      },
    }));
    limpiarAccionesTarea();
  };
  const posponerTarea = (id) => {
    const item = recomendaciones.find(recomendacion => recomendacion.id === id);
    if (!item || item.gravedad === 'alta' || !puedePosponer) return;
    setDecisiones(prev => ({ ...prev, [id]: 'pospuesto' }));
    setTareasMeta(prev => ({ ...prev, [id]: { ...prev[id], dueAt: mananaIso() } }));
    limpiarAccionesTarea();
  };
  const detenerRespuesta = () => {
    if (respuestaTimerRef.current) clearInterval(respuestaTimerRef.current);
    respuestaTimerRef.current = null;
    setDicoEnRespuesta(false);
    setRespondiendo(false);
    setChat(null);
  };

  const iniciarNuevaAccion = () => {
    detenerRespuesta();
    if (mensajes.length) {
      setConversaciones(previas => [{
        id: idConversacion,
        title: tituloDeConversacion(mensajes),
        messages: mensajes,
        updatedAt: Date.now(),
      }, ...previas].slice(0, 5));
    }
    setMensajes([]);
    setIdConversacion(idDeConversacion());
    setPregunta('');
    setAdjuntos([]);
    setAvisoChat('');
    setMenuAbierto(false);
    setHistorialAbierto(false);
  };

  const cargarConversacion = (conversacion) => {
    if (conversacion.id === idConversacion) return;
    if (mensajes.length) {
      setConversaciones(previas => [{
        id: idConversacion,
        title: tituloDeConversacion(mensajes),
        messages: mensajes,
        updatedAt: Date.now(),
      }, ...previas.filter(item => item.id !== idConversacion)].slice(0, 5));
    }
    detenerRespuesta();
    setMensajes(conversacion.messages);
    setIdConversacion(conversacion.id);
    setPregunta('');
    setAdjuntos([]);
    setAvisoChat('');
    setHistorialAbierto(false);
  };

  const eliminarConversacion = (id) => {
    setConversaciones(previas => previas.filter(item => item.id !== id));
    setAvisoChat('');
  };

  const escucharPregunta = () => {
    const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Reconocimiento) {
      setAvisoChat('La entrada por voz todavía no está disponible en este navegador.');
      return;
    }
    if (escuchando) {
      reconocimientoRef.current?.stop?.();
      return;
    }
    const reconocimiento = new Reconocimiento();
    reconocimiento.lang = 'es-AR';
    reconocimiento.interimResults = false;
    reconocimiento.onresult = event => {
      const texto = event.results?.[0]?.[0]?.transcript || '';
      setPregunta(previa => `${previa} ${texto}`.trim());
    };
    reconocimiento.onerror = () => {
      setAvisoChat('No pude escuchar la consulta. Probá de nuevo.');
      setEscuchando(false);
    };
    reconocimiento.onend = () => {
      reconocimientoRef.current = null;
      setEscuchando(false);
    };
    reconocimientoRef.current = reconocimiento;
    setAvisoChat('');
    setEscuchando(true);
    reconocimiento.start();
  };

  const escribirRespuesta = (texto) => {
    if (respuestaTimerRef.current) clearInterval(respuestaTimerRef.current);
    setDicoEnRespuesta(true);
    setRespondiendo(true);
    setChat('');
    const respuestaId = `dico-${Date.now()}`;

    let indice = 0;
    const paso = 1;
    respuestaTimerRef.current = setInterval(() => {
      indice += paso;
      setChat(texto.slice(0, indice));
      if (indice >= texto.length) {
        clearInterval(respuestaTimerRef.current);
        respuestaTimerRef.current = null;
        setRespondiendo(false);
        setMensajes(previos => [...previos, { id: respuestaId, rol: 'dico', texto }]);
        setChat(null);
        setDicoEnRespuesta(false);
      }
    }, 30);
  };

  const responder = (event) => {
    event.preventDefault();
    if (!pregunta.trim() && !adjuntos.length) return;
    setAvisoChat('');
    const textoUsuario = pregunta.trim() || `Compartí ${adjuntos.map(adjunto => adjunto.name).join(', ')}.`;
    const mensajeUsuario = { id: `usuario-${Date.now()}`, rol: 'usuario', texto: textoUsuario };
    setMensajes(previos => [...previos, mensajeUsuario]);
    escribirRespuesta(respuestaPara(pregunta, activas, adjuntos));
    setPregunta('');
    setAdjuntos([]);
  };

  const seleccionarAdjuntos = (event) => {
    const seleccionados = Array.from(event.target.files || []);
    if (!seleccionados.length) return;
    setAdjuntos(previos => [...previos, ...seleccionados].slice(-4));
    event.target.value = '';
  };

  const quitarAdjunto = (archivo) => {
    setAdjuntos(previos => previos.filter(item => item.name !== archivo.name || item.size !== archivo.size));
  };

  const dicoEnBarra = mensajes.length > 0 || dicoEnRespuesta;
  const poseDicoEnBarra = intervencionActiva?.pose || (dicoEnRespuesta && respondiendo ? 'thinking' : 'idle');

  return (
    <section className="dico-panel cp-root" aria-labelledby="dico-panel-titulo">
      <div className="dico-panel-title-row">
      <div>
          <span className="dico-panel-kicker">Dico</span>
          <div className="dico-panel-title-line"><h1 id="dico-panel-titulo">Habla con Dico</h1></div>
          <i className="dico-panel-title-rule" />
        </div>
      </div>

      <div className="dico-panel-grid">
        <div className="dico-panel-main-column">
          <section className="dico-panel-chat" aria-label="Hablar con Dico">
            {mensajes.length > 0 && (
              <div className="dico-panel-chat-history" aria-label="Historial de conversación">
                {mensajes.map(mensaje => <MensajeChat key={mensaje.id} mensaje={mensaje} />)}
              </div>
            )}
            {!mensajes.length && !dicoEnRespuesta && <div className="dico-panel-chat-welcome">
              <div
                className="dico-panel-chat-pet"
                onMouseEnter={() => setDicoHover(true)}
                onMouseLeave={() => setDicoHover(false)}
                onFocus={() => setDicoHover(true)}
                onBlur={() => setDicoHover(false)}
              >
                <DicoPhysical pose={intervencionActiva?.pose || (dicoHover ? 'explain' : movimiento.pose)} title="Dico" />
              </div>
              {!dicoEnRespuesta && <strong>¿En qué te puedo ayudar?</strong>}
            </div>}
            {dicoEnRespuesta && <div className="dico-panel-chat-response" aria-live="polite"><p>{chat}{respondiendo && <span className="dico-panel-chat-cursor" aria-hidden="true">▌</span>}</p></div>}
            {adjuntos.length > 0 && <div className="dico-panel-chat-attachments" aria-label="Archivos seleccionados">{adjuntos.map(adjunto => <button type="button" key={`${adjunto.name}:${adjunto.size}`} onClick={() => quitarAdjunto(adjunto)} title={`Quitar ${adjunto.name}`}>{adjunto.name}<span aria-hidden="true">×</span></button>)}</div>}
            <form className="dico-panel-chat-form" onSubmit={responder}>
              <button type="button" className="dico-panel-chat-menu-toggle" onClick={() => setMenuAbierto(value => !value)} aria-label="Abrir herramientas del chat" aria-expanded={menuAbierto} title="Herramientas del chat">＋</button>
              {menuAbierto && <div className="dico-panel-chat-menu" role="menu">
                <button type="button" className="dico-panel-chat-menu-item" onClick={() => { archivoInputRef.current?.click(); setMenuAbierto(false); }} role="menuitem"><PaperclipIcon /> <span>Subir archivos</span></button>
                <button type="button" className="dico-panel-chat-menu-item" onClick={() => { imagenInputRef.current?.click(); setMenuAbierto(false); }} role="menuitem"><CameraIcon /> <span>Abrir cámara</span></button>
                <button type="button" className="dico-panel-chat-menu-item" onClick={iniciarNuevaAccion} role="menuitem"><span className="dico-panel-chat-menu-plus" aria-hidden="true">＋</span> <span>Nuevo chat</span></button>
              </div>}
              <input ref={archivoInputRef} className="dico-panel-chat-file-input" type="file" multiple onChange={seleccionarAdjuntos} tabIndex={-1} aria-hidden="true" />
              <input ref={imagenInputRef} className="dico-panel-chat-file-input" type="file" accept="image/*" capture="environment" multiple onChange={seleccionarAdjuntos} tabIndex={-1} aria-hidden="true" />
              <input value={pregunta} onChange={event => setPregunta(event.target.value)} placeholder="Escribí tu pregunta…" aria-label="Preguntarle a Dico" />
              <button type="button" className={`dico-panel-chat-voice${escuchando ? ' dico-panel-chat-voice--activo' : ''}`} onClick={escucharPregunta} aria-label={escuchando ? 'Detener escucha' : 'Hablarle a Dico'} title={escuchando ? 'Detener escucha' : 'Hablarle a Dico'}><MicIcon activo={escuchando} /></button>
              <button
                type="submit"
                className={`dico-panel-chat-submit${dicoEnBarra ? ' dico-panel-chat-submit--dico' : ''}${dicoEnRespuesta && respondiendo ? ' dico-panel-chat-submit--pensando' : ''}`}
                aria-label="Enviar pregunta"
              >
                {dicoEnBarra ? <DicoPhysical pose={poseDicoEnBarra} title="Dico" /> : '↑'}
              </button>
            </form>
            {avisoChat && <p className="dico-panel-chat-notice" role="alert">{avisoChat}</p>}
            {conversaciones.length > 0 && (
              <div className="dico-panel-chat-history-wrap">
                <button
                  type="button"
                  className="dico-panel-chat-history-toggle"
                  onClick={() => setHistorialAbierto(value => !value)}
                  aria-expanded={historialAbierto}
                  aria-controls="dico-panel-chat-history-list"
                >
                  <span>Historial de chats</span>
                  <span className="dico-panel-chat-history-count">{conversaciones.length}/5</span>
                </button>
                {historialAbierto && <div id="dico-panel-chat-history-list" className="dico-panel-chat-history-popover" role="dialog" aria-label="Historial de chats">
                  <div className="dico-panel-chat-archive-list">
                    {conversaciones.map(conversacion => (
                      <div className="dico-panel-chat-archive" key={conversacion.id}>
                        <button type="button" className="dico-panel-chat-archive-open" onClick={() => cargarConversacion(conversacion)} title={`Abrir ${conversacion.title}`}>{conversacion.title}</button>
                        <button type="button" className="dico-panel-chat-archive-delete" onClick={() => eliminarConversacion(conversacion.id)} aria-label={`Eliminar ${conversacion.title}`} title="Eliminar conversación">×</button>
                      </div>
                    ))}
                  </div>
                </div>
                }
              </div>
            )}
          </section>

        </div>

        <aside className="dico-panel-side-column">
          <section className="dico-panel-accordion">
            <button type="button" className="dico-panel-accordion-head" onClick={() => setPendientesAbiertos(value => !value)}><strong>Análisis Dico</strong><span>{activas.length} vigentes</span><Chevron abierto={pendientesAbiertos} /></button>
            {pendientesAbiertos && <div className="dico-panel-list">{!tareasPendientes.length ? <p className="dico-panel-empty">{activas.length ? 'No hay tareas con esta prioridad.' : 'No hay avisos pendientes de decidir.'}</p> : tareasPendientes.slice(0, 6).map(item => <DecisionCard
              key={item.id}
              item={item}
              estado={estados[item.id]}
              metadata={tareasMeta[item.id]}
              onDecision={decidir}
              onIr={onIr}
              menuAbierto={menuTareaAbierta === item.id}
              onMenu={abrirMenuTarea}
              asignando={asignandoId === item.id}
              usuariosAsignables={usuariosAsignables}
              usuarioSeleccionado={usuarioSeleccionado}
              onSeleccionarUsuario={setUsuarioSeleccionado}
              onAsignarConfirmar={asignarTarea}
              onPosponer={posponerTarea}
              puedeAsignar={puedeAsignar}
              puedePosponer={puedePosponer}
            />)}</div>}
          </section>

        </aside>
      </div>
    </section>
  );
}

export { recomendacionesDe };
