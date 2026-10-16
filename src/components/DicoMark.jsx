// src/components/DicoMark.jsx
// Marca Dico reutilizable. Renderiza un PNG de /brand/dico/.
// Si la imagen no carga (404), cae al placeholder (inicial).
//
// Props:
//   as:       'logo' (default · la moneda sola, cuadrada) | 'wordmark' (DICO + moneda)
//   size:     altura en px (default 64 para logo, 22 para wordmark)
//   fallback: texto inicial si falla la imagen (default 'D')
//   color:    color del fallback (default oro de marca)

import { useState } from "react";

// La moneda se lee igual sobre fondo claro y oscuro: no cambia con el tema.
const MONEDA = "/brand/dico/dico-2d-neutral.png";

const SRC_DARK_BG = {
  logo: MONEDA,
  wordmark: "/brand/dico/logo/dico-oscuro.png", // letras blancas
};
const SRC_LIGHT_BG = {
  logo: MONEDA,
  wordmark: "/brand/dico/logo/dico-claro.png",  // letras negras
};

export default function DicoMark({
  as = "logo",
  size,
  fallback = "D",
  color = "#E8B947",
  alt = "Dico",
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
