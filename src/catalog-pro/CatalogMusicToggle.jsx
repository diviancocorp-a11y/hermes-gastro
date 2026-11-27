// src/catalog-pro/CatalogMusicToggle.jsx
// Boton en el header (al lado de la cuenta) para silenciar/activar la musica.
// Va dentro de cp-root, asi que usa los tokens del tema. Los estilos viven en
// tokens.css (.cp-music) y, para la plantilla pop, en plantilla-pop.css.
// Un solo mecanismo de estado: nombre fijo "Música" + aria-pressed (true = suena).
import useCatalogMusic from "./useCatalogMusic";
import IconoMusica from "./IconoMusica";

export default function CatalogMusicToggle({ className = "" }) {
  const [on, alternar] = useCatalogMusic();
  return (
    <button
      type="button"
      className={`cp-music ${className}`.trim()}
      data-on={on ? "true" : "false"}
      onClick={alternar}
      aria-pressed={on}
      aria-label="Música"
      title="Música del local"
    >
      <IconoMusica on={on} />
    </button>
  );
}
