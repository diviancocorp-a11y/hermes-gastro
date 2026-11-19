// src/catalog-pro/plantillas/PopFooter.jsx
// Cierre oscuro: marca y lema, atajos, llamada a pedir, instalar la app y pausar
// animaciones; debajo, el footer del catalogo (legales, contacto, burbuja con el
// logo y banda de Dico) con los tokens invertidos. WhatsAppFloat lo monta Catalog.
import { useEffect, useState } from "react";
import CatalogFooter from "../CatalogFooter";

export default function PopFooter({ nombre, logo, textos = {}, settings, quieto, onAlternar, onOpenCart, submarcaNombre }) {
  // "Instalar en mi celular": solo cuando el navegador ofrece instalar la app.
  const [instalable, setInstalable] = useState(null);
  useEffect(() => {
    const antes = (e) => { e.preventDefault(); setInstalable(e); };
    const listo = () => setInstalable(null);
    window.addEventListener("beforeinstallprompt", antes);
    window.addEventListener("appinstalled", listo);
    return () => { window.removeEventListener("beforeinstallprompt", antes); window.removeEventListener("appinstalled", listo); };
  }, []);
  const instalar = async () => {
    if (!instalable) return;
    try { await instalable.prompt(); } catch { /* el usuario cerro el dialogo */ }
    setInstalable(null);
  };

  return (
    <div className="pop-footer">
      <div className="pop-footer__in">
        <div className="pop-footer__cuerpo">
          <div className="pop-footer__marca">
            {logo ? <img className="pop-footer__logo" src={logo} alt={nombre} height="54" loading="lazy" /> : <p className="pop-footer__nombre">{nombre}</p>}
            {textos.footer_lema && <p className="pop-footer__lema">{textos.footer_lema}</p>}
          </div>
          <nav className="pop-footer__nav" aria-label="Atajos">
            {textos.footer_nav && <span className="pop-footer__etiqueta">{textos.footer_nav}</span>}
            <a href="#pop-menu">Ver menú</a>
            {submarcaNombre && <a href="#pop-submarca">{submarcaNombre}</a>}
            <button type="button" onClick={onOpenCart}>Mi pedido</button>
          </nav>
          <div className="pop-footer__cta">
            {textos.footer_titulo && <p className="pop-footer__titulo">{textos.footer_titulo}</p>}
            <a className="pop-btn pop-btn--claro" href="#pop-menu">{textos.footer_boton || "Hacer mi pedido"} <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <div className="pop-footer__herramientas">
          {instalable && <button type="button" className="pop-footer__tool" onClick={instalar}>Instalar {nombre} en mi celular</button>}
          <button type="button" className="pop-footer__tool" aria-pressed={quieto} onClick={onAlternar}>
            {quieto ? "Reanudar animaciones" : "Pausar animaciones"}
          </button>
        </div>
        <CatalogFooter settings={settings} />
      </div>
    </div>
  );
}
