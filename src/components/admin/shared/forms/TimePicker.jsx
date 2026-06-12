/**
 * TimePicker — selector de hora desplegable (jun 2026).
 *
 * Reemplaza al <input type="time"> (que en desktop selecciona el texto
 * para ESCRIBIR) por un boton que al tocarlo despliega dos columnas
 * scrolleables: horas (00-23) y minutos (de a 5). Tocar la hora no
 * cierra (deja elegir minutos); tocar el minuto cierra. Al abrir,
 * scrollea solo hasta el valor actual.
 *
 * Props:
 *   value     — "HH:MM" o ""
 *   onChange  — (v: "HH:MM") => void
 *   ariaLabel — etiqueta accesible (ej: "Apertura del lunes")
 */
import { useEffect, useRef, useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES_BASE = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, "0"));

function Column({ items, active, onPick, label }) {
  const ref = useRef(null);
  // Al abrir, centrar el valor activo
  useEffect(() => {
    const el = ref.current?.querySelector('[data-active="true"]');
    if (el) el.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{
        fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
        color: "var(--ag-ink-3)", textAlign: "center", padding: "2px 0 4px", flexShrink: 0,
      }}>{label}</div>
      <div ref={ref} style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", scrollbarWidth: "thin" }}>
        {items.map((it) => {
          const isActive = it === active;
          return (
            <button
              key={it}
              type="button"
              data-active={isActive ? "true" : undefined}
              onClick={() => onPick(it)}
              style={{
                display: "block", width: "100%", border: 0, cursor: "pointer",
                padding: "7px 0", textAlign: "center", borderRadius: 8,
                fontFamily: "inherit", fontSize: 13.5, fontVariantNumeric: "tabular-nums",
                fontWeight: isActive ? 800 : 500,
                background: isActive ? "var(--ag-c-terra)" : "transparent",
                color: isActive ? "#fff" : "var(--ag-ink)",
              }}
            >
              {it}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TimePicker({ value = "", onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const [h, m] = (value || "").split(":");
  const hour = HOURS.includes(h) ? h : null;
  // Si el valor guardado tiene un minuto fuera del paso de 5, lo sumamos
  // a la lista para no perderlo
  const minutes = m && !MINUTES_BASE.includes(m)
    ? [...MINUTES_BASE, m].sort()
    : MINUTES_BASE;
  const minute = minutes.includes(m) ? m : null;

  // Cerrar al tocar fuera o con Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickHour = (nh) => onChange(`${nh}:${minute || "00"}`);
  const pickMinute = (nm) => { onChange(`${hour || "00"}:${nm}`); setOpen(false); };

  return (
    <div ref={rootRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          width: "100%", padding: "7px 8px", cursor: "pointer",
          borderRadius: 10, fontFamily: "inherit",
          border: open ? "1.5px solid var(--ag-c-terra)" : "1px solid var(--ag-line)",
          background: "var(--ag-bg-card)",
          color: value ? "var(--ag-ink)" : "var(--ag-ink-3)",
          fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums",
          boxShadow: open ? "0 0 0 3px rgba(245, 158, 11, 0.18)" : "none",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.6, flexShrink: 0 }}>
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
        {value || "--:--"}
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            top: "calc(100% + 6px)", zIndex: 40,
            width: 150, height: 200,
            display: "flex", gap: 2, padding: 6,
            borderRadius: 14,
            background: "var(--ag-bg-card)", border: "1px solid var(--ag-line)",
            boxShadow: "var(--ag-sh-lg)",
            animation: "ag-act-pop 180ms var(--ag-ease)",
          }}
        >
          <Column items={HOURS} active={hour} onPick={pickHour} label="Hora" />
          <div style={{ width: 1, background: "var(--ag-line)", margin: "16px 0 4px", flexShrink: 0 }} />
          <Column items={minutes} active={minute} onPick={pickMinute} label="Min" />
        </div>
      )}
    </div>
  );
}
