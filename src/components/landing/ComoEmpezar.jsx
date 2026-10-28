import { useEffect, useRef } from 'react';
import '../../styles/como-empezar.css';

const PASOS = [
  ['Descubrís por dónde empezar', 'Respondés el diagnóstico y ves qué necesita tu negocio.'],
  ['Configuramos Dico con vos', 'Te ayudamos a crear tu cuenta y cargar la información de tu negocio.'],
  ['Seguimos con vos', 'Revisamos cómo lo estás usando y te proponemos mejoras para tu operación.'],
];

export default function ComoEmpezar({ onDiagnostico }) {
  const recorridoRef = useRef(null);
  useEffect(() => {
    const elemento = recorridoRef.current;
    const circulos = [...elemento.querySelectorAll('.ce-numero')];
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cuadro = 0, actual = 0, destino = 0, medir = true;
    const limitar = valor => Math.max(0, Math.min(1, valor));
    const pintar = valor => {
      elemento.style.setProperty('--ce-avance', `${valor * 100}%`);
      const visible = mq.matches ? 0 : limitar(Math.min(valor / .06, (1 - valor) / .06)) * .6;
      elemento.style.setProperty('--ce-pulso-opacidad', visible);
      circulos.forEach((circulo, indice) => {
        const halo = mq.matches || valor <= 0 || valor >= 1 ? 0 : Math.max(0, 1 - Math.abs(valor - indice / 2) / .09);
        circulo.style.setProperty('--ce-halo', halo * .65);
      });
    };
    const avanzar = () => {
      cuadro = 0;
      if (medir) {
        const primero = circulos[0].getBoundingClientRect();
        const ultimo = circulos[2].getBoundingClientRect();
        const inicio = primero.top + primero.height / 2;
        const distancia = ultimo.top + ultimo.height / 2 - inicio + innerHeight * .44;
        const progreso = limitar((innerHeight * .76 - inicio) / distancia);
        destino = progreso < .005 ? 0 : progreso > .995 ? 1 : progreso;
        medir = false;
      }
      if (mq.matches) { actual = destino; pintar(actual); return; }
      actual += (destino - actual) * .2;
      if (Math.abs(destino - actual) < .001) actual = destino;
      pintar(actual);
      if (actual !== destino) cuadro = requestAnimationFrame(avanzar);
    };
    const actualizar = () => {
      medir = true;
      if (!cuadro) cuadro = requestAnimationFrame(avanzar);
    };
    window.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    mq.addEventListener('change', actualizar);
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(actualizar);
    observador?.observe(elemento);
    actualizar();
    return () => {
      cancelAnimationFrame(cuadro);
      observador?.disconnect();
      window.removeEventListener('scroll', actualizar);
      window.removeEventListener('resize', actualizar);
      mq.removeEventListener('change', actualizar);
    };
  }, []);
  return (
    <section className="ce-root" id="como-empezar" aria-labelledby="ce-titulo">
      <div className="ce-luces-borde" aria-hidden="true"><span /><span /><span /></div>
      <div className="ce-dentro">
        <h2 id="ce-titulo"><span className="ce-intro">No tenés que resolver todo de golpe.</span><span>Te acompañamos desde el primer paso.</span></h2>
        <div className="ce-recorrido" ref={recorridoRef}>
          <div className="ce-via" aria-hidden="true"><span className="ce-pulso" /></div>
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
