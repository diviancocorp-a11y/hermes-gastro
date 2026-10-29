import { useEffect, useRef } from 'react';

/** Los tres recortes comparten canvas y encuadre. El titulo vive entre la
 * montana y el caminante; solo cambia la traslacion de cada plano. */
export default function EscenaHero() {
  const escena = useRef(null);

  useEffect(() => {
    const raiz = escena.current?.closest('.dg-cerrado');
    if (!raiz || !window.matchMedia || !raiz.animate || !window.IntersectionObserver) return undefined;
    const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
    let limpiar = () => {};
    const preparar = () => {
      limpiar();
      limpiar = () => {};
      if (preferencia.matches) return;
      const capas = [...raiz.querySelectorAll('[data-tiempo-capa]')].map((el) => {
        const velocidad = Number(el.dataset.tiempoCapa);
        const animacion = el.animate([
          { transform: 'translate3d(0, 0, 0)' },
          { transform: `translate3d(0, ${velocidad * 3000}px, 0)` },
        ], { duration: 3000, fill: 'both' });
        animacion.pause();
        return animacion;
      });
      let cuadro = 0;
      let visible = false;
      const dibujar = () => {
        cuadro = 0;
        if (!visible) return;
        const recorrido = Math.max(0, Math.min(3000, -raiz.getBoundingClientRect().top));
        capas.forEach((animacion) => { animacion.currentTime = recorrido; });
      };
      const solicitar = () => {
        if (visible && !cuadro) cuadro = requestAnimationFrame(dibujar);
      };
      const observador = new IntersectionObserver(([entrada]) => {
        visible = entrada.isIntersecting;
        escena.current?.classList.toggle('pl-tiempo-visible', visible);
        if (visible) solicitar();
        else { cancelAnimationFrame(cuadro); cuadro = 0; }
      });
      observador.observe(raiz);
      window.addEventListener('scroll', solicitar, { passive: true });
      window.addEventListener('resize', solicitar);
      limpiar = () => {
        cancelAnimationFrame(cuadro);
        observador.disconnect();
        escena.current?.classList.remove('pl-tiempo-visible');
        window.removeEventListener('scroll', solicitar);
        window.removeEventListener('resize', solicitar);
        capas.forEach((animacion) => animacion.cancel());
      };
    };
    preparar();
    preferencia.addEventListener('change', preparar);
    return () => { limpiar(); preferencia.removeEventListener('change', preparar); };
  }, []);

  return (
    <figure className="pl-tiempo-escena" ref={escena} aria-label="Una persona contempla las montañas desde una cresta">
      <img className="pl-tiempo-capa pl-tiempo-cielo" data-tiempo-capa="0.82" src="/brand/landing/parallax/cielo.webp" width="2000" height="1906" alt="" fetchPriority="high" />
      <div className="pl-auroras" data-tiempo-capa="0.65" aria-hidden="true"><span className="pl-aurora pl-aurora-volt"><svg viewBox="0 0 1000 400" preserveAspectRatio="none" focusable="false"><path d="M-80 300C80 30 180 360 360 150S650 50 820 180 1000 360 1100 40" /><path d="M-80 330C80 60 180 390 360 180S650 80 820 210 1000 390 1100 70" /><path d="M-80 270C80 0 180 330 360 120S650 20 820 150 1000 330 1100 10" /></svg></span><span className="pl-aurora pl-aurora-oro"><svg viewBox="0 0 1000 400" preserveAspectRatio="none" focusable="false"><path d="M-80 300C80 30 180 360 360 150S650 50 820 180 1000 360 1100 40" /><path d="M-80 330C80 60 180 390 360 180S650 80 820 210 1000 390 1100 70" /><path d="M-80 270C80 0 180 330 360 120S650 20 820 150 1000 330 1100 10" /></svg></span></div>
      <img className="pl-tiempo-capa pl-tiempo-montana" data-tiempo-capa="0.65" src="/brand/landing/parallax/montana.webp" width="2000" height="1906" alt="" />
      <img className="pl-tiempo-capa pl-tiempo-frente" data-tiempo-capa="0.12" src="/brand/landing/parallax/primer-plano.webp" width="2000" height="1906" alt="" />
    </figure>
  );
}
