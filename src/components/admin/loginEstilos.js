// Estilos compartidos de la puerta de entrada (LoginScreen del admin y /entrar).
// Viven aca y no en LoginShell porque un modulo que exporta un componente Y
// constantes rompe el fast refresh de Vite.

/** Los tres del sistema (`machine-soul.css`), como literales porque la puerta
 *  pinta con estilos en linea y no hereda los tokens del panel. */
export const GOLD = "#E8B947";
export const VOLT = "#60A5FA";   // la variante para fondo oscuro (--ms-volt-dark)
export const ZINC = "#18181B";

export const estiloInput = {
  padding: "13px 16px", borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none",
  transition: "border-color 0.2s, background 0.2s",
};
export const alEnfocar = (e) => { e.target.style.borderColor = GOLD; e.target.style.background = "rgba(255,255,255,0.07)"; };
export const alSalir = (e) => { e.target.style.borderColor = "rgba(255,255,255,0.12)"; e.target.style.background = "rgba(255,255,255,0.04)"; };

/** La caja translucida del form. Recien se puede tocar cuando termino la entrada. */
export const estiloCaja = (stage) => ({
  marginTop: 28, display: "flex", flexDirection: "column", gap: 10,
  padding: "18px 16px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 16,
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  opacity: stage === "intro" ? 0 : 1,
  transform: stage === "intro" ? "translateY(12px)" : "translateY(0)",
  transition: "opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)",
  pointerEvents: stage === "intro" ? "none" : "auto",
});

/** El boton es ORO: es la accion, y el oro es accion. Tinta oscura encima. */
export const estiloBotonOro = (loading, tactil = false) => ({
  marginTop: 6, padding: "13px", borderRadius: 12, border: 0,
  background: loading ? `${GOLD}99` : GOLD, color: "#1a1a1a",
  fontSize: 14, fontWeight: 700, fontFamily: "inherit",
  cursor: loading ? "wait" : "pointer",
  transition: "background 0.2s, transform 0.1s",
  boxShadow: `0 4px 14px ${GOLD}44`,
  ...(tactil ? { minHeight: 44 } : {}),
});

export const estiloEnlace = (tactil = false) => ({
  marginTop: 2, padding: "8px", background: "none", border: 0,
  color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "inherit",
  cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3,
  ...(tactil ? { minHeight: 44 } : {}),
});

export const estiloAlerta = {
  padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.12)",
  color: "#fca5a5", fontSize: 12, border: "1px solid rgba(239,68,68,0.25)", textAlign: "left",
};
export const estiloAviso = {
  padding: "10px 12px", borderRadius: 10, background: "rgba(96,165,250,0.12)",
  color: "#bfdbfe", fontSize: 12, border: "1px solid rgba(96,165,250,0.28)", textAlign: "left",
};
