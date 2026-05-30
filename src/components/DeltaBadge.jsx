// src/components/DeltaBadge.jsx
// Badge con flecha + valor de delta (variación %). Inspirado en Tremor.
// Implementación nativa con tokens del sistema (--ag-c-*), sin deps externas.
//
// Props:
//   value:      string | number   — el valor mostrado (ej "9.3%" o 1500).
//   deltaType:  'increase' | 'decrease' | 'neutral'  — color y dirección.
//   variant:    'outline' | 'solid' | 'solidOutline' | 'complex'  — estilo.
//   iconStyle:  'filled' | 'line'  — flecha sólida o lineal.
//   prefix:     opcional, texto antes del valor (ej "+", "$").
//   style:      override.
//
// Uso típico:
//   <DeltaBadge value="9.3%" deltaType="increase" variant="outline" />
//   <DeltaBadge value="1.9%" deltaType="decrease" variant="solid" iconStyle="line" />
//   <DeltaBadge value="$15.420" deltaType="increase" variant="complex" />

const COLOR_MAP = {
  increase: {
    text:        "var(--ag-c-sales, #2A9D6E)",
    bgSoft:      "var(--ag-c-sales-soft, rgba(42,157,110,0.14))",
    ringSolid:   "rgba(42,157,110,0.20)",
  },
  decrease: {
    text:        "var(--ag-c-orders, #E85A4A)",
    bgSoft:      "var(--ag-c-orders-soft, rgba(232,90,74,0.14))",
    ringSolid:   "rgba(232,90,74,0.20)",
  },
  neutral: {
    text:        "var(--ag-ink-2, #5B5552)",
    bgSoft:      "var(--ag-bg-soft, rgba(0,0,0,0.06))",
    ringSolid:   "rgba(0,0,0,0.10)",
  },
};

function ArrowIcon({ deltaType, iconStyle, size = 14 }) {
  const stroke = "currentColor";
  const sw = iconStyle === "filled" ? 2.5 : 2;
  if (deltaType === "increase") {
    return iconStyle === "filled"
      ? <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4 L20 14 H4 Z" /></svg>
      : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>;
  }
  if (deltaType === "decrease") {
    return iconStyle === "filled"
      ? <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20 L4 10 H20 Z" /></svg>
      : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>;
  }
  // neutral
  return iconStyle === "filled"
    ? <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 12 L14 4 V20 Z" transform="rotate(90 12 12)" /></svg>
    : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
}

export default function DeltaBadge({
  value,
  deltaType = "neutral",
  variant = "outline",
  iconStyle = "filled",
  prefix = "",
  size = "md", // 'sm' | 'md'
  style = {},
}) {
  const c = COLOR_MAP[deltaType] || COLOR_MAP.neutral;
  const fontSize = size === "sm" ? 10.5 : 11.5;
  const iconSize = size === "sm" ? 12 : 14;
  const pad = size === "sm" ? "2px 8px" : "3px 10px";

  // ─── Variant: complex (dos chips: valor + icon) ─────────
  if (variant === "complex") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "2px 2px 2px 10px",
        borderRadius: 999,
        border: "1px solid var(--ag-line, rgba(0,0,0,0.08))",
        background: "var(--ag-bg-card, #fff)",
        fontFamily: "inherit",
        ...style,
      }}>
        <span style={{ fontSize, fontWeight: 700, color: c.text, letterSpacing: "0.01em", fontVariantNumeric: "tabular-nums" }}>
          {prefix}{value}
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: 999,
          background: c.bgSoft, color: c.text,
        }}>
          <ArrowIcon deltaType={deltaType} iconStyle="line" size={12} />
        </span>
      </span>
    );
  }

  // ─── Variantes inline (outline / solid / solidOutline) ─
  const isSolid = variant === "solid" || variant === "solidOutline";
  const bg = isSolid ? c.bgSoft : "transparent";
  const ring = variant === "outline" ? "var(--ag-line, rgba(0,0,0,0.08))"
             : variant === "solidOutline" ? c.ringSolid
             : "transparent";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: pad,
      borderRadius: 8,
      border: `1px solid ${ring}`,
      background: bg,
      color: c.text,
      fontSize, fontWeight: 700, lineHeight: 1.2,
      letterSpacing: "0.01em",
      fontFamily: "inherit",
      fontVariantNumeric: "tabular-nums",
      ...style,
    }}>
      <ArrowIcon deltaType={deltaType} iconStyle={iconStyle} size={iconSize} />
      {prefix}{value}
    </span>
  );
}

// ─── Helper para derivar deltaType desde un número ───────
// Útil cuando tenés `previous` y `current` y querés mostrar la variación.
export function computeDelta(current, previous) {
  const a = Number(current) || 0;
  const b = Number(previous) || 0;
  if (b === 0 && a === 0) return { type: "neutral", pct: 0, value: "0.0%" };
  if (b === 0) return { type: "increase", pct: 100, value: "+100%" };
  const pct = ((a - b) / Math.abs(b)) * 100;
  const type = Math.abs(pct) < 0.1 ? "neutral" : pct > 0 ? "increase" : "decrease";
  const sign = pct > 0 ? "+" : "";
  return { type, pct, value: `${sign}${pct.toFixed(1)}%` };
}
