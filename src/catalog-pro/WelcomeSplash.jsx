// src/catalog-pro/WelcomeSplash.jsx
// Splash de bienvenida con animacion split-door al final.
//
// Tipografia:
//   "Bienvenido a"        color var(--t2)
//   nombre del negocio    color var(--ac)
//
// IMPORTANTE: el wrapper usa className="cp-root cp-surface" para que las
// variables CSS del tema (data-cp-theme="carbon"|"noche"|...) se apliquen.
// Sin esto, caia al fallback de colores antiguos.
import { useEffect, useState } from "react";

export default function WelcomeSplash({ bizName, duration = 1800 }) {
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
      <div className="cp-root cp-surface" style={{
        ...halfBase, left: 0,
        transform: opening ? "translateX(-100%)" : "translateX(0)",
      }} />
      <div className="cp-root cp-surface" style={{
        ...halfBase, right: 0,
        transform: opening ? "translateX(100%)" : "translateX(0)",
      }} />

      <div className="cp-root cp-surface" style={{
        position: "fixed", inset: 0, zIndex: 9001,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 24, pointerEvents: "none",
        background: "transparent",
        opacity: opening ? 0 : 1,
        transition: "opacity 300ms ease",
      }}>
        <div style={{
          fontSize: 15, color: "var(--t2)",
          letterSpacing: "0.04em",
          fontWeight: 500, marginBottom: 8,
          animation: "hg-splash-rise 600ms ease both",
        }}>
          Bienvenido a
        </div>
        <h1 style={{
          fontFamily: "var(--font-heading, 'DM Serif Display', serif)",
          fontSize: 48, lineHeight: 1.1, color: "var(--ac, #D97706)",
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
      `}</style>
    </>
  );
}
