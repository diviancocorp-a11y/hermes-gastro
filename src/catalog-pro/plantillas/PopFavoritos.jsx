// src/catalog-pro/plantillas/PopFavoritos.jsx
// Hasta tres productos marcados como destacados. Primero grande, los otros al costado.
import PopProductoCard from "./PopProductoCard";

export default function PopFavoritos({ textos = {}, items = [], ...resto }) {
  return (
    <section className="pop-seccion pop-favoritos" id="pop-favoritos" aria-labelledby="pop-fav-t">
      <div className="pop-seccion__cabeza" data-revelar>
        {textos.favoritos_eyebrow && <p className="pop-kicker">{textos.favoritos_eyebrow}</p>}
        <h2 id="pop-fav-t" className="pop-titulo">{textos.favoritos_titulo || "Los favoritos de la casa"}</h2>
        {textos.favoritos_aside && <p className="pop-seccion__aside">{textos.favoritos_aside}</p>}
      </div>
      <div className="pop-favoritos__grilla">
        {items.map((v, i) => <PopProductoCard key={v.id} v={v} grande={i === 0} {...resto} />)}
      </div>
    </section>
  );
}
