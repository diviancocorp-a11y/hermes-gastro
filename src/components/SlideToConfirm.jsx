// src/components/SlideToConfirm.jsx
// Botón "deslizá para confirmar" para acciones peligrosas/irreversibles.
// Implementación nativa (pointer events + CSS) sin framer-motion ni libs externas.
//
// Props:
//   onConfirm:        () => Promise<void> | void   — acción al completar el drag
//   label:            string                       — texto inicial (default "Deslizá para confirmar")
//   loadingLabel:     string                       — texto mientras se ejecuta onConfirm
//   successLabel:     string                       — texto al completar OK
//   color:            string                       — color del track/handle (default ámbar)
//   danger:           bool                         — si true, handle rojo (acción peligrosa)
//   disabled:         bool
//
// Uso:
//   <SlideToConfirm danger onConfirm={submitVoid} label="Deslizá para anular" />

import { useRef, useState, useCallback, useEffect } from "react";

const HANDLE_W = 44;
const TRACK_H = 48;
const PADDING = 4;
const THRESHOLD = 0.88; // 88% del track

export default function SlideToConfirm({
  onConfirm,
  label = "Deslizá para confirmar",
  loadingLabel = "Procesando…",
  successLabel = "Confirmado ✓",
  color = "#F59E0B",
  danger = false,
  disabled = false,
}) {
  const trackRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // 'idle' | 'loading' | 'success' | 'error'
  const startX = useRef(0);
  const startDragX = useRef(0);

  const maxX = useCallback(() => {
    const w = trackRef.current?.offsetWidth || 280;
    return Math.max(0, w - HANDLE_W - PADDING * 2);
  }, []);

  const onPointerDown = (e) => {
    if (disabled || status !== "idle") return;
    setDragging(true);
    startX.current = e.clientX;
    startDragX.current = dragX;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    const next = Math.max(0, Math.min(startDragX.current + dx, maxX()));
    setDragX(next);
  };

  const onPointerUp = async (e) => {
    if (!dragging) return;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const progress = dragX / Math.max(1, maxX());
    if (progress >= THRESHOLD) {
      setDragX(maxX());
      setStatus("loading");
      try {
        await Promise.resolve(onConfirm?.());
        setStatus("success");
      } catch (err) {
        console.warn("SlideToConfirm onConfirm error:", err);
        setStatus("error");
        setTimeout(() => { setStatus("idle"); setDragX(0); }, 1200);
      }
    } else {
      setDragX(0);
    }
  };

  // Reset si el componente recibe disabled cambiando o se desmonta
  useEffect(() => () => { setDragX(0); setStatus("idle"); }, []);

  const handleColor = danger ? "#E85A4A" : color;
  const fillPct = (dragX / Math.max(1, maxX())) * 100;
  const isDone = status === "success" || status === "loading";

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative",
        height: TRACK_H,
        background: "rgba(0,0,0,0.06)",
        border: "1px solid var(--ag-line, rgba(0,0,0,0.08))",
        borderRadius: 999,
        overflow: "hidden",
        userSelect: "none",
        touchAction: "none",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "default",
      }}
    >
      {/* Track fill (relleno conforme se desliza) */}
      <div
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `calc(${fillPct}% + ${HANDLE_W}px)`,
          background: handleColor,
          opacity: 0.18,
          transition: dragging ? "none" : "width 240ms cubic-bezier(0.22,1,0.36,1)",
          pointerEvents: "none",
        }}
      />

      {/* Label central */}
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, letterSpacing: "0.04em",
          color: isDone ? "#fff" : "var(--ag-ink-2, #5B5552)",
          textTransform: "uppercase",
          textAlign: "center", padding: "0 56px",
          pointerEvents: "none",
          opacity: dragging || dragX > 6 ? Math.max(0, 1 - fillPct / 70) : 1,
          transition: "opacity 200ms ease, color 200ms ease",
        }}
      >
        {status === "loading" ? loadingLabel
          : status === "success" ? successLabel
          : status === "error" ? "Error · reintentá"
          : label}
      </div>

      {/* Handle deslizable con warning */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "absolute",
          top: PADDING, left: PADDING,
          width: HANDLE_W, height: TRACK_H - PADDING * 2,
          borderRadius: 999,
          background: handleColor,
          color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: `translateX(${dragX}px) scale(${dragging ? 1.05 : 1})`,
          transition: dragging ? "transform 60ms ease" : "transform 320ms cubic-bezier(0.22,1,0.36,1)",
          boxShadow: `0 4px 14px ${handleColor}55`,
          cursor: disabled || status !== "idle" ? "default" : (dragging ? "grabbing" : "grab"),
          touchAction: "none",
        }}
        aria-label={label}
        role="button"
      >
        {status === "loading" ? (
          <SpinnerIcon />
        ) : status === "success" ? (
          <CheckIcon />
        ) : status === "error" ? (
          <CrossIcon />
        ) : danger ? (
          <WarningIcon />
        ) : (
          <ArrowIcon />
        )}
      </div>
    </div>
  );
}

/* ── Íconos inline (sin lucide-react) ────────────────────── */
function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ animation: "stc-spin 0.9s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <style>{`@keyframes stc-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
