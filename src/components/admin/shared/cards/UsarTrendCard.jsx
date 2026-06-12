// src/components/admin/shared/cards/UsarTrendCard.jsx
// Card de tendencia mensual con movimiento de "reveal" al hover/touch
// (jun 2026). Diseno adaptado del patron "animated card + visual" al
// stack propio: CSS plano con tokens del admin, sin Tailwind/clsx.
//
// Movimiento (distinto al AnimatedStatCard de resaltado):
//   · Las barras (pares ventas/gastos por dia) estan en una capa al 200%
//     de ancho: en reposo se ve la 1ra quincena, al activar se desliza
//     y muestra la 2da.
//   · La linea de margen acumulado esta tapada por un degradado que se
//     corre hacia la derecha al activar (reveal progresivo).
//   · La leyenda se desvanece y baja un tooltip con datos REALES
//     (mejor dia + margen del mes).
//
// Props:
//   sales    — ventas del mes [{ date, total }]
//   expenses — gastos del mes [{ date, amount }]
//   year, month — mes mostrado (month 1-12) para saber cuantos dias tiene

import { useMemo, useState } from "react";
import { formatInt } from "../../../../lib/utils";

const EASE = "cubic-bezier(0.6, 0.6, 0, 1)";

export default function UsarTrendCard({
  sales = [],
  expenses = [],
  year,
  month,
  mainColor = "var(--ag-c-sales)",
  secondaryColor = "var(--ag-c-stock)",
}) {
  const [active, setActive] = useState(false);

  const { pairs, linePts, areaPts, bestDay, marginTotal } = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const vByDay = Array(daysInMonth).fill(0);
    const gByDay = Array(daysInMonth).fill(0);
    sales.forEach((s) => {
      const d = Number((s.date || "").slice(8, 10)) - 1;
      if (d >= 0 && d < daysInMonth) vByDay[d] += s.total || 0;
    });
    expenses.forEach((e) => {
      const d = Number((e.date || "").slice(8, 10)) - 1;
      if (d >= 0 && d < daysInMonth) gByDay[d] += e.amount || 0;
    });

    // ── Barras: pares (venta, gasto) por dia sobre lienzo 712x180 (200%) ──
    const W2 = 712, H = 180, top = 28;
    const maxBar = Math.max(...vByDay, ...gByDay, 1);
    const slot = W2 / daysInMonth;
    const barW = Math.min(slot * 0.32, 11);
    const out = [];
    for (let d = 0; d < daysInMonth; d++) {
      const x0 = d * slot + slot * 0.14;
      const hV = (vByDay[d] / maxBar) * (H - top - 6);
      const hG = (gByDay[d] / maxBar) * (H - top - 6);
      out.push({ x: x0, y: H - Math.max(hV, 2), w: barW, h: Math.max(hV, 2), kind: "v", day: d + 1 });
      out.push({ x: x0 + barW + 2, y: H - Math.max(hG, 2), w: barW, h: Math.max(hG, 2), kind: "g", day: d + 1 });
    }

    // ── Linea: margen acumulado (ventas - gastos) sobre lienzo 356x180 ──
    const cum = [];
    let acc = 0;
    for (let d = 0; d < daysInMonth; d++) { acc += vByDay[d] - gByDay[d]; cum.push(acc); }
    const minC = Math.min(...cum, 0), maxC = Math.max(...cum, 1);
    const span = maxC - minC || 1;
    const W = 356;
    const pts = cum.map((v, i) => {
      const x = (i / Math.max(daysInMonth - 1, 1)) * W;
      const y = 14 + (1 - (v - minC) / span) * (H - 28);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    let bIdx = -1;
    vByDay.forEach((v, i) => { if (v > 0 && (bIdx === -1 || v > vByDay[bIdx])) bIdx = i; });

    return {
      pairs: out,
      linePts: pts.join(" "),
      areaPts: `0,${H} ${pts.join(" ")} ${W},${H}`,
      bestDay: bIdx >= 0 ? { day: bIdx + 1, value: vByDay[bIdx] } : null,
      marginTotal: acc,
    };
  }, [sales, expenses, year, month]);

  return (
    <div
      className="ag-card"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onTouchStart={() => setActive((a) => !a)}
      style={{ padding: 0, overflow: "hidden", position: "relative" }}
    >
      {/* ════ Visual (180px) ════ */}
      <div aria-hidden="true" style={{ position: "relative", height: 180, overflow: "hidden" }}>
        {/* Capa 1 · barras al 200%: desliza de 1ra a 2da quincena */}
        <div style={{
          position: "absolute", top: 0, left: 0, zIndex: 6, width: "200%", height: "100%",
          transform: active ? "translateX(-50%)" : "translateX(0)",
          transition: `transform 600ms ${EASE}`,
        }}>
          <svg width="100%" height="100%" viewBox="0 0 712 180" preserveAspectRatio="none">
            {pairs.map((b, i) => (
              <rect
                key={i}
                x={b.x} y={b.y} width={b.w} height={b.h} rx={2}
                fill={b.kind === "v" ? mainColor : secondaryColor}
                opacity={b.h > 2 ? 0.9 : 0.25}
              />
            ))}
          </svg>
        </div>

        {/* Capa 2 · linea de margen acumulado + reveal que se corre */}
        <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
          <svg width="100%" height="100%" viewBox="0 0 356 180" preserveAspectRatio="none">
            <polygon points={areaPts} fill={mainColor} opacity="0.16" />
            <polyline points={linePts} fill="none" stroke={mainColor} strokeWidth="1.6" />
          </svg>
          <div style={{
            position: "absolute", inset: 0, zIndex: 3,
            background: "linear-gradient(to right, transparent 0%, var(--ag-bg-card) 15%)",
            transform: active ? "translateX(100%)" : "translateX(0)",
            transition: `transform 600ms ${EASE}`,
          }} />
        </div>

        {/* Tinte radial + grilla (como el resto de cards animados) */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none",
          background: `radial-gradient(ellipse 55% 55% at 50% 55%, color-mix(in srgb, ${mainColor} 14%, transparent), transparent 80%)`,
        }} />
        <div style={{
          position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none", opacity: 0.7,
          backgroundImage: "linear-gradient(to right, var(--ag-line) 1px, transparent 1px), linear-gradient(to bottom, var(--ag-line) 1px, transparent 1px)",
          backgroundSize: "20px 20px", backgroundPosition: "center",
          maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 60%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 60%, transparent 100%)",
        }} />

        {/* Capa 3 · leyenda (se desvanece al activar) */}
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 8,
          display: "flex", gap: 5,
          opacity: active ? 0 : 1, transition: `opacity 300ms ease-in-out`,
        }}>
          {[{ c: mainColor, t: "Ventas" }, { c: secondaryColor, t: "Gastos" }].map((l) => (
            <div key={l.t} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 999,
              background: "color-mix(in srgb, var(--ag-bg-card) 60%, transparent)",
              border: "1px solid var(--ag-line)", backdropFilter: "blur(4px)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: l.c }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ag-ink)" }}>{l.t}</span>
            </div>
          ))}
        </div>

        {/* Capa 4 · tooltip que baja al activar (datos reales) */}
        <div style={{
          position: "absolute", top: 0, left: 0, zIndex: 7, padding: 12,
          transform: active ? "translateY(0)" : "translateY(-110%)",
          transition: `transform 600ms ${EASE}`,
        }}>
          <div style={{
            padding: "7px 10px", borderRadius: 10,
            background: "color-mix(in srgb, var(--ag-bg-card) 72%, transparent)",
            border: "1px solid var(--ag-line)", backdropFilter: "blur(6px)",
            opacity: active ? 1 : 0, transition: `opacity 500ms ${EASE}`,
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ag-ink)", marginBottom: 2 }}>
              Margen acumulado: {marginTotal < 0 ? "-" : ""}${formatInt(Math.abs(marginTotal))}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)" }}>
              {bestDay
                ? `Mejor día: ${String(bestDay.day).padStart(2, "0")} · $${formatInt(bestDay.value)} — deslizado a la 2da quincena`
                : "Sin ventas registradas este mes"}
            </div>
          </div>
        </div>
      </div>

      {/* ════ Body ════ */}
      <div style={{ borderTop: "1px solid var(--ag-line)", padding: "12px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ag-ink)" }}>
          Ventas vs gastos · día a día
        </div>
        <div style={{ fontSize: 11, color: "var(--ag-ink-3)", marginTop: 2 }}>
          La línea es el margen acumulado. Tocá para deslizar a la 2da quincena.
        </div>
      </div>
    </div>
  );
}
