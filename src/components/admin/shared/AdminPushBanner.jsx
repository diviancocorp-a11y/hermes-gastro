/**
 * AdminPushBanner — banner en Inicio del admin para suscribir ESTE
 * dispositivo (la tablet del local) a los avisos de pedidos nuevos.
 *
 * Contexto (12/jun): submit-order ya manda push a role=admin cuando entra
 * un pedido, pero habia CERO suscripciones admin en los 3 tenants — el
 * boton de activacion vivia escondido en el apartado Push y nadie lo toco.
 * Este banner aparece en Inicio hasta que el dispositivo se suscriba.
 *
 * Si lo descartan, no insiste por 7 dias (localStorage). Desaparece solo
 * si: no hay soporte, el permiso esta bloqueado, o ya esta suscripto.
 */
import { useEffect, useState } from "react";
import { isPushSupported, getPushPermission, isSubscribed, subscribeToPush } from "../../../services/push";

const DISMISS_KEY = "ag_push_dismiss_until";
const DISMISS_DAYS = 7;

export default function AdminPushBanner({ onShowToast }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isPushSupported()) return;
      const perm = await getPushPermission();
      if (perm === "denied") return;
      if (await isSubscribed()) return;
      try {
        const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
        if (Date.now() < until) return;
      } catch { /* sin storage */ }
      if (alive) setShow(true);
    })();
    return () => { alive = false; };
  }, []);

  const activate = async () => {
    setBusy(true);
    try {
      const sub = await subscribeToPush({ role: "admin" });
      if (sub) {
        setShow(false);
        onShowToast?.("🔔 Esta tablet va a sonar con cada pedido nuevo ✓");
      } else {
        onShowToast?.("No se pudo activar — revisá los permisos de notificaciones del navegador");
      }
    } catch (e) {
      onShowToast?.(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000)); } catch { /* ok */ }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="ag-card" style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", marginBottom: 14,
      borderLeft: "3px solid var(--ag-c-terra)",
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 999, flexShrink: 0,
        background: "rgba(245, 158, 11, 0.14)", color: "var(--ag-c-terra)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ag-ink)" }}>
          Activá los avisos de pedidos nuevos
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ag-ink-3)", marginTop: 1, lineHeight: 1.4 }}>
          Esta tablet recibe una notificación cada vez que entra un pedido, aunque la app esté cerrada.
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button type="button" onClick={dismiss} disabled={busy} style={{
          padding: "8px 10px", fontSize: 12, background: "transparent",
          color: "var(--ag-ink-3)", border: 0, borderRadius: 8,
          cursor: "pointer", fontFamily: "inherit",
        }}>Ahora no</button>
        <button type="button" onClick={activate} disabled={busy} style={{
          padding: "8px 14px", fontSize: 12, fontWeight: 800,
          background: "var(--ag-c-terra)", color: "#fff",
          border: 0, borderRadius: 999, cursor: busy ? "wait" : "pointer",
          fontFamily: "inherit",
        }}>{busy ? "..." : "Activar"}</button>
      </div>
    </div>
  );
}
