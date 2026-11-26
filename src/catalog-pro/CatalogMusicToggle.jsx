// src/catalog-pro/CatalogMusicToggle.jsx
// Boton en el header (al lado de la cuenta) para silenciar/activar la musica.
// Va dentro de cp-root, asi que usa los tokens del tema. Los estilos viven en
// tokens.css (.cp-music) y, para la plantilla pop, en plantilla-pop.css.
import useCatalogMusic from "./useCatalogMusic";

export default function CatalogMusicToggle({ className = "" }) {
  const [on, alternar] = useCatalogMusic();
  return (
    <button
      type="button"
      className={`cp-music ${className}`.trim()}
      data-on={on ? "true" : "false"}
      onClick={alternar}
      aria-pressed={on}
      aria-label={on ? "Silenciar música" : "Activar música"}
      title={on ? "Música del local: tocá para silenciar" : "Música del local: tocá para activar"}
    >
      {on ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 5a9 9 0 0 1 0 14" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </svg>
      )}
    </button>
  );
}
