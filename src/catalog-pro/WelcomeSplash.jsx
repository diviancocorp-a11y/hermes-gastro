// src/catalog-pro/WelcomeSplash.jsx
// Splash de bienvenida con animacion split-door al final.
// Fases:
//   1. fadeIn (300ms): logo + textos entran con rise
//   2. hold (duration): se muestra estatico
//   3. open (700ms): dos mitades de pantalla se deslizan hacia los lados
//   4. unmount
//
// Tipografia:
//   "Bienvenido a"        color var(--t2)   (subtitulo)
//   nombre del negocio    color var(--ac)   (acento del tema)
// Fondo solido var(--bg) heredado del tema (ambar/noche/carbon).
import { useEffect, useState } from "react";

export default function WelcomeSplash({ bizName, logoUrl, duration = 2200 }) {
  const [phase, setPhase] = useState("hold"); // 'hold' | 'open' | 'done'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("open"), duration);
    const t2 = setTimeout(() => setPhase("done"), duration + 750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration]);

  if (phase === "done") return null;

  const opening = phase === "open";
  const halfBase = {
    position: "fixed", top: 0, height: "100vh", width: "50vw",
    background: "var(--bg, #FBF7F2)", zIndex: 9000,
    transition: "transform 700ms cubic-bezier(0.7, 0, 0.25, 1)",
    willChange: "transform",
  };

  return (
    <>
      {/* Mitad izquierda */}
      <div style={{
        ...halfBase, left: 0,
        transform: opening ? "translateX(-100%)" : "translateX(0)",
      }} />
      {/* Mitad derecha */}
      <div style={{
        ...halfBase, right: 0,
        transform: opening ? "translateX(100%)" : "translateX(0)",
      }} />

      {/* Contenido centrado (logo + textos) por encima de los halves */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9001,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 24, pointerEvents: "none",
        opacity: opening ? 0 : 1,
        transition: "opacity 300ms ease",
      }}>
        {logoUrl && (
          <div style={{
            width: 96, height: 96, borderRadius: 999,
            marginBottom: 22, overflow: "hidden",
            background: "var(--b2)",
            border: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "hg-splash-pop 600ms ease both",
          }}>
            <img src={logoUrl} alt={bizName || "Logo"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div style={{
          fontSize: 15, color: "var(--t2)",
          letterSpacing: "0.04em",
          fontWeight: 500, marginBottom: 8,
          animation: "hg-splash-rise 700ms ease both",
        }}>
          Bienvenido a
        </div>
        <h1 style={{
          fontFamily: "var(--font-heading, 'DM Serif Display', serif)",
          fontSize: 44, lineHeight: 1.1, color: "var(--ac, #D97706)",
          margin: 0, textAlign: "center",
          animation: "hg-splash-rise 700ms ease 120ms both",
        }}>
          {bizName || "tu tienda"}
        </h1>
      </div>

      <style>{`
        @keyframes hg-splash-rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hg-splash-pop {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
