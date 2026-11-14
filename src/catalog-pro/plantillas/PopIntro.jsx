// src/catalog-pro/plantillas/PopIntro.jsx
// Entrada de ~2,2 s con el isotipo del tenant. Una vez por sesion, saltable con
// Esc / Enter / toque, y ausente con reduced-motion o "pausar animaciones".
// Mientras dura, el resto de la pagina queda `inert` (no recibe foco ni lector);
// al terminar se restituye. No bloquea el scroll: es un velo que se desmonta solo.
import { useEffect, useRef, useState } from "react";
import { prefiereMenosMovimiento } from "./usePausarAnimaciones";

const CLAVE = "dico-pop-intro";

function yaVista() {
  try { return window.sessionStorage.getItem(CLAVE) === "1"; } catch { return false; }
}

export default function PopIntro({ imagen, nombre, quieto }) {
  const [visible, setVisible] = useState(() => Boolean(imagen) && !quieto && !prefiereMenosMovimiento() && !yaVista());
  const ref = useRef(null);

  useEffect(() => {
    if (!visible) return undefined;
    const cerrar = () => {
      try { window.sessionStorage.setItem(CLAVE, "1"); } catch { /* sin almacenamiento */ }
      setVisible(false);
    };
    const tecla = (e) => { if (e.key === "Escape" || e.key === "Enter") cerrar(); };
    const t = setTimeout(cerrar, 2200);
    window.addEventListener("keydown", tecla);
    const raiz = ref.current?.parentElement;
    const resto = raiz ? [...raiz.children].filter((el) => el !== ref.current) : [];
    resto.forEach((el) => el.setAttribute("inert", ""));
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", tecla);
      resto.forEach((el) => el.removeAttribute("inert"));
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="pop-intro" data-testid="pop-intro" ref={ref} onClick={() => setVisible(false)}>
      <img className="pop-intro__marca" src={imagen} alt={nombre || ""} width="160" height="160" />
      <button type="button" className="pop-btn pop-btn--texto pop-intro__saltar" onClick={() => setVisible(false)}>Saltar</button>
    </div>
  );
}
