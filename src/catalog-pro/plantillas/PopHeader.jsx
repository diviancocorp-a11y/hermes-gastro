// src/catalog-pro/plantillas/PopHeader.jsx
// Barra de anuncios + header con nav y boton de pedido.
import PrecioCatalogo from "./PrecioCatalogo";

const ETIQUETAS = { favoritos: "Favoritos", flyers: "Novedades", menu: "Menú", historia: "Nosotros" };

function IconoBolsa() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" />
    </svg>
  );
}

export default function PopHeader({ nombre, logo, letra, anuncios = [], ids = [], cartCount, cartTotal, moneda, onOpenCart }) {
  const enlaces = ids.filter((id) => ETIQUETAS[id]);
  return (
    <>
      {anuncios.length > 0 && (
        <div className="pop-anuncios" role="region" aria-label="Anuncios">
          <ul className="pop-anuncios__lista">
            {anuncios.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
      <header className="pop-header">
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
      </header>
    </>
  );
}
