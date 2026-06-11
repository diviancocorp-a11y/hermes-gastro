// src/catalog-pro/SchedulePicker.jsx
// Selector visual de fecha + horario para "Programar pedido" (jun 2026).
// Diseno adaptado del patron "calendar with time presets" (calendario mensual
// + pills de horario + resumen) al stack propio: CSS plano con tokens del
// tema del tenant, sin Tailwind/shadcn/react-day-picker (convencion del repo).
//
// Mantiene el funcionamiento actual del apartado:
//   - Solo se puede programar dentro de los proximos 7 dias (ventana actual).
//   - Dias cerrados segun settings.store_hours: tachados y deshabilitados.
//   - Horarios por hora segun getAvailableHours(fecha) (misma logica de Catalog).
//
// Props:
//   dateValue / timeValue   — form.delivery_date ("YYYY-MM-DD") / form.delivery_time ("HH:00")
//   onSelectDate(dateStr)   — setea fecha (y la hora se resetea en el caller)
//   onSelectTime(time)      — setea hora
//   storeHours              — settings.store_hours (array idx 0=Lun..6=Dom) o null
//   getAvailableHours(date) — horas disponibles [9,10,...] para una fecha
//   daysWindow              — dias hacia adelante habilitados (default 7)

import { useMemo, useState } from "react";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_NAMES_FULL = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function SchedulePicker({
  dateValue, timeValue, onSelectDate, onSelectTime,
  storeHours, getAvailableHours, daysWindow = 7,
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const windowEnd = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + daysWindow); return d; }, [today, daysWindow]);

  // Mes visible: arranca en el mes de hoy; nav solo entre los meses que toca la ventana
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const canPrev = viewMonth > new Date(today.getFullYear(), today.getMonth(), 1) - 1;
  const lastMonth = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1);
  const canNext = viewMonth < lastMonth;

  const isClosedDay = (d) => {
    if (!storeHours) return false; // sin horarios configurados = siempre abierto
    const dayIdx = (d.getDay() + 6) % 7; // 0=Lun
    const hrs = storeHours[dayIdx];
    return !hrs || hrs.closed;
  };
  const inWindow = (d) => d >= today && d <= windowEnd;

  // Grilla del mes visible (celdas vacias al inicio para alinear el dia 1)
  const cells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // lunes primero
    const arr = Array.from({ length: lead }, () => null);
    for (let i = 1; i <= daysInMonth; i++) {
      arr.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i));
    }
    return arr;
  }, [viewMonth]);

  const hours = useMemo(
    () => (dateValue && getAvailableHours ? getAvailableHours(dateValue) : []),
    [dateValue, getAvailableHours]
  );

  // Resumen "Tu pedido queda programado para el jueves 12 de junio a las 10:00"
  const summary = useMemo(() => {
    if (!dateValue || !timeValue) return null;
    const [y, m, d] = dateValue.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const dow = DAY_NAMES_FULL[(dt.getDay() + 6) % 7];
    return `${dow} ${d} de ${MONTH_NAMES[m - 1]} a las ${timeValue}`;
  }, [dateValue, timeValue]);

  const navBtn = (disabled) => ({
    width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)",
    background: "transparent", color: disabled ? "var(--t3)" : "var(--tx)",
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1,
    fontSize: 16, lineHeight: 1, fontFamily: "inherit",
  });

  return (
    <div style={{ background: "var(--b2)", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)" }}>
      {/* ── Calendario ── */}
      <div style={{ padding: "14px 16px" }} data-testid="schedule-date">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button type="button" aria-label="Mes anterior" disabled={!canPrev} style={navBtn(!canPrev)}
            onClick={() => canPrev && setViewMonth(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))}>‹</button>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tx)", textTransform: "capitalize" }}>
            {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
          </div>
          <button type="button" aria-label="Mes siguiente" disabled={!canNext} style={navBtn(!canNext)}
            onClick={() => canNext && setViewMonth(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))}>›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "var(--t3)", padding: "4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={`x${i}`} />;
            const iso = toISO(d);
            const closed = isClosedDay(d);
            const enabled = inWindow(d) && !closed;
            const selected = dateValue === iso;
            const isToday = iso === toISO(today);
            return (
              <button
                key={iso} type="button" disabled={!enabled}
                aria-label={`${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}${closed ? " (cerrado)" : ""}`}
                onClick={() => enabled && onSelectDate(iso)}
                style={{
                  aspectRatio: "1", borderRadius: 10, border: 0, fontFamily: "inherit",
                  fontSize: 13, fontWeight: selected ? 800 : 500,
                  background: selected ? "var(--ac)" : "transparent",
                  color: selected ? "#fff" : enabled ? "var(--tx)" : "var(--t3)",
                  opacity: enabled || selected ? 1 : 0.45,
                  textDecoration: closed && inWindow(d) ? "line-through" : "none",
                  cursor: enabled ? "pointer" : "default",
                  outline: isToday && !selected ? "1.5px dashed var(--ac)" : "none",
                  outlineOffset: -1.5,
                }}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 10.5, color: "var(--t3)", margin: "8px 0 0" }}>
          Podés programar hasta {daysWindow} días adelante. Los días tachados estamos cerrados.
        </p>
      </div>

      {/* ── Horarios ── */}
      {dateValue && (
        <div style={{ borderTop: "1px solid var(--line)", padding: "12px 16px" }} data-testid="schedule-time">
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Horario
          </div>
          {hours.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--t2)", margin: 0 }}>
              No hay horarios disponibles para ese día — probá otro.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {hours.map(h => {
                const t = `${String(h).padStart(2, "0")}:00`;
                const on = timeValue === t;
                return (
                  <button
                    key={t} type="button" onClick={() => onSelectTime(t)}
                    style={{
                      padding: "9px 16px", borderRadius: 999, flexShrink: 0, fontFamily: "inherit",
                      border: on ? "0" : "1px solid var(--line)",
                      background: on ? "var(--ac)" : "transparent",
                      color: on ? "#fff" : "var(--tx)",
                      fontSize: 13, fontWeight: on ? 800 : 600, cursor: "pointer",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Resumen ── */}
      <div style={{ borderTop: "1px solid var(--line)", padding: "12px 16px", fontSize: 12.5, color: "var(--t2)", lineHeight: 1.5 }}>
        {summary
          ? <>Tu pedido queda programado para el <strong style={{ color: "var(--tx)" }}>{summary}</strong>.</>
          : <>Elegí un día y un horario para tu pedido.</>}
      </div>
    </div>
  );
}
