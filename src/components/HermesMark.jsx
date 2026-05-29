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

const SRC_DARK_BG = {
  logo: "/brand/hermes-logo.png",        // contraste para fondos oscuros (página 5 ámbar)
  wordmark: "/brand/hermes-wordmark.png",
};
const SRC_LIGHT_BG = {
  logo: "/brand/hermes-logo-on-light.png", // contraste para fondos claros (página 4 negro)
  wordmark: "/brand/hermes-wordmark.png",  // mismo (runner ámbar funciona en ambos)
};

export default function HermesMark({
  as = "logo",
  size,
  fallback = "H",
  color = "#F59E0B",
  alt = "Hermes Gastro",
  style = {},
  theme = "dark", // "dark" = fondo oscuro (default); "light" = fondo claro
}) {
  const [broken, setBroken] = useState(false);
  const h = size ?? (as === "wordmark" ? 22 : 64);
  const srcSet = theme === "light" ? SRC_LIGHT_BG : SRC_DARK_BG;
  const src = srcSet[as] || srcSet.logo;

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
