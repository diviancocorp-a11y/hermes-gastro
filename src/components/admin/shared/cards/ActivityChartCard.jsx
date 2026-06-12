// src/components/admin/shared/cards/ActivityChartCard.jsx
// Card "Actividad" con barras animadas escalonadas (jun 2026).
// Diseno adaptado del patron "activity chart card" (shadcn/framer-motion)
// al stack propio: CSS plano con tokens del admin, sin Tailwind ni framer
// (la entrada escalonada de barras se recrea con animation-delay por barra).
//
// A diferencia del original (datos de ejemplo), los datos son REALES:
//   · "Por horas"  — pedidos de HOY agrupados por hora de creacion,
//                    delta vs ayer hasta la misma hora.
//   · "Por días"   — ventas de los ultimos 7 dias, delta vs los 7 previos.
//
// Props:
//   orders — pedidos (created_at, total, status) para el modo horas
//   sales  — ventas (date, total) para el modo dias

import { useMemo, useState, useEffect, useRef } from "react";
import { formatInt, OrderStatus } from "../../../../lib/utils";

const MODES = [
  { key: "hours", label: "Por horas" },
  { key: "days", label: "Por días" },
];

const DAY_INITIALS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function isoLocal(d) {
  // ISO local (no UTC): los dias del negocio son dias locales
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ActivityChartCard({ orders = [], sales = [] }) {
  const [mode, setMode] = useState("hours");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Cerrar el dropdown al tocar fuera
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const data = useMemo(() => {
    const now = new Date();
    if (mode === "hours") {
      const todayIso = isoLocal(now);
      const yest = new Date(now); yest.setDate(yest.getDate() - 1);
      const yestIso = isoLocal(yest);
      const curHour = now.getHours();

      // Ventana 9-23 que se expande si hubo pedidos fuera de ella
      let from = 9, to = 23;
      const buckets = {};
      let yesterdaySoFar = 0;
      (orders || []).forEach((o) => {
        if (o.status === OrderStatus.CANCELLED || o.status === "cancelled") return;
        const ts = o.created_at || "";
        if (!ts) return;
        const d = new Date(ts);
        const dIso = isoLocal(d);
        const h = d.getHours();
        if (dIso === todayIso) {
          buckets[h] = (buckets[h] || 0) + (o.total || 0);
          if (h < from) from = h;
          if (h > to) to = h;
        } else if (dIso === yestIso && h <= curHour) {
          yesterdaySoFar += o.total || 0;
        }
      });
      const bars = [];
      for (let h = from; h <= to; h++) {
        bars.push({ label: String(h), value: buckets[h] || 0 });
      }
      const total = bars.reduce((a, b) => a + b.value, 0);
      const delta = yesterdaySoFar > 0 ? ((total - yesterdaySoFar) / yesterdaySoFar) * 100 : null;
      return { bars, total, delta, deltaLabel: "vs ayer a esta hora", empty: total === 0 ? "Sin pedidos todavía hoy" : null };
    }

    // ── Por días: ultimos 7 dias (ventas) vs 7 previos ──
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      days.push({ iso: isoLocal(d), label: DAY_INITIALS[d.getDay()], value: 0 });
    }
    const firstIso = days[0].iso;
    const prevStart = new Date(now); prevStart.setDate(prevStart.getDate() - 13);
    const prevStartIso = isoLocal(prevStart);
    let prevTotal = 0;
    (sales || []).forEach((s) => {
      const d = (s.date || "").slice(0, 10);
      const hit = days.find((x) => x.iso === d);
      if (hit) hit.value += s.total || 0;
      else if (d >= prevStartIso && d < firstIso) prevTotal += s.total || 0;
    });
    const total = days.reduce((a, b) => a + b.value, 0);
    const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
    return { bars: days, total, delta, deltaLabel: "vs 7 días previos", empty: total === 0 ? "Sin ventas en la semana" : null };
  }, [mode, orders, sales]);

  const max = Math.max(...data.bars.map((b) => b.value), 1);
  const deltaUp = data.delta != null && data.delta >= 0;
  const current = MODES.find((m) => m.key === mode);

  return (
    <div className="ag-card" style={{ padding: "14px 16px 12px" }}>
      {/* ── Header: titulo + selector de rango ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ag-ink)" }}>Actividad</div>
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              border: "1px solid var(--ag-line)", background: "var(--ag-bg-soft)",
              color: "var(--ag-ink-2)", borderRadius: 999, padding: "5px 11px",
              fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {current.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 200ms var(--ag-ease)" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {menuOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20,
              minWidth: 130, padding: 4, borderRadius: 12,
              background: "var(--ag-bg-card)", border: "1px solid var(--ag-line)",
              boxShadow: "var(--ag-sh-lg)",
              animation: "ag-act-pop 180ms var(--ag-ease)",
            }}>
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => { setMode(m.key); setMenuOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", border: 0, borderRadius: 8, padding: "8px 10px",
                    background: m.key === mode ? "var(--ag-bg-soft)" : "transparent",
                    color: "var(--ag-ink)", fontSize: 12, fontWeight: m.key === mode ? 800 : 600,
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}
                >
                  {m.label}
                  {m.key === mode && <span style={{ color: "var(--ag-c-terra)", fontWeight: 900 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Total + barras ── */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
        <div style={{ flexShrink: 0, minWidth: 86 }}>
          <div style={{
            fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em",
            color: "var(--ag-ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1,
          }}>
            ${formatInt(data.total)}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 4, marginTop: 6,
            fontSize: 10.5, fontWeight: 600, color: "var(--ag-ink-3)",
          }}>
            {data.delta != null ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke={deltaUp ? "var(--ag-c-sales)" : "var(--ag-c-orders)"}
                  strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {deltaUp
                    ? <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>
                    : <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>}
                </svg>
                <span style={{ color: deltaUp ? "var(--ag-c-sales)" : "var(--ag-c-orders)", fontWeight: 800 }}>
                  {deltaUp ? "+" : ""}{data.delta.toFixed(0)}%
                </span>
                <span>{data.deltaLabel}</span>
              </>
            ) : (
              <span>{data.empty || "sin período previo"}</span>
            )}
          </div>
        </div>

        {/* key={mode} re-monta las barras → la animacion escalonada se
            re-dispara al cambiar de rango (equivalente al stagger original) */}
        <div
          key={mode}
          aria-label={`Gráfico de actividad ${current.label.toLowerCase()}`}
          style={{ flex: 1, height: 96, display: "flex", alignItems: "flex-end", gap: 4, minWidth: 0 }}
        >
          {data.bars.map((b, i) => (
            <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4, minWidth: 0 }}>
              <div
                title={`${b.label}: $${formatInt(b.value)}`}
                style={{
                  width: "100%", borderRadius: 4,
                  height: `${Math.max((b.value / max) * 100, b.value > 0 ? 6 : 3)}%`,
                  background: b.value > 0 ? "var(--ag-c-terra)" : "var(--ag-bg-soft)",
                  border: b.value > 0 ? "none" : "1px solid var(--ag-line)",
                  animation: `ag-act-bar 500ms var(--ag-ease) ${i * 55}ms backwards`,
                  transformOrigin: "bottom",
                }}
              />
              <span style={{
                fontSize: data.bars.length > 10 ? 8 : 9.5, fontWeight: 600,
                color: "var(--ag-ink-3)", whiteSpace: "nowrap",
                overflow: "hidden", maxWidth: "100%",
              }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
