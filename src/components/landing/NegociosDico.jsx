import { useEffect, useRef } from 'react';
import { NEGOCIOS } from './clientes';
import '../../styles/negocios-dico.css';

export default function NegociosDico() {
  const panel = useRef(null);
  const forzar = useRef(false);
  const revelado = useRef(0);
  useEffect(() => {
    const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const rect = panel.current.getBoundingClientRect();
      const avance = preferencia.matches || forzar.current ? 1 : Math.max(0, Math.min(1, (window.innerHeight * .98 - rect.top - rect.height / 2) / (window.innerHeight * .18)));
      const progreso = Math.max(revelado.current, avance);
      revelado.current = progreso;
      panel.current.style.setProperty('--nc-apertura', progreso);
      panel.current.style.setProperty('--nc-contenido', Math.max(0, Math.min(1, (progreso - .78) / .22)));
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
      <div className="nc-marco" ref={panel} onFocusCapture={() => { forzar.current = true; panel.current.style.setProperty('--nc-apertura', 1); panel.current.style.setProperty('--nc-contenido', 1); panel.current.dataset.visible = true; }}>
      <div className="nc-panel">
      <h2 id="nc-titulo">Negocios que ya usan Dico</h2>
      <div className="nc-clientes">
        <ul className="nc-fila">
          {NEGOCIOS.map(negocio => (
            <li key={negocio.logo}>
              <a className="nc-negocio" href={`https://www.instagram.com/${negocio.instagram}/`}
                target="_blank" rel="noopener noreferrer" aria-label={`${negocio.nombre}: ver Instagram (abre en otra pestaña)`}>
                <img src={`/brand/landing/clientes/${negocio.logo}.webp`} alt="" width="72" height="72" loading="lazy" />
                <span className="nc-nombre">{negocio.nombre}</span>
                <span className="nc-ver">Ver negocio <span aria-hidden="true">↗</span></span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      </div>
      </div>
    </section>
  );
}
