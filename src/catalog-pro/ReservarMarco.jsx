// src/catalog-pro/ReservarMarco.jsx
// Contenedor comun de las dos pantallas de reserva: cp-root (sin esto el tema
// ambar / noche / carbon no llega), cabecera con la vuelta a la tienda y el
// css propio. Tambien se ocupa del tema cuando la clienta entra directo por un
// link (/reservar/turno/...) sin haber pasado por el catalogo.

import { useEffect, useRef } from 'react';
import Icon from './Icon';
import { fetchCatalog } from '../services/catalog';
import { applyTenantHead } from '../lib/tenantHead';
import './tokens.css';
import './reservar.css';

/**
 * Si el tema del negocio todavia no se aplico (primera visita, link directo),
 * lo pide al catalogo. En una visita repetida el anti-flash de index.html ya
 * lo pinto desde el cache, y no hace falta traer productos para nada.
 */
function useTemaDelNegocio() {
  useEffect(() => {
    let cacheado = false;
    try { cacheado = !!localStorage.getItem('cp_theme'); } catch { /* sin storage */ }
    if (cacheado || document.body.hasAttribute('data-cp-theme-listo')) return undefined;
    let vivo = true;
    fetchCatalog()
      .then(d => { if (vivo && d?.settings) applyTenantHead(d.settings); })
      .catch(() => { /* sin tema queda el ambar: la reserva anda igual */ });
    return () => { vivo = false; };
  }, []);
}

export default function ReservarMarco({ titulo, bajada, nombreNegocio, children, atras }) {
  useTemaDelNegocio();
  const h1Ref = useRef(null);

  // Cada pantalla nueva (otro titulo) arranca arriba, con el foco en el h1 y su
  // propio titulo de pestaña: un lector de pantalla anuncia el cambio.
  useEffect(() => {
    if (!titulo) return;
    document.title = nombreNegocio ? `${titulo} · ${nombreNegocio}` : titulo;
    try {
      if (typeof window.scrollTo === 'function' && !/jsdom/i.test(navigator.userAgent)) window.scrollTo(0, 0);
      h1Ref.current?.focus({ preventScroll: true });
    } catch { /* sin scroll */ }
  }, [titulo, nombreNegocio]);
  return (
    <div className="cp-root cp-surface rv">
      <div className="rv-wrap">
        <div className="rv-top">
          {atras ? (
            <button type="button" className="rv-back" onClick={atras.onClick}>
              <Icon name="arrow-left" size={18} /> {atras.texto}
            </button>
          ) : (
            <a className="rv-back" href="/">
              <Icon name="arrow-left" size={18} /> {nombreNegocio ? `Volver a ${nombreNegocio}` : 'Volver'}
            </a>
          )}
        </div>
        {titulo && <h1 className="rv-title" tabIndex={-1} ref={h1Ref}>{titulo}</h1>}
        {bajada && <p className="rv-lede">{bajada}</p>}
        {children}
      </div>
    </div>
  );
}
