// src/components/ui/UpdateBanner.jsx
// Aviso fijo cuando hay una version nueva desplegada. Tocar recarga la pagina
// (trae el index.html nuevo con los hashes nuevos). Mata la familia de bugs
// "chunk viejo tras deploy" avisando ANTES de que el usuario choque con un
// import roto. Se monta en el root -> sirve para catalogo y admin.
import useAppUpdate from "../../hooks/useAppUpdate";

export default function UpdateBanner() {
  const { updateAvailable, reload } = useAppUpdate();
  if (!updateAvailable) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      onClick={reload}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "#2D1B0E",
        color: "#fff",
        padding: "calc(env(safe-area-inset-top, 0px) + 9px) 16px 9px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
      }}
    >
      <span>Hay una actualización · tocá para recargar</span>
      <button
        type="button"
        onClick={reload}
        style={{
          background: "#fff",
          color: "#2D1B0E",
          border: "none",
          borderRadius: 8,
          padding: "5px 12px",
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Recargar
      </button>
    </div>
  );
}
