// src/catalog-pro/plantillas/PopBanda.jsx
// Banda de color pleno con foto: el texto vive al lado, nunca encima de la imagen.
export default function PopBanda({ textos = {} }) {
  return (
    <section className="pop-banda" id="pop-banda" aria-labelledby="pop-banda-t">
      <div className="pop-banda__texto" data-revelar>
        {textos.banda_eyebrow && <p className="pop-banda__kicker">{textos.banda_eyebrow}</p>}
        <h2 id="pop-banda-t" className="pop-titulo">{textos.banda_titulo}</h2>
        {textos.banda_texto && <p>{textos.banda_texto}</p>}
      </div>
      {textos.banda_imagen && (
        <img className="pop-banda__img" src={textos.banda_imagen} alt="" width="720" height="480" loading="lazy" decoding="async" data-revelar />
      )}
    </section>
  );
}
