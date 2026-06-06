// src/catalog-pro/GooeyText.jsx
// Efecto de texto "gooey morphing": entre cada palabra del array hace un blur
// + threshold filter que las une como gotas de mercurio mientras transicionan.
//
// Port JS puro (sin TS/Tailwind/shadcn) del component original.
// Uso:
//   <GooeyText texts={["Bienvenido", "a tu lugar", "Mala Miga"]} morphTime={1} cooldownTime={0.6} />
import { useEffect, useRef } from "react";

export default function GooeyText({
  texts = [],
  morphTime = 1,
  cooldownTime = 0.6,
  style,
  fontSize = 38,
}) {
  const text1Ref = useRef(null);
  const text2Ref = useRef(null);
  const stateRef = useRef({ raf: null });

  useEffect(() => {
    if (!texts.length) return;
    let textIndex = texts.length - 1;
    let lastTime = performance.now();
    let morph = 0;
    let cooldown = cooldownTime;

    const setMorph = (frac) => {
      const t1 = text1Ref.current, t2 = text2Ref.current;
      if (!t1 || !t2) return;
      t2.style.filter = `blur(${Math.min(8 / frac - 8, 100)}px)`;
      t2.style.opacity = `${Math.pow(frac, 0.4) * 100}%`;
      const inv = 1 - frac;
      t1.style.filter = `blur(${Math.min(8 / inv - 8, 100)}px)`;
      t1.style.opacity = `${Math.pow(inv, 0.4) * 100}%`;
    };

    const doCooldown = () => {
      morph = 0;
      const t1 = text1Ref.current, t2 = text2Ref.current;
      if (!t1 || !t2) return;
      t2.style.filter = "";
      t2.style.opacity = "100%";
      t1.style.filter = "";
      t1.style.opacity = "0%";
    };

    const doMorph = () => {
      morph -= cooldown;
      cooldown = 0;
      let frac = morph / morphTime;
      if (frac > 1) { cooldown = cooldownTime; frac = 1; }
      setMorph(frac);
    };

    const tick = () => {
      stateRef.current.raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const wasCooling = cooldown > 0;
      cooldown -= dt;
      if (cooldown <= 0) {
        if (wasCooling) {
          textIndex = (textIndex + 1) % texts.length;
          if (text1Ref.current && text2Ref.current) {
            text1Ref.current.textContent = texts[textIndex % texts.length];
            text2Ref.current.textContent = texts[(textIndex + 1) % texts.length];
          }
        }
        doMorph();
      } else {
        doCooldown();
      }
    };

    tick();
    return () => {
      if (stateRef.current.raf) cancelAnimationFrame(stateRef.current.raf);
    };
  }, [texts, morphTime, cooldownTime]);

  // Filtro SVG: combina blur + threshold para el efecto gooey.
  // El id incluye un nonce para no chocar si hay 2 instancias en la misma pagina.
  const filterId = useRef(`gooey-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <div style={{ position: "relative", textAlign: "center", ...style }}>
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          filter: `url(#${filterId})`,
          minHeight: fontSize * 1.3,
        }}
      >
        <span
          ref={text1Ref}
          style={{
            position: "absolute", display: "inline-block", userSelect: "none",
            textAlign: "center", fontSize, lineHeight: 1.15,
            fontFamily: "var(--font-heading, 'DM Serif Display', serif)",
            color: "var(--tx, #2D1B0E)", whiteSpace: "nowrap",
          }}
        />
        <span
          ref={text2Ref}
          style={{
            position: "absolute", display: "inline-block", userSelect: "none",
            textAlign: "center", fontSize, lineHeight: 1.15,
            fontFamily: "var(--font-heading, 'DM Serif Display', serif)",
            color: "var(--tx, #2D1B0E)", whiteSpace: "nowrap",
          }}
        />
      </div>
    </div>
  );
}
