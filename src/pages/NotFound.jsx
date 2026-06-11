// src/pages/NotFound.jsx
// 404 catch-all con la animacion del cavernicola (patron clasico de Dribbble,
// shot 2083086) sobre nuestro stack: CSS plano con tokens del tenant.
//
// ATENCION: el GIF es un hotlink a Dribbble (obra de tercero). Riesgos:
// puede caerse y es legalmente gris para un producto comercial. Si no carga,
// cae automatico al fallback con emoji (onError). Pendiente en
// TAREAS-MANUALES.md: reemplazar por un asset propio.
import { useState } from "react";
import { Link } from "react-router-dom";

const CAVEMAN_GIF = "https://cdn.dribbble.com/users/285475/screenshots/2083086/dribbble_1.gif";

export default function NotFound() {
  const [gifFailed, setGifFailed] = useState(false);

  return (
    <section className="cp-root" style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg, #FFF8F0)", color: "var(--tx, #2D1B0E)",
      padding: 24, textAlign: "center",
    }}>
      <style>{`
        @keyframes nf-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nf-illu { animation: none !important; }
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: 560 }}>
        {!gifFailed ? (
          <div style={{ position: "relative" }}>
            {/* Tarjeta blanca: el GIF tiene fondo blanco propio — asi queda
                intencional tambien en los temas oscuros (noche/carbon) */}
            <div style={{
              background: "#fff", borderRadius: 18, overflow: "hidden",
              boxShadow: "0 6px 24px rgba(0,0,0,0.10)",
            }}>
              <h1 style={{
                fontSize: "clamp(56px, 14vw, 84px)", fontWeight: 800,
                lineHeight: 1, margin: 0, paddingTop: 18,
                fontFamily: "var(--font-heading, 'DM Sans', sans-serif)",
                color: "#2D1B0E", letterSpacing: "-0.03em", userSelect: "none",
              }}>
                404
              </h1>
              <img
                src={CAVEMAN_GIF}
                alt="Cavernícola buscando la página perdida"
                onError={() => setGifFailed(true)}
                style={{
                  display: "block", width: "100%",
                  height: "clamp(220px, 45vw, 320px)",
                  objectFit: "contain", marginTop: -10,
                }}
              />
            </div>
          </div>
        ) : (
          /* Fallback si Dribbble no responde: numero gigante + emoji flotante */
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
        )}

        <div style={{ marginTop: gifFailed ? 0 : 22 }}>
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
      </div>
    </section>
  );
}
