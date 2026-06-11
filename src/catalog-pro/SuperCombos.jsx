// src/catalog-pro/SuperCombos.jsx
// Seccion de combos del home — adaptacion FIEL del connoisseur-stack-interactor
// que paso el user: lista numerada a la izquierda (01/02/03, nombre gigante,
// activo lleno / inactivos con stroke) y a la derecha la foto del combo
// revelada por un clip-path SVG en capas (rebanadas de burger / mosaico /
// grilla) que entran, respiran y salen en loop.
//
// El original usa GSAP; aca el mismo loop (in stagger → breath → out) se hace
// con UN keyframes CSS + animation-delay por capa. Sin dependencias.
//
// Props: combos (mapeados por mapProduct), onSelectProduct, onAddToCart.
import { useEffect, useRef, useState } from "react";
import { SectionHeader } from "./atoms";
import { formatInt } from "../lib/utils";

const ROTATE_MS = 6400;   // = duracion del loop de capas (sincronizados)
const TOUCH_HOLD_MS = 15000;

/* 3 sets de capas para el clipPath (rotan por combo, como el original) */
const CLIP_SETS = [
  // "burger": rebanadas horizontales (paths del TSX original)
  [
    "M480.6,235H19.4c-6,0-10.8-4.9-10.8-10.8v-9.5c0-6,4.9-10.8,10.8-10.8h461.1c6,0,10.8,4.9,10.8,10.8v9.5C491.4,230.2,486.6,235,480.6,235z",
    "M483.1,362.4H16.9c-4.6,0-8.3-3.7-8.3-8.3v-1.8c0-4.6,3.7-8.3,8.3-8.3h466.1c4.6,0,8.3,3.7,8.3,8.3v1.8C491.4,358.7,487.7,362.4,483.1,362.4z",
    "M460.3,336.3H39.7c-17.2,0-31.1-13.9-31.1-31.1v-31.5c0-17.2,13.9-31.1,31.1-31.1h420.7c17.2,0,31.1,13.9,31.1,31.1v31.5C491.4,322.4,477.5,336.3,460.3,336.3z",
    "M459.2,196.2H40.8v-35c0-47.5,38.5-86,86-86h246.5c47.5,0,86,38.5,86,86V196.2z",
    "M441.9,424.9H58.1c-9.6,0-17.3-7.8-17.3-17.3v-37.4h418.5v37.4C459.2,417.1,451.5,424.9,441.9,424.9z",
  ],
  null, // mosaico (rects, se renderiza aparte)
  null, // grilla 3x3 (rects)
];

function ClipShapes({ setIndex, clipId }) {
  const variant = setIndex % 3;
  if (variant === 0) {
    return (
      <clipPath id={clipId}>
        {CLIP_SETS[0].map((d, i) => (
          <path key={i} className="cp-sc-path" style={{ animationDelay: `${i * 0.09}s` }} d={d} />
        ))}
      </clipPath>
    );
  }
  if (variant === 1) {
    const rects = [
      { x: 20, y: 20, w: 200, h: 280 }, { x: 20, y: 320, w: 200, h: 160 },
      { x: 240, y: 20, w: 240, h: 140 }, { x: 240, y: 180, w: 110, h: 160 },
      { x: 370, y: 180, w: 110, h: 160 }, { x: 240, y: 360, w: 240, h: 120 },
    ];
    return (
      <clipPath id={clipId}>
        {rects.map((r, i) => (
          <rect key={i} className="cp-sc-path" style={{ animationDelay: `${i * 0.08}s` }}
            x={r.x} y={r.y} width={r.w} height={r.h} rx="12" />
        ))}
      </clipPath>
    );
  }
  return (
    <clipPath id={clipId}>
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} className="cp-sc-path" style={{ animationDelay: `${(i % 4) * 0.07 + Math.floor(i / 4) * 0.05}s` }}
          x={(i % 3) * 160 + 20} y={Math.floor(i / 3) * 160 + 20} width="140" height="140" rx="4" />
      ))}
    </clipPath>
  );
}

