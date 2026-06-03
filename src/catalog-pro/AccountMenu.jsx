// src/catalog-pro/AccountMenu.jsx
// Dropdown del avatar/header del catalogo y de MyAccount.
// Accesos directos a las tabs de Mi cuenta + cerrar sesion.
//
// Props:
//   session: object | null  -> session unificada del AuthContext
//                              (kind: "phone" | "auth", displayName, displaySub).
//   onSelect(tab): callback con la tab seleccionada (perfil/historial/etc).
//                  Si la sesion es null y el user toca "Iniciar sesion",
//                  recibe null (caller navega al login).
//   onLogout():    callback al tocar "Cerrar sesion".
//                  Usar `sessionLogout` del AuthContext.
//   align?: "right" | "left" -> donde se ancla el dropdown (default right).

import { useState, useRef, useEffect } from "react";
import Icon from "./Icon";

const ITEMS = [
  { id: "perfil",      label: "Mi perfil",    icon: "user" },
  { id: "historial",   label: "Mis pedidos",  icon: "bag" },
  { id: "direcciones", label: "Direcciones",  icon: "pin" },
  { id: "favoritos",   label: "Favoritos",    icon: "heart" },
  { id: "cupones",     label: "Cupones",      icon: "ticket" },
  { id: "referidos",   label: "Referidos",    icon: "gift" },
];

export default function AccountMenu({ session, onSelect, onLogout, align = "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
    };
  }, [open]);

  const select = (tab) => {
    setOpen(false);
    onSelect?.(tab || null);
  };

  const isLoggedIn = !!session;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Menu de cuenta"
        aria-expanded={open}
        style={{
          width: 38, height: 38, borderRadius: 999,
          background: open ? "var(--b2)" : "transparent",
          border: "1px solid var(--line)",
          color: "var(--tx)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="user" size={16} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)",
          [align]: 0, minWidth: 220,
          background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 14,
          boxShadow: "0 12px 28px rgba(0,0,0,0.08)", overflow: "hidden", zIndex: 30,
        }}>
          {isLoggedIn && (
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", background: "var(--b2)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>{session.displayName}</div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{session.displaySub}</div>
            </div>
          )}

          {!isLoggedIn && (
            <button type="button" onClick={() => select()} style={itemStyle}>
              <Icon name="user" size={16} style={{ color: "var(--ac)" }} />
              <span style={{ fontWeight: 600, color: "var(--tx)" }}>Iniciar sesion</span>
            </button>
          )}

          {isLoggedIn && ITEMS.map((it) => (
            <button key={it.id} type="button" onClick={() => select(it.id)} style={itemStyle}>
              <Icon name={it.icon} size={16} style={{ color: "var(--t2)" }} />
              <span style={{ color: "var(--tx)" }}>{it.label}</span>
            </button>
          ))}

          {isLoggedIn && (
            <button
              type="button"
              onClick={() => { setOpen(false); onLogout?.(); }}
              style={{ ...itemStyle, borderTop: "1px solid var(--line)" }}
            >
              <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--err, #C62828)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </span>
              <span style={{ color: "var(--err, #C62828)", fontWeight: 600 }}>Cerrar sesion</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const itemStyle = {
  display: "flex", alignItems: "center", gap: 10,
  width: "100%", padding: "12px 14px", textAlign: "left",
  background: "transparent", border: 0, borderRadius: 0,
  cursor: "pointer", fontFamily: "inherit", fontSize: 13.5,
  borderTop: "1px solid var(--line)",
};
