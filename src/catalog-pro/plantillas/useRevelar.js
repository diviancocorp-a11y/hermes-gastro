// src/catalog-pro/plantillas/useRevelar.js
// Revelado al scroll. Devuelve `anima`: solo cuando es true la raiz lleva
// `pop-anima` y los [data-revelar] arrancan ocultos. Sin IntersectionObserver,
// con reduced-motion o en modo quieto queda false y todo se ve.
//
// Lo que se monta DESPUES (productos que llegan, cambio de categoria) se marca
// como visto al instante con un MutationObserver: ya aparecio por una accion o
// por datos, no tiene sentido esperar al scroll, y asi nunca queda en blanco.
import { useEffect, useState } from "react";
import { prefiereMenosMovimiento } from "./usePausarAnimaciones";

const puede = (quieto) => !quieto && !prefiereMenosMovimiento() && typeof IntersectionObserver !== "undefined";

export default function useRevelar(raizRef, quieto) {
  const [anima, setAnima] = useState(() => puede(quieto));

  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz || !puede(quieto)) { setAnima(false); return undefined; }
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) { e.target.setAttribute("data-visto", "1"); io.unobserve(e.target); }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    raiz.querySelectorAll("[data-revelar]").forEach((el) => io.observe(el));

    const mo = new MutationObserver((cambios) => {
      for (const c of cambios) {
        c.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.hasAttribute("data-revelar")) n.setAttribute("data-visto", "1");
          n.querySelectorAll?.("[data-revelar]").forEach((el) => el.setAttribute("data-visto", "1"));
        });
      }
    });
    mo.observe(raiz, { childList: true, subtree: true });
    setAnima(true);
    return () => { io.disconnect(); mo.disconnect(); setAnima(false); };
  }, [raizRef, quieto]);

  return anima;
}
