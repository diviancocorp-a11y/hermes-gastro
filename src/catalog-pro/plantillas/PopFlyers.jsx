// src/catalog-pro/plantillas/PopFlyers.jsx
// Flyers vigentes en un carrusel con scroll-snap (sin JS de carrusel: el
// desplazamiento es nativo y accesible por teclado).

// Solo enlaces https, relativos o ancla: lo demas (javascript:, etc.) no se enlaza.
const enlaceSeguro = (l) => (typeof l === "string" && /^(https:\/\/|\/|#)/.test(l) ? l : null);

export default function PopFlyers({ textos = {}, flyers = [] }) {
  return (
    <section className="pop-seccion pop-flyers" id="pop-flyers" aria-labelledby="pop-fly-t">
      <div className="pop-seccion__cabeza" data-revelar>
        {textos.flyers_eyebrow && <p className="pop-kicker">{textos.flyers_eyebrow}</p>}
        <h2 id="pop-fly-t" className="pop-titulo">{textos.flyers_titulo || "Novedades"}</h2>
      </div>
      <div className="pop-flyers__carril" role="region" aria-label="Novedades, desplazá para ver más" tabIndex={0}>
      <ul className="pop-flyers__lista">
        {flyers.map((f, i) => {
          const href = enlaceSeguro(f.link);
          return (
            <li key={i} className="pop-flyer" data-revelar>
              {f.imagen && <img src={f.imagen} alt={f.titulo ? "" : "Novedad"} width="360" height="450" loading="lazy" decoding="async" />}
              <div className="pop-flyer__cuerpo">
                {f.badge && <span className="pop-flyer__badge">{f.badge}</span>}
                {f.titulo && <h3 className="pop-flyer__titulo">{f.titulo}</h3>}
                {f.texto && <p>{f.texto}</p>}
                {href && <a className="pop-btn pop-btn--texto" href={href}>Ver más<span className="pop-sr">: {f.titulo || "novedad"}</span></a>}
              </div>
            </li>
          );
        })}
      </ul>
      </div>
    </section>
  );
}
