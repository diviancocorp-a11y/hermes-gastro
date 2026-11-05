import { useEffect, useRef } from 'react';
import useMediaQuery from '../../lib/useMediaQuery';
import { NEGOCIOS } from './clientes';
import Palabras from './Palabras';
import '../../styles/negocios-dico.css';

// Copias de la fila para la cinta: solo se ven con movimiento (CSS), van
// fuera del arbol accesible y fuera del orden de tabulacion. Con dos copias
// la cinta cubre el ancho aunque haya pocos negocios.
const COPIAS = 2;

function Fila({ copia = false }) {
  return (
    <ul className={copia ? 'nc-fila nc-copia' : 'nc-fila'} aria-hidden={copia || undefined}>
      {NEGOCIOS.map(negocio => (
        <li key={negocio.logo}>
          <a className="nc-negocio" href={`https://www.instagram.com/${negocio.instagram}/`}
            target="_blank" rel="noopener noreferrer" aria-label={`${negocio.nombre}: ver Instagram (abre en otra pestaña)`}
            tabIndex={copia ? -1 : undefined}>
            <span className="nc-burbuja"><img src={`/brand/landing/clientes/${negocio.logo}.webp`} alt="" width="48" height="48" loading="lazy" /></span>
            <span className="nc-nombre">{negocio.nombre}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function NegociosDico() {
  const deslizable = useRef(null);
  // Con movimiento la fila es una cinta que no se desliza a mano: la region
  // no entra al tab ni promete deslizar. Sin window (prerender) cuenta como
  // con movimiento, que es lo que ve la mayoria.
  const reducido = useMediaQuery('(prefers-reduced-motion: reduce)');
  // Al salir el foco, la cinta vuelve a su origen (el foco pudo desplazarla).
  const soltarFoco = evento => {
    if (!evento.currentTarget.contains(evento.relatedTarget)) evento.currentTarget.scrollLeft = 0;
  };
  // La cinta es un loop de ambiente: fuera de pantalla se pausa.
  useEffect(() => {
    const elemento = deslizable.current;
    if (!elemento || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entrada]) => {
      elemento.dataset.visible = entrada.isIntersecting ? 'true' : 'false';
    });
    io.observe(elemento);
    return () => io.disconnect();
  }, []);
  return (
    <section className="nc-root" id="negocios" aria-labelledby="nc-titulo">
      <h2 id="nc-titulo" data-reveal="palabras"><Palabras texto="Negocios que ya usan" />{' '}<span className="nc-titulo-dico" translate="no"><Palabras texto="Dico" inicio={4} /></span></h2>
      <div className="nc-panel">
      <div className="nc-deslizable" ref={deslizable} role="region" aria-label={reducido ? 'Negocios que usan Dico. Deslizá para ver todos.' : 'Negocios que usan Dico'} tabIndex={reducido ? 0 : undefined} onBlur={soltarFoco}>
        <div className="nc-cinta">
          <Fila />
          {Array.from({ length: COPIAS }, (_, indice) => <Fila copia key={indice} />)}
        </div>
      </div>
      </div>
    </section>
  );
}
