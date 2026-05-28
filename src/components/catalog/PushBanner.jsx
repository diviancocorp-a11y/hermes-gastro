// src/components/catalog/PushBanner.jsx
// Banner discreto que pide al cliente habilitar notificaciones push.
// Se autoesconde si push no soporta, ya fue concedido o el user lo cerró.
// Sistema visual v2.

import { useState, useEffect } from "react";
import { isPushSupported, getPushPermission, subscribeToPush } from "../../services/push";
import business from "@business";

export default function PushBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const primary = business.branding?.primary || "var(--ag-c-terra)";

  useEffect(() => {
    if (!isPushSupported()) return;
    if (sessionStorage.getItem("push_banner_dismissed")) return;
    getPushPermission().then((perm) => {
      if (perm === "default") setVisible(true);
    });
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try { await subscribeToPush(); } catch {}
    setLoading(false);
    setVisible(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("push_banner_dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        margin: "12px 16px",
        padding: "14px 16px",
        borderRadius: 12,
        background: "var(--ag-c-stock-soft, #FFF8E1)",
        border: "1px solid var(--ag-c-stock, #FFECB3)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ fontSize: 26, flexShrink: 0 }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink)", marginBottom: 2 }}>
          ¡No te pierdas nada!
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ag-ink-2)", lineHeight: 1.4 }}>
          Activá las notificaciones para enterarte de promos y novedades.
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--ag-line)",
            background: "transparent",
            color: "var(--ag-ink-2)",
            fontSize: 11.5,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Ahora no
        </button>
        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: 0,
            background: primary,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            fontFamily: "inherit",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "..." : "Activar"}
        </button>
      </div>
    </div>
  );
}
