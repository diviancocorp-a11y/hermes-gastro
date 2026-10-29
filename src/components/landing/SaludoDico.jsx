import { useEffect, useRef, useState } from 'react';
import DicoPhysical from '../dico/DicoPhysical';
import useMediaQuery from '../../lib/useMediaQuery';
import { DICO_PET_FILAS } from '../../../platform/brand/dico-pet-assets.mjs';
import '../../styles/saludo-dico.css';

export default function SaludoDico() {
  const raiz = useRef(null);
  const [cuadro, setCuadro] = useState(0);
  const reducido = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (reducido) return;
    let raf = 0;
    const medir = () => {
      raf = 0;
      const rect = raiz.current.getBoundingClientRect();
      const progreso = Math.max(0, Math.min(1, (window.innerHeight * .9 - rect.top) / (window.innerHeight * .6)));
      raiz.current.style.setProperty('--sd-entrada', Math.min(1, progreso * 4));
      setCuadro(Math.min(DICO_PET_FILAS.saluda.cuadros - 1, Math.floor(progreso * DICO_PET_FILAS.saluda.cuadros)));
    };
    const actualizar = () => { if (!raf) raf = requestAnimationFrame(medir); };
    actualizar();
    window.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', actualizar);
      window.removeEventListener('resize', actualizar);
    };
  }, [reducido]);

  return (
    <section className="sd-root" ref={raiz} aria-label="Dico te da la bienvenida">
      <div className="sd-personaje">
        <DicoPhysical animacion={reducido ? null : 'saluda'} cuadroControlado={reducido ? 0 : cuadro} reducedMotion={reducido} title="Dico saludando" />
      </div>
    </section>
  );
}
