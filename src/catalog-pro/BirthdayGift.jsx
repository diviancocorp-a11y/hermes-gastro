// src/catalog-pro/BirthdayGift.jsx
// Tarjeta regalo de cumpleanos (adaptacion del SlideToUnlock que paso el user,
// SIN framer-motion: drag con pointer events + confetti CSS propio).
//
// Flujo:
//   1. Catalog la monta con la identidad disponible (email de sesion o phone guest)
//   2. check contra edge function birthday-gift (valida birth_date en el server,
//      el cliente no puede inventarse el cumple) — cacheado por dia en sessionStorage
//   3. Si es el cumple → overlay con slider "Desliza para abrir tu regalo"
//   4. Slide completo → claim → confetti + codigo de cupon (se aplica en checkout)
//
// El premio (%) se gestiona desde CRM (settings.birthday_coupon_pct, 0 = apagado).
// IMPORTANTE: cp-root para recibir los tokens del tema.
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function callBirthdayGift(payload) {
  try {
    const { data, error } = await supabase.functions.invoke("birthday-gift", { body: payload });
    if (error) return null;
    return data;
  } catch { return null; }
}

/* ---------- Confetti CSS (40 piezas, una sola pasada) ---------- */
function ConfettiBurst() {
  const pieces = Array.from({ length: 40 }, (_, i) => i);
  const colors = ["var(--ac, #D97706)", "#E85D75", "#5DB7E8", "#7BC47F", "#F2C14E"];
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {pieces.map((i) => {
        const left = (i * 37) % 100;
        const delay = (i % 8) * 60;
        const dur = 1400 + (i % 5) * 220;
        const size = 5 + (i % 4) * 2;
        return (
          <span key={i} style={{
            position: "absolute", top: -12, left: `${left}%`,
            width: size, height: size * (i % 2 ? 1 : 2.2),
            borderRadius: i % 3 ? 1 : 99,
            background: colors[i % colors.length],
            animation: `cp-bday-fall ${dur}ms ease-in ${delay}ms both`,
            transform: `rotate(${(i * 53) % 360}deg)`,
          }} />
        );
      })}
    </div>
  );
}

/* ---------- Slider "desliza para abrir" (pointer events) ---------- */
function SlideToUnlock({ onUnlock, disabled }) {
  const trackRef = useRef(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const startX = useRef(0);
  const KNOB = 52;

  const maxX = () => {
    const w = trackRef.current?.offsetWidth || 0;
    return Math.max(0, w - KNOB - 8);
  };

  const onPointerDown = (e) => {
    if (disabled || unlocked) return;
    setDragging(true);
    startX.current = e.clientX - x;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging || unlocked) return;
    const next = Math.min(maxX(), Math.max(0, e.clientX - startX.current));
    setX(next);
    if (next >= maxX() - 2) {
      setUnlocked(true);
      setDragging(false);
      onUnlock?.();
    }
  };
  const onPointerUp = () => {
    setDragging(false);
    if (!unlocked) setX(0); // vuelve al inicio si no llego
  };

  const pct = maxX() ? x / maxX() : 0;

  return (
    <div ref={trackRef} role="slider" aria-label="Desliza para abrir tu regalo"
      aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}
      style={{
        position: "relative", height: 60, borderRadius: 99,
        background: "var(--b2, #F4EDE3)", border: "1px solid var(--line, #E8DFD2)",
        userSelect: "none", touchAction: "none", overflow: "hidden",
      }}>
      {/* relleno de progreso */}
      <div style={{
        position: "absolute", inset: 0, width: x + KNOB,
        background: "color-mix(in srgb, var(--ac, #D97706) 18%, transparent)",
        borderRadius: 99,
        transition: dragging ? "none" : "width 250ms ease",
      }} />
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 14, fontWeight: 600,
        color: "var(--t2, #8A7A66)", opacity: 1 - pct * 1.4,
        letterSpacing: "0.02em", pointerEvents: "none",
      }}>
        Deslizá para abrir tu regalo →
      </div>
      <div
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{
          position: "absolute", top: 4, left: 4 + x,
          width: KNOB, height: KNOB, borderRadius: 99,
          background: "var(--ac, #D97706)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, cursor: disabled ? "default" : "grab",
          boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          transition: dragging ? "none" : "left 250ms ease",
        }}>
        🎁
      </div>
    </div>
  );
}

