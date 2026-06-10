// src/pages/NotFound.jsx
// 404 catch-all (Sprint 4). Antes una URL invalida quedaba en pantalla blanca
// por el rewrite SPA de vercel.json.
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="cp-root" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 14,
      background: "var(--bg, #faf7f2)", color: "var(--tx, #2D1B0E)",
      padding: 24, textAlign: "center",
    }}>
      <div style={{ fontSize: 64, fontWeight: 800, fontFamily: "var(--font-heading, inherit)", opacity: 0.25 }}>404</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Esta página no existe</div>
      <div style={{ fontSize: 14, color: "var(--t2, #6b5d4f)", maxWidth: 320 }}>
        Puede que el enlace esté vencido o mal escrito.
      </div>
      <Link to="/" style={{
        marginTop: 10, padding: "12px 24px", borderRadius: 999,
        background: "var(--ac, #C45D3E)", color: "#fff",
        textDecoration: "none", fontWeight: 700, fontSize: 14,
      }}>
        Ir al catálogo
      </Link>
    </div>
  );
}
