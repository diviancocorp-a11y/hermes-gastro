// src/catalog-pro/CatalogMusicToggle.jsx
// Boton en el header (al lado de la cuenta) para silenciar/activar la musica.
// Va dentro de cp-root, asi que usa los tokens del tema.
import { useEffect, useState } from "react";
import { ensureMusic, toggleMusic, musicOn, subscribeMusic } from "./catalogMusic";

export default function CatalogMusicToggle() {
  const [on, setOn] = useState(musicOn());
  useEffect(() => {
    ensureMusic();
    setOn(musicOn());
    return subscribeMusic(setOn);
  }, []);
  return (
    <button
      type="button"
      onClick={() => setOn(toggleMusic())}
      aria-label={on ? "Silenciar musica" : "Activar musica"}
      title={on ? "Musica del local: tocá para silenciar" : "Musica del local: tocá para activar"}
      style={{
        width: 38, height: 38, borderRadius: 999,
        background: "transparent", border: "1px solid var(--line)",
        color: on ? "var(--tx)" : "var(--t3)", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, padding: 0,
      }}
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