/* ---------- Card principal ---------- */
export default function BirthdayGift({ email, phone, bizName }) {
  const [state, setState] = useState({ status: "idle" }); // idle | show | claiming | claimed
  const dismissKey = `cp_bday_dismiss_${todayKey()}`;
  const checkKey = `cp_bday_check_${todayKey()}`;

  useEffect(() => {
    if (!email && !phone) return;
    try { if (localStorage.getItem(dismissKey)) return; } catch { /* empty */ }
    let cancel = false;
    (async () => {
      // cache del check por dia para no pegarle a la function en cada visita
      let res = null;
      try { res = JSON.parse(sessionStorage.getItem(checkKey) || "null"); } catch { /* empty */ }
      if (!res) {
        res = await callBirthdayGift({ email, phone });
        if (res) { try { sessionStorage.setItem(checkKey, JSON.stringify(res)); } catch { /* empty */ } }
      }
      if (!cancel && res?.birthday) setState({ status: "show", name: res.name, pct: res.pct });
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, phone]);

  const onUnlock = useCallback(async () => {
    setState((s) => ({ ...s, status: "claiming" }));
    const res = await callBirthdayGift({ email, phone, claim: true });
    if (res?.ok && res.code) {
      setState((s) => ({ ...s, status: "claimed", code: res.code, pct: res.pct, used: res.used }));
    } else {
      setState((s) => ({ ...s, status: "show", error: "No se pudo generar el cupon. Probá de nuevo." }));
    }
  }, [email, phone]);

  const dismiss = () => {
    try { localStorage.setItem(dismissKey, "1"); } catch { /* empty */ }
    setState({ status: "idle" });
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(state.code); setState((s) => ({ ...s, copied: true })); } catch { /* empty */ }
  };

  if (state.status === "idle") return null;

  return (
    <div className="cp-root" style={{
      position: "fixed", inset: 0, zIndex: 8000,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      animation: "cp-bday-fade 300ms ease both",
    }} onClick={dismiss}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "relative", width: "100%", maxWidth: 380,
        background: "var(--bg, #FBF7F2)", borderRadius: 24,
        border: "1px solid var(--line, #E8DFD2)",
        padding: "28px 22px 24px", textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: "cp-bday-pop 400ms cubic-bezier(0.34,1.56,0.64,1) both",
        overflow: "hidden",
      }}>
        {state.status === "claimed" && <ConfettiBurst />}

        <button onClick={dismiss} aria-label="Cerrar" style={{
          position: "absolute", top: 12, right: 12, width: 32, height: 32,
          borderRadius: 99, border: "none", background: "var(--b2, #F4EDE3)",
          color: "var(--t2, #8A7A66)", fontSize: 16, cursor: "pointer", lineHeight: 1,
        }}>✕</button>

        <div style={{ fontSize: 44, marginBottom: 6 }}>🎂</div>
        <h2 style={{
          fontFamily: "var(--font-heading, 'DM Serif Display', serif)",
          fontSize: 26, margin: "0 0 6px", color: "var(--tx, #2D2418)",
        }}>
          ¡Feliz cumple{state.name ? `, ${state.name}` : ""}!
        </h2>

        {state.status !== "claimed" ? (
          <>
            <p style={{ fontSize: 14, color: "var(--t2, #8A7A66)", margin: "0 0 20px", lineHeight: 1.5 }}>
              {bizName || "El equipo"} te dejó un regalo por tu día 🎉
            </p>
            <SlideToUnlock onUnlock={onUnlock} disabled={state.status === "claiming"} />
            {state.status === "claiming" && (
              <div style={{ fontSize: 13, color: "var(--t2)", marginTop: 10 }}>Abriendo tu regalo…</div>
            )}
            {state.error && (
              <div style={{ fontSize: 13, color: "#C0392B", marginTop: 10 }}>{state.error}</div>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "var(--t2, #8A7A66)", margin: "0 0 14px", lineHeight: 1.5 }}>
              {state.used
                ? "Ya usaste tu regalo de hoy. ¡Que lo hayas disfrutado!"
                : <>Tenés un <strong style={{ color: "var(--ac, #D97706)" }}>{state.pct}% de descuento</strong> en tu pedido de hoy. Usá este código en el checkout:</>}
            </p>
            {!state.used && (
              <>
                <button onClick={copyCode} style={{
                  fontFamily: "monospace", fontSize: 22, fontWeight: 700,
                  letterSpacing: "0.06em", color: "var(--ac, #D97706)",
                  background: "var(--b2, #F4EDE3)", border: "1px dashed var(--ac, #D97706)",
                  borderRadius: 12, padding: "12px 18px", cursor: "pointer", width: "100%",
                }}>
                  {state.code}
                </button>
                <div style={{ fontSize: 12, color: "var(--t3, #B0A48F)", marginTop: 8 }}>
                  {state.copied ? "¡Copiado! Vale solo por hoy." : "Tocá el código para copiarlo · vale solo por hoy"}
                </div>
              </>
            )}
            <button onClick={dismiss} style={{
              marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 99,
              border: "none", background: "var(--ac, #D97706)", color: "#fff",
              fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}>
              ¡A pedir! 🎉
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes cp-bday-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cp-bday-pop { from { opacity: 0; transform: scale(0.85) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes cp-bday-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(420px) rotate(540deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="cp-bday"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
