import { useEffect, useRef } from 'react';
import { NEGOCIOS } from './clientes';
import '../../styles/negocios-dico.css';

export default function NegociosDico() {
  const panel = useRef(null);
  const forzar = useRef(false);
  useEffect(() => {
    const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const rect = panel.current.getBoundingClientRect();
      const progreso = preferencia.matches || forzar.current ? 1 : Math.max(0, Math.min(1, (window.innerHeight * .82 - rect.top - rect.height / 2) / (window.innerHeight * .22)));
      panel.current.style.setProperty('--nc-apertura', progreso);
      panel.current.style.setProperty('--nc-contenido', Math.max(0, Math.min(1, (progreso - .45) / .55)));
      panel.current.dataset.visible = progreso >= .85;
    };
    const actualizar = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    window.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    preferencia.addEventListener('change', actualizar);
    actualizar();
    return () => { cancelAnimationFrame(cuadro); window.removeEventListener('scroll', actualizar); window.removeEventListener('resize', actualizar); preferencia.removeEventListener('change', actualizar); };
  }, []);
  return (
    <section className="nc-root" id="negocios" aria-labelledby="nc-titulo">
      <div className="nc-panel" ref={panel} onFocusCapture={() => { forzar.current = true; panel.current.style.setProperty('--nc-apertura', 1); panel.current.style.setProperty('--nc-contenido', 1); panel.current.dataset.visible = true; }}>
      <h2 id="nc-titulo">Negocios que ya usan Dico</h2>
      <div className="nc-deslizable" role="region" aria-label="Negocios que usan Dico. Deslizá para ver todos." tabIndex={0}>
        <ul className="nc-fila">
          {NEGOCIOS.map(negocio => (
            <li key={negocio.logo}>
              <a className="nc-negocio" href={`https://www.instagram.com/${negocio.instagram}/`}
                target="_blank" rel="noopener noreferrer" aria-label={`${negocio.nombre}: ver Instagram (abre en otra pestaña)`}>
                <img src={`/brand/landing/clientes/${negocio.logo}.webp`} alt="" width="72" height="72" loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </section>
  );
}
