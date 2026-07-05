// src/components/BadgeTag.jsx
// Badge tipo "pill con sub-chip + texto" — ideal para ofertas exclusivas,
// promos, banners de novedades, daily deals. Implementación nativa sin Tailwind.
//
// Props:
//   label:        string  — chip pequeño a la izquierda (ej "PROMO", "-30%", "2x1").
//   children:     ReactNode  — texto de la oferta a la derecha.
//   tone:         'neutral' | 'promo' | 'exclusive' | 'limited' | 'success' | 'warning'
//   icon:         emoji o ReactNode opcional al inicio del label.
//   compact:      bool — versión chica para badges inline en cards.
//   onClick:      handler opcional (la pill se vuelve clickeable).
//
// Uso:
//   <BadgeTag label="-30%" tone="promo">2 horas restantes</BadgeTag>
//   <BadgeTag label="EXCLUSIVO" tone="exclusive" icon="🎁">50% off en Premium</BadgeTag>
//   <BadgeTag label="HOY" tone="limited">Solo por hoy: docena de empanadas</BadgeTag>

const TONES = {
  neutral: {
    bg:        "rgba(120,120,120,0.10)",
    border:    "rgba(120,120,120,0.30)",
    text:      "var(--t2, #B5A98E)",
    chipBg:    "var(--ag-bg-card, #fff)",
    chipText:  "var(--ag-ink, #2D1B0E)",
    chipBorder:"rgba(120,120,120,0.30)",
  },
  promo: {
    bg:        "rgba(232,90,74,0.16)",
    border:    "rgba(232,90,74,0.35)",
    text:      "var(--ag-c-orders, #E85A4A)",
    chipBg:    "var(--ag-c-orders, #E85A4A)",
    chipText:  "#fff",
    chipBorder:"var(--ag-c-orders, #E85A4A)",
  },
  exclusive: {
    bg:        "rgba(107,91,214,0.18)",
    border:    "rgba(107,91,214,0.40)",
    text:      "var(--ag-c-crm, #6B5BD6)",
    chipBg:    "var(--ag-c-crm, #6B5BD6)",
    chipText:  "#fff",
    chipBorder:"var(--ag-c-crm, #6B5BD6)",
  },
  limited: {
    bg:        "rgba(245,158,11,0.16)",
    border:    "rgba(245,158,11,0.40)",
    text:      "var(--ag-c-stock, #E8A53A)",
    chipBg:    "var(--ag-c-stock, #E8A53A)",
    chipText:  "#000",
    chipBorder:"var(--ag-c-stock, #E8A53A)",
  },
  success: {
    bg:        "rgba(42,157,110,0.16)",
    border:    "rgba(42,157,110,0.35)",
    text:      "var(--ag-c-sales, #2A9D6E)",
    chipBg:    "var(--ag-c-sales, #2A9D6E)",
    chipText:  "#fff",
    chipBorder:"var(--ag-c-sales, #2A9D6E)",
  },
  warning: {
    bg:        "rgba(232,165,58,0.16)",
    border:    "rgba(232,165,58,0.35)",
    text:      "var(--ag-c-stock, #E8A53A)",
    chipBg:    "var(--ag-bg-card, #fff)",
    chipText:  "var(--ag-c-stock, #E8A53A)",
    chipBorder:"var(--ag-c-stock, #E8A53A)",
  },
};

export default function BadgeTag({
  label,
  children,
  tone = "neutral",
  icon = null,
  compact = false,
  onClick,
  style = {},
  childBg = null,    // fondo del texto (ej "#000" para que resalte sobre cualquier foto)
  childColor = null, // color del texto cuando hay childBg
  ...rest
}) {
  const t = TONES[tone] || TONES.neutral;
  const Component = onClick ? "button" : "div";

  const fontSize = compact ? 11 : 12.5;
  const labelFontSize = compact ? 10.5 : 11.5;
  const padOuter = compact ? "2px 12px 2px 2px" : "3px 14px 3px 3px";
  const padChip = compact ? "3px 8px" : "4px 10px";
  const gap = compact ? 6 : 8;

  return (
    <Component
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        padding: padOuter,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        color: t.text,
        fontSize,
        fontWeight: 600,
        lineHeight: 1.2,
        fontFamily: "inherit",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: padChip,
          background: t.chipBg,
          color: t.chipText,
          border: `1px solid ${t.chipBorder}`,
          borderRadius: 999,
          fontSize: labelFontSize,
          fontWeight: 800,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
        }}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </span>
      <span style={{
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        ...(childBg
          ? { background: childBg, color: childColor || "#fff", padding: compact ? "3px 8px" : "4px 10px", borderRadius: 999, fontWeight: 800 }
          : { paddingRight: 2 }),
      }}>
        {children}
      </span>
    </Component>
  );
}
