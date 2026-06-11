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
import { supabase } from "../lib/supabase";

/* Contenidos de cada combo (RPC get_combo_contents) → "2× Brownie · 1× Bebida".
   Cache simple en memoria: no cambia durante la sesion. */
let _contentsCache = null;
function useComboContents() {
  const [byCombo, setByCombo] = useState(_contentsCache || {});
  useEffect(() => {
    if (_contentsCache) return;
    let cancel = false;
    supabase.rpc("get_combo_contents").then(({ data, error }) => {
      if (cancel || error || !Array.isArray(data)) return;
      const map = {};
      data.forEach((row) => {
        if (!map[row.combo_id]) map[row.combo_id] = [];
        map[row.combo_id].push(`${Number(row.qty) || 1}× ${row.sub_name}`);
      });
      _contentsCache = map;
      setByCombo(map);
    });
    return () => { cancel = true; };
  }, []);
  return byCombo;
}

const ROTATE_MS = 6400;   // = duracion del loop de capas (sincronizados)
const TOUCH_HOLD_MS = 15000;

/* 3 variantes de reveal (rotan por combo para que se sienta movimiento):
   0 = UN circulo simple, 1 = mosaico, 2 = grilla 3x3 */
function ClipShapes({ setIndex, clipId }) {
  const variant = setIndex % 3;
  if (variant === 0) {
    return (
      <clipPath id={clipId}>
        <circle className="cp-sc-path" cx="250" cy="250" r="240" />
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
  const comboContents = useComboContents();

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
  const contents = comboContents[combo.id] || [];

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
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
                {combo.soldOut ? "Agotado" : "Combo completo"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>${formatInt(combo.price)}</div>
              {/* Descripcion automatica desde las sub-recetas y sus cantidades */}
              {contents.length > 0 && (
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)", marginTop: 3, lineHeight: 1.4 }}>
                  Incluye: {contents.join(" · ")}
                </div>
              )}
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
          /* No pintar/animar fuera de pantalla (WebView de Instagram) */
          content-visibility: auto;
          contain-intrinsic-size: auto 560px;
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
