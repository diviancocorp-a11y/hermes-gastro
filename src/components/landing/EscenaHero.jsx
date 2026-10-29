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
        if (visible) solicitar();
        else { cancelAnimationFrame(cuadro); cuadro = 0; }
      });
      observador.observe(raiz);
      window.addEventListener('scroll', solicitar, { passive: true });
      window.addEventListener('resize', solicitar);
      limpiar = () => {
        cancelAnimationFrame(cuadro);
        observador.disconnect();
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
      <img className="pl-tiempo-capa pl-tiempo-montana" data-tiempo-capa="0.65" src="/brand/landing/parallax/montana.webp" width="2000" height="1906" alt="" />
      <img className="pl-tiempo-capa pl-tiempo-frente" data-tiempo-capa="0.12" src="/brand/landing/parallax/primer-plano.webp" width="2000" height="1906" alt="" />
    </figure>
  );
}
