import { useEffect, useRef } from 'react';
import useMediaQuery from '../../lib/useMediaQuery';
import '../../styles/transicion-volt.css';

export default function TransicionVolt() {
  const raiz = useRef(null);
  const reducido = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (reducido || !raiz.current.animate) return;
    const pulsos = [...raiz.current.children];
    const animaciones = new Map();
    let visible = false;
    const mover = pulso => {
      if (!visible) return;
      const { width, height } = raiz.current.getBoundingClientRect();
      const x = Math.random() * width;
      const y = 30 + Math.random() * (height - 60);
      const dx = (Math.random() - .5) * Math.min(width * .6, 400);
      const dy = (Math.random() - .5) * 90;
      const angulo = Math.atan2(dy, dx) * 180 / Math.PI;
      const desde = `translate(${x}px, ${y}px) rotate(${angulo}deg)`;
      const hasta = `translate(${x + dx}px, ${y + dy}px) rotate(${angulo}deg)`;
      const animacion = pulso.animate([
        { transform: desde, opacity: 0, offset: 0 },
        { opacity: .7, offset: .2 },
        { opacity: .5, offset: .7 },
        { transform: hasta, opacity: 0, offset: 1 },
      ], { duration: 2200 + Math.random() * 2200, delay: 300 + Math.random() * 1800, easing: 'ease-in-out' });
      animaciones.set(pulso, animacion);
      animacion.onfinish = () => mover(pulso);
    };
    const detener = () => { animaciones.forEach(animacion => animacion.cancel()); animaciones.clear(); };
    const observar = entradas => {
      const siguiente = entradas[0].isIntersecting;
      if (siguiente === visible) return;
      visible = siguiente;
      if (visible) pulsos.forEach(mover);
      else detener();
    };
    const observador = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(observar);
    if (observador) observador.observe(raiz.current);
    else { visible = true; pulsos.forEach(mover); }
    return () => { visible = false; observador?.disconnect(); detener(); };
  }, [reducido]);

  return <div className="hv-root" ref={raiz} aria-hidden="true"><span /><span /><span /></div>;
}
