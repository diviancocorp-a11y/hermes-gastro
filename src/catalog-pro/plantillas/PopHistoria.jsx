// src/catalog-pro/plantillas/PopHistoria.jsx
// Historia del negocio con sello.
export default function PopHistoria({ textos = {} }) {
  return (
    <section className="pop-seccion pop-historia" id="pop-historia" aria-labelledby="pop-hist-t">
      <div className="pop-historia__texto" data-revelar>
        {textos.historia_eyebrow && <p className="pop-kicker">{textos.historia_eyebrow}</p>}
        <h2 id="pop-hist-t" className="pop-titulo">{textos.historia_titulo || "Nuestra historia"}</h2>
        {textos.historia_texto && <p className="pop-historia__parrafo">{textos.historia_texto}</p>}
      </div>
      {textos.historia_sello && <span className="pop-sello pop-sello--historia" aria-hidden="true">{textos.historia_sello}</span>}
    </section>
  );
}
