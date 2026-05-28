// src/catalog-pro/OrdersScreen.jsx
// Pantalla Pedidos: tabs Activos / Anteriores.
// Activo: progress 4 segmentos + código + CTA seguimiento.
// Anterior: badge entregado + fecha + total + "Ver pedido".
//
// Props: loadOrders() => Promise<order[]>, onBack, onTrack(id), bottomNav (node)

import { useState, useEffect } from "react";
import Icon from "./Icon";
import { fmtAR } from "./format";

const STATUS_STEPS = ["received", "preparing", "ready", "completed"];
const STATUS_LABEL = { received: "Recibido", preparing: "Preparando", ready: "Listo", completed: "Entregado" };

function progressOf(status) {
  const i = STATUS_STEPS.indexOf(status);
  return i < 0 ? 0 : i;
}
function isActive(o) {
  return o.status !== "completed" && o.status !== "cancelled" && o.status !== "delivered";
}
function relDate(str) {
  if (!str) return "";
  const d = new Date(str);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default function OrdersScreen({ loadOrders, onBack, onTrack, bottomNav }) {
  const [tab, setTab] = useState("active");
  const [orders, setOrders] = useState(null); // null=loading

  useEffect(() => {
    let mounted = true;
    Promise.resolve(loadOrders?.()).then(list => { if (mounted) setOrders(list || []); });
    return () => { mounted = false; };
  }, [loadOrders]);

  const active = (orders || []).filter(isActive);
  const past = (orders || []).filter(o => !isActive(o));
  const list = tab === "active" ? active : past;

  return (
    <div className="cp-root cp-surface cp-no-scrollbar" style={{ position: "fixed", inset: 0, width: "100%", zIndex: 230, overflowY: "auto", paddingBottom: 110 }}>
      {/* Header */}
      <div style={{ padding: "16px 22px 8px", position: "sticky", top: 0, background: "var(--bg)", zIndex: 5 }}>
        <h1 className="h-1" style={{ margin: 0, fontSize: 32 }}>Tus pedidos</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "8px 22px 16px" }}>
        {[{ id: "active", label: "Activos", n: active.length }, { id: "past", label: "Anteriores", n: past.length }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            height: 36, padding: "0 16px", borderRadius: 999,
            border: "1px solid " + (tab === t.id ? "var(--tx)" : "var(--line)"),
            background: tab === t.id ? "var(--tx)" : "transparent",
            color: tab === t.id ? "var(--bg)" : "var(--t2)",
            fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            {t.label}
            {t.n > 0 && <span style={{ fontSize: 10, opacity: 0.7 }}>{t.n}</span>}
          </button>
        ))}
      </div>

      {/* Loading / empty / list */}
      {orders === null ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--t3)", fontSize: 13 }}>Cargando…</div>
      ) : list.length === 0 ? (
        <div style={{ padding: "48px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          <h3 className="h-3" style={{ margin: "0 0 8px" }}>
            {tab === "active" ? "Sin pedidos activos" : "Todavía no hay pedidos"}
          </h3>
          <p className="body-s" style={{ margin: 0 }}>
            {tab === "active" ? "Cuando hagas uno, lo seguís acá en vivo." : "Tu historial va a aparecer acá."}
          </p>
        </div>
      ) : (
        <div style={{ padding: "0 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map(o => (
            <div key={o.id} style={{ border: "1px solid var(--line)", borderRadius: 16, padding: "16px 18px" }}>
              {tab === "active" ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div className="caption" style={{ color: "var(--ac)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--ac)", display: "inline-block", animation: "cp-pulse 1.4s infinite" }} />
                      {STATUS_LABEL[o.status] || "En curso"}
                    </div>
                    <span className="mono" style={{ fontSize: 12, color: "var(--t2)" }}>#{String(o.id).slice(0, 6).toUpperCase()}</span>
                  </div>
                  {/* Progress 4 segmentos */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                    {STATUS_STEPS.map((s, i) => (
                      <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= progressOf(o.status) ? "var(--ac)" : "var(--b3)" }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="body-s" style={{ fontSize: 13 }}>{relDate(o.created_at || o.date)} · {fmtAR(o.total)}</span>
                    <button onClick={() => onTrack?.(o.id)} style={{
                      height: 34, padding: "0 14px", borderRadius: 999, border: 0,
                      background: "var(--ac)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)",
                    }}>Ver seguimiento</button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                        padding: "2px 7px", borderRadius: 4,
                        background: o.status === "cancelled" ? "color-mix(in oklab, var(--err) 12%, transparent)" : "color-mix(in oklab, var(--ok) 14%, transparent)",
                        color: o.status === "cancelled" ? "var(--err)" : "var(--ok)",
                      }}>{o.status === "cancelled" ? "Cancelado" : "Entregado"}</span>
                      <span className="body-s" style={{ fontSize: 11 }}>{relDate(o.created_at || o.date)}</span>
                    </div>
                    <div style={{ fontFamily: "var(--font-heading)", fontSize: 16, color: "var(--tx)" }}>{fmtAR(o.total)}</div>
                  </div>
                  <button onClick={() => onTrack?.(o.id)} style={{
                    height: 34, padding: "0 14px", borderRadius: 999, border: "1px solid var(--line)",
                    background: "transparent", color: "var(--tx)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-body)",
                  }}>Ver pedido</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes cp-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
      {bottomNav}
    </div>
  );
}
