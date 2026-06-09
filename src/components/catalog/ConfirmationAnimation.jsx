// src/components/catalog/ConfirmationAnimation.jsx
// Pantalla de "pedido confirmado": fondo verde + check que sube de abajo hacia
// arriba y se dibuja. El sonido lo dispara Catalog (public/order-confirmed.mp3).
import business from "@business";

export default function ConfirmationAnimation() {
  const green = "#16A34A";
  return (
    <div
      data-testid="order-confirmation"
      style={{ position: "fixed", inset: 0, background: green, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", zIndex: 250, overflow: "hidden" }}
    >
      <style>{`
        @keyframes hg-check-rise {
          0%   { transform: translateY(110px); opacity: 0; }
          55%  { transform: translateY(-10px); opacity: 1; }
          75%  { transform: translateY(4px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes hg-check-draw { to { stroke-dashoffset: 0; } }
        @keyframes hg-fade-up {
          0%   { transform: translateY(16px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .hg-check-rise { animation: hg-check-rise 0.7s cubic-bezier(0.22,1,0.36,1) forwards; opacity: 0; }
        .hg-check-path { stroke-dasharray: 90; stroke-dashoffset: 90; animation: hg-check-draw 0.4s ease-out 0.45s forwards; }
        .hg-fade-up { animation: hg-fade-up 0.5s ease-out 0.5s forwards; opacity: 0; }
        @media (prefers-reduced-motion: reduce) {
          .hg-check-rise, .hg-fade-up { animation: none !important; opacity: 1 !important; transform: none !important; }
          .hg-check-path { animation: none !important; stroke-dashoffset: 0 !important; }
        }
      `}</style>
      <div className="hg-check-rise" style={{ marginBottom: 28 }}>
        <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden="true">
          <circle cx="74" cy="74" r="66" fill="#fff" />
          <path className="hg-check-path" d="M44,76 L66,98 L104,52" stroke={green} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="hg-fade-up" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, margin: 0, color: "#fff" }}>
        ¡Pedido confirmado!
      </h2>
      <p className="hg-fade-up" style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", marginTop: 8 }}>
        Gracias por elegir {business.name}
      </p>
    </div>
  );
}
