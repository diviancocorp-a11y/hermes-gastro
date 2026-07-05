import { useEffect, useRef } from "react";

/**
 * useAndroidBack — el boton "atras" del telefono/navegador retrocede UN paso
 * DENTRO de la SPA en vez de abandonar el sitio.
 *
 * El catalogo no usa rutas para sus overlays (detalle, carrito, checkout + sus
 * steps, modales), asi que el back del sistema salia de la pagina y cortaba la
 * venta. Mantenemos una pila de "guards" en el history igual a la cantidad de
 * capas abiertas: cada back del usuario consume un guard y cierra la capa
 * superior; cuando no quedan capas, el back se comporta normal (sale del sitio).
 *
 * @param {number} layerCount  cantidad de capas navegables abiertas ahora
 * @param {Function} closeTop   cierra la capa superior (retrocede un paso)
 */
export default function useAndroidBack(layerCount, closeTop) {
  const closeRef = useRef(closeTop);
  closeRef.current = closeTop;
  const guardsRef = useRef(0);   // guards que empujamos al history
  const skipRef = useRef(false); // ignorar el proximo popstate (lo causamos nosotros)

  // Back del usuario: consumir un guard y cerrar la capa superior.
  useEffect(() => {
    const onPop = () => {
      if (skipRef.current) { skipRef.current = false; return; }
      if (guardsRef.current > 0) {
        guardsRef.current -= 1;
        closeRef.current && closeRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Sincronizar la cantidad de guards con la cantidad de capas abiertas.
  useEffect(() => {
    const diff = layerCount - guardsRef.current;
    if (diff > 0) {
      // se abrieron capas → empujar guards
      for (let i = 0; i < diff; i++) window.history.pushState({ hgBack: true }, "");
      guardsRef.current = layerCount;
    } else if (diff < 0) {
      // se cerraron capas desde la UI (no por el back) → sacar los guards sobrantes
      guardsRef.current = layerCount;
      skipRef.current = true;
      window.history.go(diff); // diff es negativo
    }
  }, [layerCount]);
}
