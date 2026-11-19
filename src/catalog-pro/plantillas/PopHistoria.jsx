// src/catalog-pro/plantillas/PopHistoria.jsx
// Historia del negocio. Con isotipo, el sello es un circulo con el texto girando
// alrededor; con `acento` (estilo de impacto) se abre con la cinta de contorno.
// Sin isotipo conserva el sello suelto de siempre.
import { useId } from "react";
import PopCinta from "./PopCinta";
import conAcento from "./conAcento";

const RADIO = 122;
const PERIMETRO = Math.round(2 * Math.PI * RADIO);

function SelloCircular({ isotipo, texto }) {
  const id = useId();
  const vuelta = texto ? `${texto} · ${texto} · ` : "";
  return (
    <div className="pop-historia__sello" aria-hidden="true">
      {vuelta && (
        <svg className="pop-historia__anillo" viewBox="0 0 300 300" focusable="false">
          <defs><path id={id} d={`M150,150m-${RADIO},0a${RADIO},${RADIO} 0 1,1 ${RADIO * 2},0a${RADIO},${RADIO} 0 1,1 -${RADIO * 2},0`} /></defs>
          <text><textPath href={`#${id}`} textLength={PERIMETRO} lengthAdjust="spacing">{vuelta}</textPath></text>
        </svg>
      )}
      <img src={isotipo} alt="" width="190" height="190" loading="lazy" decoding="async" />
    </div>
  );
}

export default function PopHistoria({ textos = {}, isotipo, cinta = [], acento = false }) {
  const conSello = Boolean(isotipo);
  return (
    <>
      {acento && cinta.length > 0 && <PopCinta frases={cinta} contorno />}
      <section className={`pop-seccion pop-historia${conSello ? " pop-historia--con-sello" : ""}`} id="pop-historia" aria-labelledby="pop-hist-t">
        {conSello && <SelloCircular isotipo={isotipo} texto={textos.historia_sello} />}
        <div className="pop-historia__texto" data-revelar>
          {textos.historia_eyebrow && <p className="pop-kicker">{textos.historia_eyebrow}</p>}
          <h2 id="pop-hist-t" className="pop-titulo">{conAcento(textos.historia_titulo || "Nuestra historia", acento)}</h2>
          {textos.historia_texto && <p className="pop-historia__parrafo">{textos.historia_texto}</p>}
          {textos.historia_cta && <a className="pop-btn pop-btn--texto pop-historia__cta" href="#pop-menu">{textos.historia_cta} <span aria-hidden="true">↗</span></a>}
        </div>
        {!conSello && textos.historia_sello && <span className="pop-sello pop-sello--historia" aria-hidden="true">{textos.historia_sello}</span>}
      </section>
    </>
  );
}
