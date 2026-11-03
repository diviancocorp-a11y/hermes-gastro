import { useState } from 'react';

// Logo del negocio junto al nombre en la topbar. Sale de Personalizacion
// (`settings.logo_url`). Es decorativo (alt vacio): el nombre ya esta al lado.
// Sin logo, o si la imagen no carga, no renderiza nada y queda solo el nombre.
export function LogoNegocio({ url }) {
  // Se guarda QUE url fallo, no un booleano: si Personalizacion cambia el
  // logo, el nuevo se intenta de nuevo sin remontar el componente.
  const [fallida, setFallida] = useState(null);
  const limpia = typeof url === 'string' ? url.trim() : '';
  if (!limpia || fallida === limpia) return null;
  return (
    <img
      className="ag-topbar-logo"
      src={limpia}
      alt=""
      width="28"
      height="28"
      decoding="async"
      onError={() => setFallida(limpia)}
    />
  );
}

// Abre el catalogo publico de este mismo negocio (la raiz del host) en una
// pestania nueva. En movil colapsa a icono; el nombre accesible no cambia.
export function VerCatalogo() {
  return (
    <a
      className="ag-btn-ghost ag-topbar-catalogo"
      href="/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Ver catálogo (se abre en otra pestaña)"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
        strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4h6v6" />
        <path d="M20 4l-9 9" />
        <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
      </svg>
      <span className="ag-topbar-catalogo-texto">Ver catálogo</span>
    </a>
  );
}
