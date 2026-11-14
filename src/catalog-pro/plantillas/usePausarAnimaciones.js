// src/catalog-pro/plantillas/usePausarAnimaciones.js
// Preferencia "pausar animaciones" de la plantilla pop. Vive en localStorage
// (con try/catch: modo privado o datos bloqueados no deben romper nada) y se
// refleja en la clase `pop-quieto` de la raiz.
import { useCallback, useState } from "react";

const CLAVE = "dico-pop-quieto";

export function prefiereMenosMovimiento() {
  try { return Boolean(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { return false; }
}

function leer() {
  try { return window.localStorage.getItem(CLAVE) === "1"; } catch { return false; }
}

export default function usePausarAnimaciones() {
  const [quieto, setQuieto] = useState(leer);
  const alternar = useCallback(() => {
    setQuieto((actual) => {
      const nuevo = !actual;
      try { window.localStorage.setItem(CLAVE, nuevo ? "1" : "0"); } catch { /* sin almacenamiento: vale solo esta visita */ }
      return nuevo;
    });
  }, []);
  return { quieto, alternar };
}
