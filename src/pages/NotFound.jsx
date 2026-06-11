// src/pages/NotFound.jsx
// 404 catch-all (Sprint 4, redisenado post-4).
// Diseno adaptado del patron "404 page" clasico (numero gigante + ilustracion
// + CTA) pero con NUESTRO stack: CSS plano con tokens de tema por tenant,
// sin Tailwind/shadcn (el proyecto es JS puro a proposito, ver CLAUDE.md)
// y sin assets externos hotlinkeados (ilustracion inline).
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="cp-root" style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg, #FFF8F0)", color: "var(--tx, #2D1B0E)",
      padding: 24, textAlign: "center",
    }}>
      {/* keyframes locales del 404 (flotar suave de la ilustracion) */}
      <style>{`
        @keyframes nf-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nf-illu { animation: none !important; }
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Numero gigante con ilustracion flotante */}
        <div style={{ position: "relative", marginBottom: 8 }}>
          <h1 aria-hidden="true" style={{
            fontSize: "clamp(96px, 28vw, 160px)",
            fontWeight: 800, lineHeight: 1, margin: 0,
            fontFamily: "var(--font-heading, 'DM Sans', sans-serif)",
            color: "var(--ac, #C45D3E)", opacity: 0.18,
            letterSpacing: "-0.04em", userSelect: "none",
          }}>
            404
          </h1>
          <div className="nf-illu" style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "clamp(48px, 14vw, 84px)",
            animation: "nf-float 3.5s ease-in-out infinite",
          }}>
            <span role="img" aria-label="Plato vacío con lupa">🍽️🔍</span>
          </div>
        </div>

        <h2 style={{
          fontSize: 24, fontWeight: 800, margin: "0 0 10px",
          fontFamily: "var(--font-heading, inherit)",
        }}>
          Parece que te perdiste
        </h2>
        <p style={{
          fontSize: 14.5, color: "var(--t2, #6b5d4f)",
          margin: "0 auto 26px", maxWidth: 320, lineHeight: 1.55,
        }}>
          La página que buscás no existe o el enlace venció.
          Pero la comida sigue estando donde siempre.
        </p>

        <Link to="/" style={{
          display: "inline-block",
          padding: "13px 32px", borderRadius: 999,
          background: "var(--ac, #C45D3E)", color: "#fff",
          textDecoration: "none", fontWeight: 700, fontSize: 15,
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        }}>
          Volver al catálogo
        </Link>
      </div>
    </section>
  );
}
