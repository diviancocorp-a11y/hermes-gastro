// src/catalog-pro/AgeGate.jsx
// Modal +18 para paginas con contenido sensible (ej: cannabis).
// Bloquea acceso hasta confirmacion. Persistencia via localStorage del caller.
import business from "@business";

export default function AgeGate({ onConfirm, title }) {
  return (
    <div className="cp-root cp-surface" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        maxWidth: 420, width: "100%", textAlign: "center",
        padding: "32px 24px", background: "var(--b2)",
        borderRadius: 20, border: "1px solid var(--line)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔞</div>
        <h1 style={{ fontFamily: "var(--font-heading, 'DM Serif Display', serif)", fontSize: 22, margin: "0 0 10px", color: "var(--tx)" }}>
          Contenido para adultos
        </h1>
        <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 24px" }}>
          {title ? `"${title}" contiene` : "Esta pagina contiene"} informacion sobre un producto exclusivo para mayores de 18 anos.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            width: "100%", padding: "14px 18px",
            background: "var(--ac)", color: "#fff",
            border: 0, borderRadius: 12,
            fontFamily: "inherit", fontSize: 15, fontWeight: 700,
            cursor: "pointer", marginBottom: 10,
          }}
        >
          Soy mayor de 18 anos
        </button>
        <a
          href="/"
          style={{
            display: "block", padding: "12px",
            color: "var(--t3)", fontSize: 13,
            textDecoration: "none", fontFamily: "inherit",
          }}
        >
          No, salir
        </a>
        <div style={{ marginTop: 20, fontSize: 11, color: "var(--t3)", lineHeight: 1.5 }}>
          {business.name} - consumo responsable.
        </div>
      </div>
    </div>
  );
}
