import { useEffect, useRef, useState } from 'react';
import DicoPhysical from '../dico/DicoPhysical';
import { PREGUNTAS_DICO, TEMAS_DICO, buscarPreguntas } from '../../lib/preguntasPlataforma';
import { WHATSAPP_URL, WHATSAPP_HORARIO } from '../../lib/contactoPlataforma';
import { marcarEvento } from '../../lib/analiticaPlataforma';
import '../../styles/preguntas-negocio.css';

const RAPIDAS = [['precio', '¿Cuánto cuesta?'], ['diagnostico', '¿Cómo empiezo?'], ['importar', '¿Puedo traer mis datos?'], ['rubro', '¿Sirve para mi rubro?']];
const flecha = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;

function EnlaceRespuesta({ pregunta, onDiagnostico }) {
  if (pregunta.enlace === 'diagnostico') return <button type="button" className="pn-enlace-respuesta" onClick={onDiagnostico}>Empezar mi diagnóstico {flecha}</button>;
  if (pregunta.enlace === 'precios') return <a className="pn-enlace-respuesta" href="#precios">Comparar planes {flecha}</a>;
  if (pregunta.enlace === 'rubros') return <a className="pn-enlace-respuesta" href="#rubros">Ver el alcance por rubro {flecha}</a>;
  if (pregunta.enlace === 'legales') return <a className="pn-enlace-respuesta" href="mailto:hola@divianco.app?subject=Condiciones%20y%20privacidad%20de%20Dico">Consultar por email {flecha}</a>;
  return null;
}

function Whatsapp({ children }) {
  return <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => marcarEvento('whatsapp')}>{children} <span aria-hidden="true">↗</span></a>;
}

