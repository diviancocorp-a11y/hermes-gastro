import { useEffect, useRef } from 'react';
import { PiezaResultado } from './Piezas';

/** Fragmentos HTML de producto; todos los importes son ejemplos, nunca datos
 * de clientes. El resultado usa la misma cuenta que el diagnóstico. */
export default function EscenaHero() {
  const escena = useRef(null);

  useEffect(() => {
    const raiz = escena.current;
    if (!raiz || !window.matchMedia || !raiz.animate || !window.IntersectionObserver) return undefined;
    const preferencia = window.matchMedia('(prefers-reduced-motion: no-preference) and (min-width: 1000px)');
    let limpiar = () => {};
    const preparar = () => {
      limpiar();
      if (!preferencia.matches) return;
      const capas = [...raiz.querySelectorAll('[data-profundidad]')].map((el) => {
        const viaje = Number(el.dataset.profundidad);
        const animacion = el.animate([
          { translate: '0 0' }, { translate: `0 ${viaje}px` },
        ], { duration: 1000, fill: 'both' });
        animacion.pause();
        return animacion;
      });
      let cuadro = 0;
      let visible = false;
      const dibujar = () => {
        cuadro = 0;
        if (!visible) return;
        const rect = raiz.getBoundingClientRect();
        const progreso = Math.max(0, Math.min(1, -rect.top / rect.height));
        capas.forEach((a) => { a.currentTime = progreso * 1000; });
      };
      const alScroll = () => {
        if (visible && !cuadro) cuadro = requestAnimationFrame(dibujar);
      };
      const observador = new IntersectionObserver(([entrada]) => {
        visible = entrada.isIntersecting;
        if (visible) alScroll();
      });
      observador.observe(raiz);
      window.addEventListener('scroll', alScroll, { passive: true });
      limpiar = () => {
        cancelAnimationFrame(cuadro);
        observador.disconnect();
        window.removeEventListener('scroll', alScroll);
        capas.forEach((a) => a.cancel());
      };
    };
    preparar();
    preferencia.addEventListener('change', preparar);
    return () => { limpiar(); preferencia.removeEventListener('change', preparar); };
  }, []);

  return (
    <figure className="pl-escena" ref={escena} aria-label="Dico en computadora, tablet y celular">
      <div className="pl-dispositivo pl-laptop" data-ui data-profundidad="-28">
        <div className="pl-laptop-pantalla">
          <div className="pl-dispositivo-cab">
            <span>Dico · Gastronomía</span>
            <span className="pl-senal">Ejemplo</span>
          </div>
          <div className="pl-hero-resultado">
            <h2>Resultado de hoy</h2>
            <span className="pl-hero-resultado-etiqueta">Ganancia neta · viernes</span>
            <p className="pl-hero-resultado-cifra">$669.000</p>
            <p className="pl-hero-resultado-margen">30,9 % de la venta</p>
            <details className="pl-hero-desglose">
              <summary>Ver cómo cierra la cuenta</summary>
              <PiezaResultado elegible={false} />
            </details>
          </div>
        </div>
        <div className="pl-laptop-base" aria-hidden="true" />
      </div>
      <section className="pl-dispositivo pl-tablet" data-ui data-profundidad="-48" aria-label="Ejemplo de pedidos">
        <div className="pl-dispositivo-cab"><h2>Pedidos</h2><span>Hoy</span></div>
        <ul className="pl-escena-pedidos">
          <li><span>Mesa 6 <small>Salón</small></span><span className="pl-senal">En preparación</span></li>
          <li><span>Mostrador <small>Pedido para llevar</small></span><span>Listo</span></li>
          <li><span>Catálogo online <small>Delivery</small></span><span>Recibido</span></li>
        </ul>
      </section>
      <section className="pl-dispositivo pl-celular" data-ui data-profundidad="-12" aria-label="Ejemplo de catálogo en celular">
        <div className="pl-celular-camara" aria-hidden="true" />
        <h2>Catálogo online</h2>
        <img src="/brand/landing/lnp-empanadas.webp" width="789" height="374" alt="Empanadas de La Nona Pato" />
        <p>La Nona Pato</p>
        <span className="pl-senal">Tu negocio, online</span>
      </section>
      <figcaption className="pl-escena-nota">Vistas de ejemplo. Foto real de La Nona Pato.</figcaption>
    </figure>
  );
}
