// src/catalog-pro/plantillas/PopHero.jsx
// Portada: titular grande, una accion y una imagen dominante con sello.
export default function PopHero({ textos = {}, nombre, lead, imagen, abierto }) {
  const titulo = textos.hero_titulo || nombre;
  const bajada = textos.hero_lead || lead;
  return (
    <section className={`pop-hero${imagen ? "" : " pop-hero--solo"}`} id="pop-inicio" aria-labelledby="pop-h1">
      <div className="pop-hero__texto" data-revelar>
        {textos.hero_eyebrow && <p className="pop-hero__kicker">{textos.hero_eyebrow}</p>}
        <h1 id="pop-h1" className="pop-hero__titulo">{titulo}</h1>
        {bajada && <p className="pop-hero__lead">{bajada}</p>}
        <div className="pop-hero__acciones">
          <a className="pop-btn pop-btn--primario pop-btn--grande" href="#pop-menu">{textos.hero_cta || "Ver el menú y pedir"}</a>
          {textos.hero_nota && <p className="pop-hero__nota">{textos.hero_nota}</p>}
        </div>
        {typeof abierto === "boolean" && <p className="pop-hero__estado">{abierto ? "Estamos recibiendo pedidos" : "Ahora estamos cerrados"}</p>}
      </div>
      {imagen ? (
        <div className="pop-hero__imagen" data-revelar>
          <img src={imagen} alt="" width="640" height="640" fetchPriority="high" />
          {textos.hero_sello && <span className="pop-sello" aria-hidden="true">{textos.hero_sello}</span>}
        </div>
      ) : (textos.hero_sello && <span className="pop-sello pop-sello--suelto" aria-hidden="true">{textos.hero_sello}</span>)}
    </section>
  );
}