export default function SuperCombos({ combos = [], onSelectProduct, onAddToCart }) {
  const [active, setActive] = useState(0);
  const pauseUntil = useRef(0);

  // Auto-rotacion sincronizada con el loop de capas; pausa tras interaccion
  useEffect(() => {
    if (combos.length < 2) return;
    const t = setInterval(() => {
      if (Date.now() < pauseUntil.current) return;
      setActive((a) => (a + 1) % combos.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [combos.length]);

  if (combos.length === 0) return null;
  const safe = active % combos.length;
  const combo = combos[safe];
  const clipId = `cp-sc-clip-${safe}`;

  const pick = (i) => {
    pauseUntil.current = Date.now() + TOUCH_HOLD_MS;
    setActive(i);
  };

  return (
    <div style={{ padding: "8px 0 26px" }}>
      <SectionHeader kicker="Super Combos" title="Para una mesa" em="completa" />

      <div className="cp-sc-wrap">
        {/* glow acento de fondo */}
        <div aria-hidden style={{
          position: "absolute", inset: "-20%", borderRadius: "50%",
          background: "color-mix(in srgb, var(--ac, #D97706) 9%, transparent)",
          filter: "blur(80px)", pointerEvents: "none",
        }} />

        {/* IZQUIERDA: menu numerado de alto contraste */}
        <nav className="cp-sc-menu">
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 22 }}>
            {combos.map((c, i) => {
              const isActive = i === safe;
              return (
                <li key={c.id} onClick={() => pick(i)}
                  onMouseEnter={() => pick(i)}
                  style={{ cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <span style={{
                    fontSize: 16, fontWeight: 800, marginTop: 4, flexShrink: 0,
                    color: isActive ? "var(--ac, #D97706)" : "rgba(255,255,255,0.35)",
                    transform: isActive ? "scale(1.15)" : "scale(1)",
                    transition: "color 500ms ease, transform 500ms ease",
                  }}>{String(i + 1).padStart(2, "0")}</span>
                  <h3 className={"cp-sc-name" + (isActive ? " is-active" : "")}>
                    {c.name}
                  </h3>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* DERECHA: imagen revelada por capas (remount al cambiar = loop reinicia) */}
        <div className="cp-sc-stage">
          <svg key={safe} viewBox="0 0 500 500" onClick={() => onSelectProduct?.(combo._raw)}
            style={{ width: "100%", maxWidth: 400, height: "auto", cursor: "pointer", filter: "drop-shadow(0 18px 40px rgba(0,0,0,0.45))" }}>
            <defs>
              <ClipShapes setIndex={safe} clipId={clipId} />
            </defs>
            <g clipPath={`url(#${clipId})`}>
              {combo.img ? (
                <image href={combo.img} width="500" height="500" preserveAspectRatio="xMidYMid slice" />
              ) : (
                <>
                  <rect width="500" height="500" fill="color-mix(in srgb, var(--ac, #D97706) 55%, #1a1611)" />
                  <text x="250" y="290" textAnchor="middle" fontSize="140">🛍️</text>
                </>
              )}
            </g>
          </svg>

          {/* precio + agregar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4, width: "100%", maxWidth: 400 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
                {combo.soldOut ? "Agotado" : "Combo completo"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>${formatInt(combo.price)}</div>
            </div>
            <button type="button" disabled={combo.soldOut}
              onClick={() => { pauseUntil.current = Date.now() + TOUCH_HOLD_MS; onAddToCart?.(combo._raw); }}
              style={{
                padding: "11px 22px", borderRadius: 999, border: "none",
                background: combo.soldOut ? "rgba(255,255,255,0.15)" : "var(--ac, #D97706)",
                color: "#fff", fontSize: 14, fontWeight: 700, cursor: combo.soldOut ? "default" : "pointer",
                fontFamily: "inherit", opacity: combo.soldOut ? 0.5 : 1,
              }}>
              + Agregar
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .cp-sc-wrap {
          position: relative; overflow: hidden; margin: 0 16px;
          border-radius: 24px; background: #14100c;
          padding: 26px 22px;
          display: flex; flex-direction: column; gap: 22px;
          isolation: isolate;
        }
        .cp-sc-menu { z-index: 2; }
        .cp-sc-name {
          margin: 0; text-transform: uppercase; letter-spacing: -0.02em;
          font-family: var(--font-heading, 'DM Serif Display', serif);
          font-size: 27px; line-height: 0.95; font-weight: 900;
          transition: color 600ms ease, opacity 600ms ease, transform 600ms ease;
          color: transparent; -webkit-text-stroke: 1.2px rgba(255,255,255,0.3);
          opacity: 0.55; transform: translateX(0);
        }
        .cp-sc-name.is-active {
          color: #fff; -webkit-text-stroke: 0px transparent;
          opacity: 1; transform: translateX(6px);
        }
        .cp-sc-stage {
          z-index: 2; display: flex; flex-direction: column;
          align-items: center; gap: 10px;
        }
        /* Loop de capas (adaptacion del timeline GSAP):
           in expo-out con stagger → respiracion → out → pausa */
        .cp-sc-path {
          transform-box: fill-box; transform-origin: center;
          transform: scale(0);
          animation: cp-sc-loop ${ROTATE_MS}ms cubic-bezier(0.19, 1, 0.22, 1) infinite;
        }
        @keyframes cp-sc-loop {
          0%   { transform: scale(0); }
          11%  { transform: scale(1); }
          32%  { transform: scale(1.05); }
          53%  { transform: scale(1); }
          78%  { transform: scale(1); }
          90%  { transform: scale(0); }
          100% { transform: scale(0); }
        }
        @media (min-width: 760px) {
          .cp-sc-wrap { flex-direction: row; align-items: center; padding: 34px 30px; }
          .cp-sc-menu { width: 46%; }
          .cp-sc-stage { width: 54%; }
          .cp-sc-name { font-size: 36px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cp-sc-path { animation: none; transform: scale(1); }
          .cp-sc-name, .cp-sc-wrap * { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
