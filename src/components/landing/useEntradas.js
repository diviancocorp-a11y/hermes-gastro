// src/components/landing/useEntradas.js
// Entradas por seccion de las paginas publicas (landing y /diagnostico).

import { useLayoutEffect } from 'react';

const sinMovimiento = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Entradas por seccion: cada [data-reveal] entra una sola vez cuando aparece.
 *  El estado oculto solo existe bajo .pl-anim, que se pone aca: sin
 *  IntersectionObserver o con movimiento reducido, todo esta a la vista. */
export default function useEntradas(raizRef) {
  // useLayoutEffect: la clase entra antes del primer pintado, asi el titular
  // no aparece entero y despues desaparece para animarse.
  useLayoutEffect(() => {
    const raiz = raizRef.current;
    if (!raiz || sinMovimiento() || typeof IntersectionObserver === 'undefined') return undefined;
    raiz.classList.add('pl-anim');
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    raiz.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [raizRef]);
}
