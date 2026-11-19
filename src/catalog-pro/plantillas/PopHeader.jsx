// src/catalog-pro/plantillas/PopHeader.jsx
// Barra de anuncios + header con nav y boton de pedido.
import { useEffect, useRef, useState } from "react";
import PrecioCatalogo from "./PrecioCatalogo";
import PopAnuncios from "./PopAnuncios";

const ETIQUETAS = { favoritos: "Favoritos", flyers: "Novedades", menu: "Menú", historia: "Nosotros" };

function IconoBolsa() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" />
    </svg>
  );
}

export default function PopHeader({ nombre, logo, letra, anuncios = [], ids = [], cartCount, cartTotal, moneda, onOpenCart, acentoAnuncios = false }) {
  const enlaces = ids.filter((id) => ETIQUETAS[id]);
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef(null);
  const cabeceraRef = useRef(null);
  // Linea de progreso de lectura: la hoja dibuja la raya con --sp (0 a 1).
  useEffect(() => {
    const el = cabeceraRef.current;
    if (!el) return undefined;
    let raf = 0;
    const pintar = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.setProperty("--sp", String(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0));
    };
    const alScroll = () => { if (!raf) raf = requestAnimationFrame(pintar); };
    pintar();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll);
    return () => { window.removeEventListener("scroll", alScroll); window.removeEventListener("resize", alScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => { if (e.key === "Escape") { setAbierto(false); botonRef.current?.focus(); } };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);
  return (
    <>
      <PopAnuncios frases={anuncios} acento={acentoAnuncios} />
      <header className="pop-header" ref={cabeceraRef}>
        <a className="pop-header__marca" href="#pop-inicio" aria-label={`${nombre}, ir al inicio`}>
          {logo
            ? <img src={logo} alt="" height="36" className="pop-header__logo" />
            : <span className="pop-header__letra" aria-hidden="true">{letra}</span>}
          {!logo && <span className="pop-header__nombre">{nombre}</span>}
        </a>
        <nav className="pop-nav" aria-label="Secciones">
          {enlaces.map((id) => <a key={id} href={`#pop-${id}`}>{ETIQUETAS[id]}</a>)}
        </nav>
        <button type="button" className="pop-btn pop-btn--primario pop-header__pedido" onClick={onOpenCart}>
          <IconoBolsa />
          <span>Mi pedido</span>
          {cartCount > 0 && <span className="pop-header__cuenta" aria-label={`${cartCount} en el pedido`}>{cartCount}</span>}
          {cartCount > 0 && <span className="pop-header__total"><PrecioCatalogo monto={cartTotal} moneda={{ ...moneda, secundaria: null }} /></span>}
        </button>
        {enlaces.length > 0 && (
          <button ref={botonRef} type="button" className="pop-header__menu" aria-expanded={abierto} aria-controls="pop-nav-movil" aria-label={abierto ? "Cerrar el menú" : "Abrir el menú"} onClick={() => setAbierto((v) => !v)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {abierto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        )}
        {abierto && (
          <nav className="pop-nav-movil" id="pop-nav-movil" aria-label="Secciones">
            {enlaces.map((id) => <a key={id} href={`#pop-${id}`} onClick={() => setAbierto(false)}>{ETIQUETAS[id]}</a>)}
          </nav>
        )}
      </header>
    </>
  );
}
