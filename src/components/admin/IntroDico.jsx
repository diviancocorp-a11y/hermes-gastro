// src/components/admin/IntroDico.jsx
// El intro de Dico: el logo DICO se asienta y el aro de la O late dos veces.
//
// Se ve UNA vez por apertura real del negocio, justo antes del admin: cuando la
// persona inicia sesion en el login del admin o llega por el traspaso desde
// /entrar. Los logins no lo muestran (el form aparece enseguida) y tampoco se
// ve si la app se abre con la sesion ya abierta. La regla de cuando se
// enciende vive en `usePlatformTenant` (`intro`); este componente solo sabe
// mostrarse y avisar cuando termino.
//
// Es un overlay de pantalla completa. Dura `TIEMPOS.intro` como minimo; si
// `listo` es false (el admin todavia esta resolviendo la sesion) espera con el
// aro latiendo en vez de irse a un "Cargando...". Con prefers-reduced-motion
// se salta: llama a `onTerminar` de inmediato y no pinta nada.

import { useState, useEffect, useRef } from "react";
import DicoPulso from "../dico/DicoPulso";
import useMediaQuery from "../../lib/useMediaQuery";
import { TIEMPOS } from "./tiemposDeEntrada";
import { GOLD } from "./loginEstilos";

const FADE_MS = 600;

/* ─────────────── EL ARO DEL LOGO NO SE ADIVINA: SE MIDE ───────────────
 *
 * El splash es un PNG de 1368x452 donde la O es Dico. Para que el pulso Volt
 * caiga EXACTAMENTE sobre el aro que ya trae el arte, hay que saber donde esta
 * ese aro. Medido sobre `public/brand/dico/logo/dico-oscuro.png` (los pixeles
 * azules de la O, ajustando centro y radio por iteracion):
 *
 *   centro del aro   1147,4 / 225,3 px
 *   radio            128,2 px      grosor  26,5 px
 *   el personaje     958..1337 en X  ->  380 px de lado
 *
 * El radio sobre el medio-ancho del personaje da 0,675 — el mismo r/R 0,67 que
 * `DicoNative` midio sobre los assets 2D. Son el mismo aro, y eso es lo que
 * confirma que los numeros estan bien y no tanteados.
 *
 * La caja del overlay es CUADRADA y centrada en el aro: el SVG de DicoPulso no
 * declara `preserveAspectRatio`, asi que en una caja no cuadrada el navegador
 * lo encajaria con letterbox y el aro quedaria corrido. */
const ARO_LOGO = {
  izquierda: `${(957.42 / 1368) * 100}%`,
  arriba: `${(35.31 / 452) * 100}%`,
  lado: 380,
  radio: +((128.16 / 380) * 100).toFixed(2),
  grosor: +((26.5 / 380) * 100).toFixed(2),
};

/**
 * Raiz comun de todos los estados del panel. El intro tiene que ser SIEMPRE el
 * primer hijo de un fragmento del mismo tipo: si cada estado armara su propio
 * arbol, React desmontaria el overlay al pasar de "Cargando..." al panel y el
 * intro arrancaria de nuevo (el logo ya asentado volveria a entrar).
 */
export function ConIntro({ intro, status, onTerminar, children }) {
  return (
    <>
      {intro && status !== 'anon'
        ? <IntroDico onTerminar={onTerminar} listo={status !== 'checking'} />
        : null}
      {children}
    </>
  );
}

export default function IntroDico({ onTerminar, listo = true }) {
  const sinMovimiento = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [minimoCumplido, setMinimoCumplido] = useState(false);
  const aviso = useRef(onTerminar);
  useEffect(() => { aviso.current = onTerminar; }, [onTerminar]);

  // Sin movimiento no hay intro: se avisa de inmediato.
  useEffect(() => {
    if (sinMovimiento) aviso.current?.();
  }, [sinMovimiento]);

  useEffect(() => {
    if (sinMovimiento) return undefined;
    const t = setTimeout(() => setMinimoCumplido(true), TIEMPOS.intro);
    return () => clearTimeout(t);
  }, [sinMovimiento]);

  // Sale cuando ya paso el tiempo del gesto Y hay algo para mostrar abajo.
  const saliendo = minimoCumplido && listo;
  useEffect(() => {
    if (sinMovimiento || !saliendo) return undefined;
    const t = setTimeout(() => aviso.current?.(), FADE_MS);
    return () => clearTimeout(t);
  }, [sinMovimiento, saliendo]);

  if (sinMovimiento) return null;

  return (
    <div
      data-intro-dico=""
      aria-hidden="true"
      style={{
        position:"fixed", inset:0, zIndex:9999,
        display:"flex", alignItems:"center", justifyContent:"center",
        background:"#0a0a0a",
        opacity: saliendo ? 0 : 1,
        pointerEvents: saliendo ? "none" : "auto",
        transition:`opacity ${FADE_MS}ms cubic-bezier(0.22,1,0.36,1)`,
        overflow:"hidden",
      }}
    >
      <div style={{
        maxWidth:"min(86vw, 460px)",
        animation:`hg-splash-in ${TIEMPOS.entrada}ms cubic-bezier(0.22,1,0.36,1) forwards`,
        filter:`drop-shadow(0 18px 56px ${GOLD}55)`,
      }}>
        {/* El logo y, encima, el pulso Volt sobre el aro que ya trae la O.
            No se repinta el PNG: la senial es una capa aparte, que es para
            lo que existe `DicoPulso`. */}
        <div style={{ position:"relative" }}>
          <img
            src="/brand/dico/logo/dico-oscuro.png"
            alt="DICO"
            width="1368"
            height="452"
            style={{ display:"block", width:"100%", height:"auto" }}
          />
          <div style={{
            position:"absolute",
            left: ARO_LOGO.izquierda,
            top: ARO_LOGO.arriba,
            width: `${(ARO_LOGO.lado / 1368) * 100}%`,
            aspectRatio: "1 / 1",
            pointerEvents:"none",
          }}>
            <DicoPulso
              className="hg-splash-aro"
              activity="active"
              radio={ARO_LOGO.radio}
              grosor={ARO_LOGO.grosor}
            />
          </div>
        </div>
      </div>

      <style>{`
        /* El latido del splash.
           La espera es EXACTAMENTE lo que tarda el logo en asentarse: el aro
           arranca apagado —\`brillo\` nace en opacidad 0 y sin \`fill-mode\` la
           espera lo deja asi— y enciende recien cuando la marca ya esta
           quieta. Asi los dos latidos se ven enteros en vez de empezar
           mientras el logo todavia esta entrando.
           La regla gana por ESPECIFICIDAD y no por orden: \`pulso.css\` se
           importa desde el componente y el orden entre esa hoja y este bloque
           no esta garantizado. */
        .hg-splash-aro.dico-pulso--active .dico-pulso-brillo {
          animation-duration: ${TIEMPOS.latido}ms;
          animation-delay: ${TIEMPOS.entrada}ms;
          animation-iteration-count: ${TIEMPOS.latidos};
        }
        @keyframes hg-splash-in {
          from { opacity:0; transform:scale(0.88); }
          to   { opacity:1; transform:scale(1); }
        }
      `}</style>
    </div>
  );
}
