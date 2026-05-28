// src/components/HermesMark.jsx
// Marca Hermes Gastro reutilizable. Renderiza el PNG de /brand/.
// Si la imagen no carga (404), cae al placeholder (inicial del negocio).
//
// Props:
//   as:       'logo' (default · ícono + nombre) | 'wordmark' (solo nombre)
//   size:     altura en px (default 64 para logo, 22 para wordmark)
//   fallback: texto inicial si falla la imagen (default 'H')
//   color:    color del fallback (default ámbar)

import { useState } from "react";

const SRC = {
  logo: "/brand/hermes-logo.png",
  wordmark: "/brand/hermes-wordmark.png",
};

export default function HermesMark({
  as = "logo",
  size,
  fallback = "H",
  color = "#F59E0B",
  alt = "Hermes Gastro",
  style = {},
}) {
  const [broken, setBroken] = useState(false);
  const h = size ?? (as === "wordmark" ? 22 : 64);
  const src = SRC[as] || SRC.logo;

  if (broken) {
    // Fallback discreto: cuadrado redondeado con inicial
    return (
      <div
        aria-label={alt}
        style={{
          width: h, height: h, borderRadius: Math.max(8, h * 0.22),
          background: color, color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: h * 0.5, fontWeight: 800,
          fontFamily: "system-ui, -apple-system, sans-serif",
          ...style,
        }}
      >
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      style={{
        height: h,
        width: "auto",
        display: "inline-block",
        objectFit: "contain",
        ...style,
      }}
    />
  );
}
