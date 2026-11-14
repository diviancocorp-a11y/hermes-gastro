// src/catalog-pro/plantillas/PopFooter.jsx
// Cierre: logo, el footer del catalogo (legales y contacto del negocio) y el
// boton para pausar animaciones. WhatsAppFloat lo monta Catalog, no se repite.
import CatalogFooter from "../CatalogFooter";

export default function PopFooter({ nombre, logo, settings, quieto, onAlternar }) {
  return (
    <div className="pop-footer">
      <div className="pop-footer__marca">
        {logo ? <img src={logo} alt={nombre} height="48" loading="lazy" /> : <p className="pop-footer__nombre">{nombre}</p>}
      </div>
      <button type="button" className="pop-btn pop-btn--texto" onClick={onAlternar}>
        {quieto ? "Reanudar animaciones" : "Pausar animaciones"}
      </button>
      <CatalogFooter settings={settings} />
    </div>
  );
}
