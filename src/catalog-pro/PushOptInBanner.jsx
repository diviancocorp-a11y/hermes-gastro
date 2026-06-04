// src/catalog-pro/PushOptInBanner.jsx
// Banner opt-in para suscribir al cliente a push notifications.
// Solo aparece si:
//   - browser soporta push
//   - permission != 'denied' (no acosamos si ya dijo no)
//   - todavia no esta suscrito
//   - el user no lo dismisseo en esta sesion
//
// Asocia la subscription con phone (guest) o user_id (logueado).
import { useEffect, useState } from "react";
import {
  isPushSupported, getPushPermission, isSubscribed, subscribeToPush,
} from "../services/push";

const DISMISS_KEY = "hg_push_dismissed";

export default function PushOptInBanner({ session }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isPushSupported()) return;
      const perm = await getPushPermission();
      if (perm === "denied") return;
      if (await isSubscribed()) return;
      if (sessionStorage.getItem(DISMISS_KEY)) return;
      if (alive) setShow(true);
    })();
    return () => { alive = false; };
  }, []);

  const handleSubscribe = async () => {
    setBusy(true);
    try {
      const userId = session?.kind === "auth" ? session.id : null;
      const phone = session?.phone || null;
      const sub = await subscribeToPush({ role: "customer", userId, phone });
      if (sub) setShow(false);
    } catch (e) {
      console.error("Push subscribe error:", e);
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "center",
      padding: "12px 14px", borderRadius: 12,
      background: "var(--b2)", border: "1px solid var(--line)",
      marginBottom: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 999,
        background: "var(--ac)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontSize: 18,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>
          Avisos del estado de tu pedido
        </div>
        <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 2, lineHeight: 1.4 }}>
          Te llega notificacion cuando preparamos, enviamos y entregamos.
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          style={{
            padding: "8px 10px", fontSize: 12,
            background: "transparent", color: "var(--t3)",
            border: 0, borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Ahora no
        </button>
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={busy}
          style={{
            padding: "8px 12px", fontSize: 12, fontWeight: 700,
            background: "var(--ac)", color: "#fff",
            border: 0, borderRadius: 8, cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {busy ? "..." : "Activar"}
        </button>
      </div>
    </div>
  );
}
