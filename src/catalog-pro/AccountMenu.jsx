// src/catalog-pro/AccountMenu.jsx
// Dropdown del avatar del catalogo y de MyAccount — adaptacion del
// user-dropdown (shadcn/radix) al stack propio: sin radix/iconify/Tailwind,
// mismos terminos que maneja el sistema.
//
// La burbuja del trigger muestra EL AVATAR ELEGIDO por la persona
// (Mi Cuenta → lapicito); si no eligio, el deterministico por nombre.
//
// Props:
//   session: object | null  -> session unificada del AuthContext
//                              (kind: "phone" | "auth", displayName, displaySub).
//   onSelect(tab): callback con la tab seleccionada (perfil/historial/etc).
//                  Si la sesion es null y el user toca "Iniciar sesion",
//                  recibe null (caller navega al login).
//   onLogout():    callback al tocar "Cerrar sesion".
//   align?: "right" | "left" -> donde se ancla el dropdown (default right).

import { useState, useRef, useEffect } from "react";
import Icon from "./Icon";
import { Avatar, getLocalAvatarKey } from "../lib/avatars.jsx";

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
  const avatarKey = getLocalAvatarKey();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger: avatar elegido (o deterministico) cuando hay sesion */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Menu de cuenta"
        aria-expanded={open}
        style={{
          width: 38, height: 38, borderRadius: 999, padding: 0,
          background: open ? "var(--b2)" : "transparent",
          border: "1px solid var(--line)",
          color: "var(--tx)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, overflow: "hidden",
        }}
      >
        {isLoggedIn
          ? <Avatar name={session.displayName} avatarKey={avatarKey} size={36} />
          : <Icon name="user" size={16} />}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)",
          [align]: 0, width: 264,
          background: "var(--b2)", border: "1px solid var(--line)", borderRadius: 18,
          boxShadow: "0 16px 40px rgba(0,0,0,0.14)", zIndex: 30,
          padding: 5,
        }}>
          {/* Seccion principal (card blanca interna, como el original) */}
          <div style={{
            background: "var(--bg)", borderRadius: 14,
            border: "1px solid var(--line)", overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}>
            {isLoggedIn ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px 10px" }}>
                <Avatar name={session.displayName} avatarKey={avatarKey} size={40}
                  style={{ border: "1px solid var(--line)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--tx)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session.displayName}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session.displaySub}
                  </div>
                </div>
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 800, padding: "3px 8px",
                  borderRadius: 6, letterSpacing: "0.03em",
                  background: "color-mix(in srgb, var(--ok, #16A34A) 14%, transparent)",
                  color: "var(--ok, #16A34A)",
                  border: "1px solid color-mix(in srgb, var(--ok, #16A34A) 35%, transparent)",
                }}>
                  Activo
                </span>
              </div>
            ) : (
              <button type="button" onClick={() => select()} style={itemStyle}>
                <Icon name="user" size={16} style={{ color: "var(--ac)" }} />
                <span style={{ fontWeight: 700, color: "var(--ac)" }}>Iniciar sesión</span>
              </button>
            )}

            {isLoggedIn && (
              <>
                <div style={{ height: 1, background: "var(--line)", margin: "0 8px" }} />
                <div style={{ padding: 4 }}>
                  {ITEMS.map((it) => (
                    <button key={it.id} type="button" onClick={() => select(it.id)} style={itemStyle}>
                      <Icon name={it.icon} size={16} style={{ color: "var(--t2)" }} />
                      <span style={{ color: "var(--tx)", fontWeight: 500 }}>{it.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Seccion inferior: cerrar sesion (separada, como el original) */}
          {isLoggedIn && (
            <div style={{ padding: "5px 4px 1px" }}>
              <button
                type="button"
                onClick={() => { setOpen(false); onLogout?.(); }}
                style={itemStyle}
              >
                <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--err, #C62828)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </span>
                <span style={{ color: "var(--err, #C62828)", fontWeight: 600 }}>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const itemStyle = {
  display: "flex", alignItems: "center", gap: 10,
  width: "100%", padding: "10px 10px", textAlign: "left",
  background: "transparent", border: 0, borderRadius: 10,
  cursor: "pointer", fontFamily: "inherit", fontSize: 13.5,
};
