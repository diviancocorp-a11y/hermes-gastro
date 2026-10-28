import { useEffect, useRef, useState } from 'react';
import '../../styles/como-empezar.css';

const PASOS = [
  ['Descubrís por dónde empezar', 'Respondés el diagnóstico y ves qué necesita tu negocio.'],
  ['Configuramos Dico con vos', 'Te ayudamos a crear tu cuenta y cargar la información de tu negocio.'],
  ['Seguimos con vos', 'Revisamos cómo lo estás usando y te proponemos mejoras para tu operación.'],
];

export default function ComoEmpezar({ onDiagnostico }) {
  const recorridoRef = useRef(null);
  const [recorrido, setRecorrido] = useState('espera');
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reducir = () => { if (mq.matches) setRecorrido('finalizado'); };
    reducir();
    mq.addEventListener('change', reducir);
    const iniciar = () => setRecorrido(actual => actual === 'espera' ? (mq.matches ? 'finalizado' : 'animando') : actual);
    const observador = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) { iniciar(); observador.disconnect(); }
    }, { threshold: .25 });
    if (observador) observador.observe(recorridoRef.current);
    else iniciar();
    return () => { observador?.disconnect(); mq.removeEventListener('change', reducir); };
  }, []);
  return (
    <section className="ce-root" data-recorrido={recorrido} id="como-empezar" aria-labelledby="ce-titulo">
      <div className="ce-dentro">
        <h2 id="ce-titulo"><span>No tenés que resolver todo de golpe.</span><span>Te acompañamos desde el primer paso.</span></h2>
        <div className="ce-recorrido" ref={recorridoRef}>
          <div className="ce-via" aria-hidden="true"><span className="ce-pulso" onAnimationEnd={evento => { if (evento.target === evento.currentTarget) setRecorrido('finalizado'); }} /></div>
          <ol className="ce-pasos">
          {PASOS.map(([titulo, texto], indice) => (
            <li key={titulo}>
              <span className="ce-numero" aria-hidden="true">0{indice + 1}</span>
              <div><h3>{titulo}</h3><p>{texto}</p></div>
            </li>
          ))}
        </ol>
        </div>
        <div className="ce-accion">
          <button className="pl-boton ce-boton" type="button" onClick={onDiagnostico}>
            <span className="ce-etiqueta">Empezar mi diagnóstico</span>
            <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span>
          </button>
          <p>Diagnóstico breve, sin dejar tu email.</p>
        </div>
      </div>
    </section>
  );
}
