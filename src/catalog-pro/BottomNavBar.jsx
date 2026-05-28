// src/catalog-pro/BottomNavBar.jsx
// Nav bar inferior estilo "pill flotante" — el tab activo expande su label
// con animación (width/opacity vía CSS transition). Adaptado del componente
// shadcn/framer pasado por el user, portado a JSX + Icon + tokens cp.
//
// Props: active ('home'|'search'|'orders'|'favs'|'me'), onChange(id)

import Icon from "./Icon";

const TABS = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "search", label: "Buscar", icon: "search" },
  { id: "orders", label: "Pedidos", icon: "bag" },
  { id: "favs", label: "Favoritos", icon: "heart" },
  { id: "me", label: "Yo", icon: "user" },
];

export default function BottomNavBar({ active = "home", onChange }) {
  return (
    <nav
      role="navigation"
      aria-label="Navegación inferior"
      style={{
        position: "fixed", left: "50%", bottom: 16, transform: "translateX(-50%)",
        zIndex: 60,
        display: "flex", alignItems: "center", gap: 4,
        background: "var(--bg)",
        border: "1px solid var(--line)",
        borderRadius: 999,
        padding: 6,
        boxShadow: "var(--sh-lg)",
        maxWidth: "95vw",
        fontFamily: "var(--font-body)",
      }}
    >
      {TABS.map(t => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange?.(t.id)}
            aria-label={t.label}
            style={{
              display: "flex", alignItems: "center",
              height: 42, minWidth: 42,
              padding: isActive ? "0 14px 0 12px" : "0 10px",
              borderRadius: 999, border: 0, cursor: "pointer",
              background: isActive ? "color-mix(in oklab, var(--ac) 14%, transparent)" : "transparent",
              color: isActive ? "var(--ac)" : "var(--t3)",
              transition: "background 200ms var(--ease), color 200ms var(--ease), padding 240ms var(--ease)",
              overflow: "hidden",
            }}
          >
            <Icon name={t.icon} size={21} stroke={2} />
            <span style={{
              display: "inline-block", overflow: "hidden", whiteSpace: "nowrap",
              maxWidth: isActive ? 80 : 0,
              opacity: isActive ? 1 : 0,
              marginLeft: isActive ? 8 : 0,
              fontSize: 12.5, fontWeight: 600,
              transition: "max-width 280ms var(--ease), opacity 190ms ease, margin-left 240ms var(--ease)",
            }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
