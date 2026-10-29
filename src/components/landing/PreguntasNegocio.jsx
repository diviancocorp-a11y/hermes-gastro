import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import DicoPhysical from '../dico/DicoPhysical';
import { PREGUNTAS_DICO, TEMAS_DICO } from '../../lib/preguntasPlataforma';
import { WHATSAPP_URL } from '../../lib/contactoPlataforma';
import { marcarEvento } from '../../lib/analiticaPlataforma';
import useMediaQuery from '../../lib/useMediaQuery';
import '../../styles/preguntas-negocio.css';

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
  const [tema, setTema] = useState('inicio');
  const [seleccion, setSeleccion] = useState(null);
  const [fase, setFase] = useState('quieto');
  const [saludando, setSaludando] = useState(false);
  const reducido = useMediaQuery('(prefers-reduced-motion: reduce)');
  const guia = useRef(null);
  const personaje = useRef(null);
  const anclaSaludo = useRef(null);
  const anclaRespuesta = useRef(null);
  const respuesta = useRef(null);
  const tabs = useRef([]);
  const origenScroll = useRef(0);
  const preguntas = PREGUNTAS_DICO.filter(p => p.tema === tema);
  const pensando = Boolean(seleccion) && !reducido && fase === 'pensando';
  const respondiendo = Boolean(seleccion) && !reducido && fase === 'respondiendo';

  useEffect(() => {
    let saludo;
    const saludar = () => { setSaludando(true); saludo = setTimeout(() => setSaludando(false), 850); };
    const observador = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) { saludar(); observador.disconnect(); }
    }, { threshold: .2 });
    if (observador) observador.observe(guia.current);
    else saludar();
    return () => { observador?.disconnect(); clearTimeout(saludo); };
  }, []);

  useLayoutEffect(() => {
    const colocar = () => {
      const destino = seleccion ? anclaRespuesta.current : anclaSaludo.current;
      if (!destino || !personaje.current) return;
      const origen = guia.current.getBoundingClientRect();
      const rect = destino.getBoundingClientRect();
      personaje.current.style.setProperty('--pn-x', `${rect.left - origen.left - guia.current.clientLeft}px`);
      personaje.current.style.setProperty('--pn-y', `${rect.top - origen.top - guia.current.clientTop}px`);
      personaje.current.dataset.listo = 'true';
    };
    colocar();
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(colocar);
    observador?.observe(guia.current);
    window.addEventListener('resize', colocar);
    return () => { observador?.disconnect(); window.removeEventListener('resize', colocar); };
  }, [seleccion]);

  useEffect(() => {
    if (!seleccion || reducido) return undefined;
    const mostrar = setTimeout(() => setFase('respondiendo'), 300);
    const reposar = setTimeout(() => setFase('quieto'), 1050);
    return () => { clearTimeout(mostrar); clearTimeout(reposar); };
  }, [seleccion, reducido]);

  useEffect(() => {
    if (!seleccion || pensando || !window.matchMedia('(max-width: 699px)').matches) return;
    if (Math.abs(window.scrollY - origenScroll.current) > 48) return;
    const rect = respuesta.current.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 16 || rect.top < 16) respuesta.current.scrollIntoView({ block: 'nearest', behavior: reducido ? 'instant' : 'smooth' });
  }, [seleccion, pensando, reducido]);

  const preguntar = pregunta => {
    if (seleccion?.id === pregunta.id) return;
    origenScroll.current = window.scrollY;
    setSeleccion(pregunta);
    setFase(reducido ? 'quieto' : 'pensando');
  };
  const cambiarTema = id => { setTema(id); setSeleccion(null); setFase('quieto'); };
  const tecladoTema = (evento, indice) => {
    let siguiente;
    if (evento.key === 'Home') siguiente = 0;
    else if (evento.key === 'End') siguiente = TEMAS_DICO.length - 1;
    else if (evento.key === 'ArrowRight') siguiente = (indice + 1) % TEMAS_DICO.length;
    else if (evento.key === 'ArrowLeft') siguiente = (indice - 1 + TEMAS_DICO.length) % TEMAS_DICO.length;
    else return;
    evento.preventDefault();
    cambiarTema(TEMAS_DICO[siguiente].id);
    tabs.current[siguiente]?.focus({ preventScroll: true });
  };
  const pose = seleccion ? (pensando ? 'thinking' : 'explain') : saludando ? 'explain' : 'idle';
  return (
    <section className="pn-root" id="preguntas" aria-labelledby="pn-titulo">
      <span className="pl-ancla" id="seguridad" aria-hidden="true" />
      <div className="pn-dentro">
        <h2 id="pn-titulo">Sacate la duda. Preguntale a Dico.</h2>
        <p className="pn-intro">Respuestas claras para empezar.</p>
        <div className="pn-guia" data-pregunta={Boolean(seleccion)} data-fase={pensando ? 'pensando' : respondiendo ? 'respondiendo' : 'quieto'} ref={guia}>
          <div className="pn-mascota" ref={personaje} aria-hidden="true"><DicoPhysical pose={pose} reducedMotion={reducido || !(saludando || pensando || respondiendo)} /></div>
          <header className="pn-saludo"><span className="pn-ancla-mascota" ref={anclaSaludo} aria-hidden="true" /><h3>¿Qué querés saber?</h3></header>
          <div className="pn-temas" role="tablist" aria-label="Temas de preguntas">
            {TEMAS_DICO.map((item, indice) => <button type="button" role="tab" id={`pn-tema-${item.id}`} key={item.id} aria-selected={tema === item.id} aria-controls="pn-preguntas-tema" tabIndex={tema === item.id ? 0 : -1} onClick={() => cambiarTema(item.id)} onKeyDown={evento => tecladoTema(evento, indice)} ref={nodo => { tabs.current[indice] = nodo; }}>{item.nombre}</button>)}
          </div>
          <div role="tabpanel" id="pn-preguntas-tema" aria-labelledby={`pn-tema-${tema}`}>
            <div className="pn-opciones" aria-label="Elegí una pregunta">
              {preguntas.map(p => <button type="button" key={p.id} aria-pressed={seleccion?.id === p.id} aria-controls="pn-respuesta" onClick={() => preguntar(p)}><span>{p.pregunta}</span>{seleccion?.id === p.id ? <span className="pn-elegida" aria-hidden="true">✓</span> : flecha}</button>)}
            </div>
            <div className="pn-zona-respuesta" ref={respuesta}>
              <span className="pn-ancla-mascota" ref={anclaRespuesta} aria-hidden="true" />
              <div className="pn-respuesta" id="pn-respuesta" aria-live="polite" aria-atomic="true" aria-busy={pensando}>
                {seleccion && <div className="pn-globo">
                  <p className="pn-autor">Dico</p>
                  {pensando && <span className="pn-pensando" role="status"><span /><span /><span /><span className="pl-oculto">Dico está preparando la respuesta.</span></span>}
                  <div className="pn-texto" data-visible={!pensando} aria-hidden={pensando}>
                    <p>{seleccion.respuesta}</p><EnlaceRespuesta pregunta={seleccion} onDiagnostico={onDiagnostico} />
                  </div>
                </div>}
              </div>
            </div>
          </div>
        </div>
        <p className="pn-pie">¿Te quedó otra duda? <Whatsapp>Hablemos por WhatsApp</Whatsapp></p>
      </div>
    </section>
  );
}
