import { useState } from 'react';

// Logo del negocio. Sale de Personalizacion (`settings.logo_url`) y vive en la
// burbuja del perfil, la que abre los negocios. Es decorativo (alt vacio): el
// boton ya tiene su nombre accesible. Sin logo, o si la imagen no carga,
// renderiza `fallback` (las iniciales de la persona).
export function LogoNegocio({ url, className = 'ag-sesion-logo', fallback = null }) {
  // Se guarda QUE url fallo, no un booleano: si Personalizacion cambia el
  // logo, el nuevo se intenta de nuevo sin remontar el componente.
  const [fallida, setFallida] = useState(null);
  const limpia = typeof url === 'string' ? url.trim() : '';
  if (!limpia || fallida === limpia) return fallback;
  return (
    <img
      className={className}
      src={limpia}
      alt=""
      width="32"
      height="32"
      decoding="async"
      onError={() => setFallida(limpia)}
    />
  );
}

/** El catalogo publico de este mismo negocio es la raiz del host. */
export const CATALOGO_HREF = '/';
export const CATALOGO_ARIA = 'Ver catálogo (se abre en otra pestaña)';

export const IconoCatalogo = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);

// Abre el catalogo publico en una pestania nueva. Lo usa la cabecera de
// Productos, que es donde mas se mira el catalogo. En movil colapsa a icono;
// el nombre accesible no cambia.
export function VerCatalogo({ className = 'ag-productos-head-catalogo' }) {
  return (
    <a
      className={className}
      href={CATALOGO_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={CATALOGO_ARIA}
    >
      <IconoCatalogo />
      <span className={`${className}-texto`}>Ver catálogo</span>
    </a>
  );
}