export default function PreguntasNegocio({ onDiagnostico }) {
  const [historial, setHistorial] = useState([]);
  const [tema, setTema] = useState(null);
  const [consulta, setConsulta] = useState('');
  const [buscado, setBuscado] = useState(false);
  const [todas, setTodas] = useState(false);
  const registro = useRef(null);
  const respuesta = useRef(null);
  const abierto = historial.length > 0 || tema !== null;
  const ultimo = historial.at(-1);
  const buscando = consulta.trim().length >= 2 || buscado;
  const resultados = buscando ? buscarPreguntas(consulta) : [];
  const delTema = PREGUNTAS_DICO.filter(p => p.tema === tema);
  const sugeridas = ultimo ? PREGUNTAS_DICO.filter(p => p.tema === ultimo.tema && p.id !== ultimo.id).slice(0, 2) : [];

  useEffect(() => {
    if (!historial.length) return;
    registro.current.scrollTop = registro.current.scrollHeight;
    respuesta.current?.focus({ preventScroll: true });
  }, [historial]);

  const preguntar = pregunta => {
    setHistorial(actual => [...actual, pregunta].slice(-3));
    setConsulta('');
    setBuscado(false);
    setTema(null);
  };
  return (
    <section className="pn-root" id="preguntas" aria-labelledby="pn-titulo">
      <span className="pl-ancla" id="seguridad" aria-hidden="true" />
      <div className="pn-dentro">
        <h2 id="pn-titulo">Sacate la duda. Preguntale a Dico.</h2>
        <p className="pn-intro">Elegí una pregunta o buscá entre las respuestas.</p>
        <div className={`pn-guia${abierto ? ' pn-abierta' : ''}`}>
          <header className="pn-saludo">
            <div className="pn-mascota" aria-hidden="true"><DicoPhysical pose={abierto ? 'explain' : 'idle'} reducedMotion /></div>
            <div><h3>{abierto ? 'Dico' : '¿En qué te puedo ayudar?'}</h3>{abierto && <p>Guía para empezar</p>}</div>
            {abierto && <span className="pn-preparadas">Preguntas y respuestas</span>}
          </header>
          {!abierto && <div className="pn-rapidas">{RAPIDAS.map(([id, titulo]) => <button type="button" key={id} onClick={() => preguntar(PREGUNTAS_DICO.find(p => p.id === id))}>{titulo}{flecha}</button>)}</div>}
          {abierto && <div className="pn-temas" role="group" aria-label="Temas de preguntas">{TEMAS_DICO.map(item => <button type="button" key={item.id} aria-pressed={tema === item.id} onClick={() => { setTema(tema === item.id ? null : item.id); setConsulta(''); setBuscado(false); }}>{item.nombre}</button>)}</div>}
          {tema && <div className="pn-opciones" aria-label={`Preguntas de ${TEMAS_DICO.find(t => t.id === tema).nombre}`}>{delTema.map(p => <button type="button" key={p.id} onClick={() => preguntar(p)}>{p.pregunta}{flecha}</button>)}</div>}
          {historial.length > 0 && <div className="pn-conversacion" role="log" aria-label="Conversación con respuestas preparadas" ref={registro}>{historial.map((p, indice) => <div className="pn-intercambio" key={`${p.id}-${indice}`}><p className="pn-usuario">{p.pregunta}</p><div className="pn-dico-responde" ref={indice === historial.length - 1 ? respuesta : null} tabIndex={-1} aria-label={`Respuesta de Dico: ${p.pregunta}`}><p>{p.respuesta}</p><EnlaceRespuesta pregunta={p} onDiagnostico={onDiagnostico} /></div></div>)}</div>}
          {ultimo && !tema && <div className="pn-sugeridas" aria-label="Preguntas relacionadas">{sugeridas.map(p => <button type="button" key={p.id} onClick={() => preguntar(p)}>{p.pregunta}</button>)}</div>}
          <form className="pn-buscador" role="search" aria-label="Buscar preguntas sobre Dico" onSubmit={evento => { evento.preventDefault(); setBuscado(true); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
            <label className="pl-oculto" htmlFor="pn-busqueda">Buscá tu duda</label>
            <input id="pn-busqueda" type="search" value={consulta} maxLength={160} minLength={2} required placeholder={abierto ? 'Buscá tu duda: planes, datos, puesta en marcha…' : 'Buscá tu duda…'} autoComplete="off" onChange={evento => { setConsulta(evento.target.value); setBuscado(false); setTema(null); }} aria-controls="pn-resultados" />
            <button type="submit" aria-label="Buscar preguntas">{flecha}</button>
          </form>
          <p className="pn-nota">Respuestas preparadas sobre Dico.</p>
          <div id="pn-resultados">
            {buscando && <><p className="pn-estado" role="status">{resultados.length ? `${resultados.length === 1 ? '1 pregunta relacionada' : `${resultados.length} preguntas relacionadas`}. Elegí una para ver la respuesta.` : 'No encontré una pregunta que coincida. Probá con otro tema o consultanos por WhatsApp.'}</p>{resultados.length > 0 ? <div className="pn-opciones">{resultados.map(p => <button type="button" key={p.id} onClick={() => preguntar(p)}>{p.pregunta}{flecha}</button>)}</div> : <div className="pn-sin-respuesta"><Whatsapp>Hablemos por WhatsApp</Whatsapp><span>{WHATSAPP_HORARIO}.</span></div>}</>}
          </div>
        </div>
        <div className="pn-pie">
          <button type="button" aria-expanded={todas} aria-controls="pn-todas" onClick={() => setTodas(!todas)}>{todas ? 'Ocultar preguntas' : 'Ver todas las preguntas'} <span aria-hidden="true">{todas ? '−' : '→'}</span></button>
          <Whatsapp>Consultar por WhatsApp</Whatsapp>
        </div>
        <div id="pn-todas" hidden={!todas} className="pn-lista">
          {PREGUNTAS_DICO.map(p => <details className="pn-pregunta" key={p.id}><summary>{p.pregunta}<span aria-hidden="true">+</span></summary><div className="pn-respuesta"><p>{p.respuesta}</p><EnlaceRespuesta pregunta={p} onDiagnostico={onDiagnostico} /></div></details>)}
        </div>
      </div>
    </section>
  );
}
