// src/catalog-pro/CatalogMusicToggle.jsx
// Boton flotante para silenciar/activar la musica ambiente del catalogo.
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
        position: "fixed", left: 16, bottom: 18, zIndex: 60,
        width: 42, height: 42, borderRadius: "50%",
        background: "rgba(20,20,20,0.55)", color: "#fff",
        border: "1px solid rgba(255,255,255,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 0, backdropFilter: "blur(4px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      }}
    >
      {on ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 5a9 9 0 0 1 0 14" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </svg>
      )}
    </button>
  );
}
