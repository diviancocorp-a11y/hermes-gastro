// src/catalog-pro/ArcLogo.jsx
// Logo central + texto en arco girando alrededor (reutilizable: splash y footer).
//
// v2 (fix jun 2026): la primera version posicionaba caracter por caracter con
// margenes em — con tipografia variable las letras quedaban DESFASADAS.
// Ahora usa SVG <textPath> sobre un circulo con textLength = circunferencia:
// el espaciado lo resuelve el motor SVG y queda perfecto siempre.
// Color: var(--ac) del TEMA (no el color del logo del tenant — en Mala Miga
// el logo es rosa pero el acento del tema ambar es el que tiene que resaltar).
import { useId } from "react";

export default function ArcLogo({
  logoUrl,
  logoColor,
  logoLetter = "",
  bizName = "",
  text = "GRACIAS POR VISITARNOS • GRACIAS POR VISITARNOS • ",
  size = 196,        // diametro total del componente
  logoSize = 96,     // diametro de la burbuja central
  duration = 22,     // segundos por vuelta
}) {
  const uid = useId().replace(/[:]/g, "");
  const pathId = `arc-${uid}`;
  const R = (size / 2) - 10; // radio del circulo de texto (10px de aire al borde)
  const C = 2 * Math.PI * R; // circunferencia exacta -> textLength
  const cx = size / 2;

  return (
    <div style={{
      position: "relative", width: size, height: size,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <style>{`
        @keyframes cp-arclogo-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cp-arclogo-ring { animation: cp-arclogo-spin ${duration}s linear infinite; transform-origin: center; }
        .cp-arclogo-pop { transition: transform 250ms ease; }
        .cp-arclogo-pop:hover { transform: scale(1.08) rotate(4deg); }
        @media (prefers-reduced-motion: reduce) {
          .cp-arclogo-ring { animation: none !important; }
          .cp-arclogo-pop, .cp-arclogo-pop:hover { transform: none !important; }
        }
      `}</style>

      {/* Anillo de texto: textPath sobre circulo, espaciado uniforme garantizado */}
      <svg
        className="cp-arclogo-ring"
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <defs>
          <path
            id={pathId}
            d={`M ${cx},${cx} m -${R},0 a ${R},${R} 0 1,1 ${R * 2},0 a ${R},${R} 0 1,1 -${R * 2},0`}
            fill="none"
          />
        </defs>
        <text style={{
          fontSize: 12.5, fontWeight: 800, letterSpacing: "0.08em",
          fill: "var(--ac, #F59E0B)",
          fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
        }}>
          <textPath href={`#${pathId}`} textLength={C} lengthAdjust="spacingAndGlyphs">
            {text}
          </textPath>
        </text>
      </svg>

      {/* Burbuja central con el logo del tenant */}
      <div className="cp-arclogo-pop" style={{
        width: logoSize, height: logoSize, borderRadius: 999,
        background: "color-mix(in srgb, var(--ac, #F59E0B) 14%, transparent)",
        padding: 8, display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: 999,
          background: logoColor || "var(--ac, #F59E0B)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", color: "#fff",
          fontFamily: "var(--font-heading, 'DM Serif Display', serif)",
          fontSize: logoSize * 0.4,
        }}>
          {logoUrl ? (
            <img src={logoUrl} alt={bizName} loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (logoLetter || bizName.charAt(0) || "").toUpperCase()}
        </div>
      </div>
    </div>
  );
}
