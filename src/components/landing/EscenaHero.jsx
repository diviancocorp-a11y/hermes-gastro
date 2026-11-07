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
      <Capa nombre="cielo" clase="pl-tiempo-cielo" velocidad="0.82" />
      <div className="pl-luz-horizonte" data-tiempo-capa="0.65" aria-hidden="true"><span className="pl-luz-volt" /><span className="pl-luz-oro" /></div>
      <Capa nombre="montana" clase="pl-tiempo-montana" velocidad="0.65" />
      <Capa nombre="primer-plano" clase="pl-tiempo-frente" velocidad="0.12" />
    </figure>
  );
}

/** En vertical (hasta 3:4) la capa se recorta por la altura: con `cover` se ve
 * como mucho el 61 % central del ancho (medido de 320x568 a 1024x1366). La
 * version movil es ese centro, 1300 de los 2000 px y a la misma escala, asi
 * que el celular ve los mismos pixeles con ~40 % menos de peso. Las tres capas
 * son el primer pantallazo y la entrada las espera: van con prioridad alta. */
const MEDIA_CAPA_MOVIL = '(max-aspect-ratio: 3/4)';
function Capa({ nombre, clase, velocidad }) {
  return (
    <picture>
      <source media={MEDIA_CAPA_MOVIL} srcSet={`/brand/landing/parallax/${nombre}-movil.webp`} width="1300" height="1906" />
      <img className={`pl-tiempo-capa ${clase}`} data-tiempo-capa={velocidad} src={`/brand/landing/parallax/${nombre}.webp`} width="2000" height="1906" alt="" fetchPriority="high" />
    </picture>
  );
}
