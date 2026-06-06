// src/catalog-pro/WelcomeSplash.jsx
// Splash de bienvenida que reemplaza al CatalogSkeleton.
// Aparece arriba del catalogo durante el primer load con un fadein/fadeout.
//
// Props:
//   bizName: nombre del negocio (de settings.biz_name)
//   logoUrl?: si hay, se muestra arriba del texto
//   show: boolean, controla visibilidad
import { useEffect, useState } from "react";
import GooeyText from "./GooeyText";

export default function WelcomeSplash({ bizName, logoUrl, duration = 1800 }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Empezar fade out 400ms antes del fin
    const t1 = setTimeout(() => setFading(true), Math.max(0, duration - 400));
    const t2 = setTimeout(() => setVisible(false), duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "color-mix(in srgb, var(--bg, #FBF7F2) 88%, transparent)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 24,
        opacity: fading ? 0 : 1,
        transition: "opacity 400ms ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <GooeyText
        texts={["Bienvenido a", bizName || "tu tienda"]}
        morphTime={1.4}
        cooldownTime={1.4}
        fontSize={64}
        style={{ width: "100%", maxWidth: 520 }}
      />
      <style>{`
        @keyframes hg-splash-rise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hg-splash-pop {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
