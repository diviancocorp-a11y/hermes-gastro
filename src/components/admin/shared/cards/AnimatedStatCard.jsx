// src/components/admin/shared/cards/AnimatedStatCard.jsx
// Card de metrica con grafico de barras animado al hover (jun 2026).
// Diseno adaptado del patron "animated card chart" al stack propio:
// CSS plano con tokens del admin, sin Tailwind/clsx/tailwind-merge.
// A diferencia del original (datos random), las barras son DATOS REALES
// y el hover resalta los dias por encima del promedio + muestra el mejor dia.
//
// Props:
//   title        — titulo del card ("Ingresos del mes")
//   description  — subtitulo corto
//   value        — valor principal ya formateado ("$1.234.567")
//   deltaPct     — variacion % vs periodo anterior (null = no mostrar badge)
//   bars         — [{ label, value }] serie diaria/semanal REAL
//   mainColor    — color principal (token CSS), default verde ventas
//   secondaryColor — color de resaltado hover, default ambar stock

import { useMemo, useState } from "react";
import { formatInt } from "../../../../lib/utils";

const EASE = "cubic-bezier(0.6, 0.6, 0, 1)";

export default function AnimatedStatCard({
  title,
  description,
  value,
  deltaPct = null,
  bars = [],
  mainColor = "var(--ag-c-sales)",
  secondaryColor = "var(--ag-c-stock)",
}) {
  const [hovered, setHovered] = useState(false);

  const { norm, avg, best } = useMemo(() => {
    const vals = bars.map(b => Number(b.value) || 0);
    const max = Math.max(...vals, 1);
    const avgV = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
    let bestIdx = -1;
    vals.forEach((v, i) => { if (v > 0 && (bestIdx === -1 || v > vals[bestIdx])) bestIdx = i; });
    return {
      norm: bars.map((b, i) => ({ ...b, h: (Number(b.value) || 0) / max })),
      avg: avgV / max,
      best: bestIdx >= 0 ? bars[bestIdx] : null,
    };
  }, [bars]);

  const VIS_H = 130;
  const deltaUp = deltaPct != null && deltaPct >= 0;

  return (
    <div
      className="ag-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(h => !h)}
      style={{ padding: 0, overflow: "hidden", position: "relative" }}
    >
      {/* ── Visual: grilla + tinte radial + barras reales ── */}
      <div style={{
        position: "relative", height: VIS_H, overflow: "hidden",
        backgroundImage: "linear-gradient(to right, var(--ag-line) 1px, transparent 1px), linear-gradient(to bottom, var(--ag-line) 1px, transparent 1px)",
        backgroundSize: "20px 20px", backgroundPosition: "center",
      }}>
        {/* Tinte radial suave del color principal */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 60% 70% at 50% 60%, color-mix(in srgb, ${mainColor} 18%, transparent), transparent 75%)`,
          pointerEvents: "none",
        }} />

        {/* Badge de variacion vs periodo anterior (real) */}
        {deltaPct != null && (
          <div style={{
            position: "absolute", top: 10, left: 10, zIndex: 3,
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 999,
            background: "var(--ag-bg)", border: "1px solid var(--ag-line)",
            fontSize: 10.5, fontWeight: 800,
            color: deltaUp ? "var(--ag-c-sales)" : "var(--ag-c-orders)",
            opacity: hovered ? 0 : 1, transition: `opacity 400ms ${EASE}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
            {deltaUp ? "+" : ""}{deltaPct.toFixed(1)}% vs anterior
          </div>
        )}

        {/* Barras (flexbox, transicion de alto/color) */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", alignItems: "flex-end", gap: 3,
          padding: "26px 14px 10px",
          transform: hovered ? "scale(1.06)" : "scale(1)",
          transformOrigin: "bottom center",
          transition: `transform 500ms ${EASE}`,
        }}>
          {norm.map((b, i) => {
            const aboveAvg = b.h >= avg && b.value > 0;
            const hPct = Math.max(b.h * 100, b.value > 0 ? 6 : 2);
            return (
              <div
                key={i}
                title={`${b.label}: $${formatInt(b.value)}`}
                style={{
                  flex: 1, borderRadius: 3,
                  height: `${hPct}%`,
                  background: hovered && aboveAvg ? secondaryColor : mainColor,
                  opacity: b.value > 0 ? (hovered ? 0.95 : 0.8) : 0.18,
                  transition: `height 500ms ${EASE}, background 500ms ${EASE}, opacity 500ms ${EASE}`,
                }}
              />
            );
          })}
        </div>

        {/* Tooltip que sube al hover: mejor dia (real) */}
        {best && (
          <div style={{
            position: "absolute", left: 10, bottom: 10, zIndex: 3,
            padding: "6px 10px", borderRadius: 8,
            background: "var(--ag-bg)", border: "1px solid var(--ag-line)",
            transform: hovered ? "translateY(0)" : "translateY(140%)",
            opacity: hovered ? 1 : 0,
            transition: `transform 500ms ${EASE}, opacity 400ms ${EASE}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--ag-ink)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: secondaryColor }} />
              Mejor día: {best.label}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", marginTop: 1 }}>
              ${formatInt(best.value)} · resaltados = sobre el promedio
            </div>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ borderTop: "1px solid var(--ag-line)", padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ag-ink)" }}>{title}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: mainColor, fontVariantNumeric: "tabular-nums", fontFamily: "'DM Sans', sans-serif" }}>
            {value}
          </div>
        </div>
        {description && (
          <div style={{ fontSize: 11, color: "var(--ag-ink-3)", marginTop: 2 }}>{description}</div>
        )}
      </div>
    </div>
  );
}
