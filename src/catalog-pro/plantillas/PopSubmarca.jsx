// src/catalog-pro/plantillas/PopSubmarca.jsx
// Segunda marca del negocio: campo de color propio y sus productos.
// Los colores de la config entran como variables CSS; el texto sobre el
// fondo sale de textoSobre() para garantizar contraste.
import PopProductoCard from "./PopProductoCard";
import { contraste, textoSobre } from "./marcaATokens";

export default function PopSubmarca({ submarca = {}, items = [], ...resto }) {
  const vars = {};
  if (submarca.fondo) {
    vars["--pop-sub-fondo"] = submarca.fondo;
    const propio = submarca.color && contraste(submarca.color, submarca.fondo) >= 4.5;
    vars["--pop-sub-texto"] = propio ? submarca.color : textoSobre(submarca.fondo);
  }
  const logo = submarca.logo || submarca.isotipo;
  return (
    <section className="pop-submarca" id="pop-submarca" aria-labelledby="pop-sub-t" style={vars}>
      <div className="pop-submarca__intro" data-revelar>
        {logo && <img src={logo} alt="" height="56" className="pop-submarca__logo" loading="lazy" />}
        {submarca.eyebrow && <p className="pop-kicker">{submarca.eyebrow}</p>}
        <h2 id="pop-sub-t" className="pop-titulo">{submarca.titulo || submarca.nombre}</h2>
        {submarca.texto && <p className="pop-submarca__texto">{submarca.texto}</p>}
      </div>
      <div className="pop-submarca__items">
        {items.map((v) => <PopProductoCard key={v.id} v={v} {...resto} />)}
      </div>
    </section>
  );
}
