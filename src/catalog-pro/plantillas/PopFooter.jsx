// src/catalog-pro/plantillas/PopFooter.jsx
// Cierre de UN solo fondo oscuro, sin cajas: marca y lema, instalar la app y pausar
// animaciones, llamada a pedir; debajo, los legales y el contacto del catalogo
// (CatalogFooter plana, con la tipografia de la marca) y la promo de Dico como enlace. WhatsAppFloat lo monta Catalog.
import { useEffect, useState } from "react";
import CatalogFooter from "../CatalogFooter";
import conAcento from "./conAcento";
import useCatalogMusic from "../useCatalogMusic";
import IconoMusica from "../IconoMusica";

// Mismo estado que el boton del header: los dos leen el singleton de catalogMusic.
function HerramientaMusica() {
  const [on, alternar] = useCatalogMusic();
  return (
    <button type="button" className="pop-footer__tool pop-footer__tool--musica" aria-pressed={on} onClick={alternar}>
      <IconoMusica on={on} size={16} />
      Música
    </button>
  );
}

export default function PopFooter({ nombre, logo, textos = {}, settings, quieto, onAlternar, acento = false, musica = false }) {
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
    <footer className="pop-footer">
      <div className="pop-footer__in">
        <div className="pop-footer__cuerpo">
          <div className="pop-footer__marca">
            {logo ? <img className="pop-footer__logo" src={logo} alt={nombre} height="54" loading="lazy" /> : <p className="pop-footer__nombre">{nombre}</p>}
            {textos.footer_lema && <p className="pop-footer__lema">{textos.footer_lema}</p>}
          </div>
          <div className="pop-footer__herramientas">
            {instalable && <button type="button" className="pop-footer__tool" onClick={instalar}>Instalar {nombre} en mi celular</button>}
            {musica && <HerramientaMusica />}
            <button type="button" className="pop-footer__tool" aria-pressed={quieto} onClick={onAlternar}>
              {quieto ? "Reanudar animaciones" : "Pausar animaciones"}
            </button>
          </div>
          <div className="pop-footer__cta">
            {textos.footer_titulo && <p className="pop-footer__titulo">{conAcento(textos.footer_titulo, acento)}</p>}
            <a className="pop-btn pop-btn--claro" href="#pop-menu">{textos.footer_boton || "Hacer mi pedido"} <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <CatalogFooter settings={settings} plana />
      </div>
    </footer>
  );
}
