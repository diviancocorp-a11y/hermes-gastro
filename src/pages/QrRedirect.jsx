// src/pages/QrRedirect.jsx
//
// Página pública /q/:slug — punto de aterrizaje de los QR físicos.
// Hace fetch del slug, registra la visita, y redirige al target_url.
//
// Si el slug no existe o está inactivo, muestra una pantalla de "QR no
// encontrado" con CTA al catálogo.

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchQrBySlug, incrementQrVisit } from "../services/qrs";
import business from "@business";

export default function QrRedirect() {
  const { slug } = useParams();
  const [state, setState] = useState("loading"); // loading | not-found | error

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) { setState("not-found"); return; }
      try {
        const qr = await fetchQrBySlug(slug);
        if (cancelled) return;
        if (!qr || !qr.target_url) { setState("not-found"); return; }
        // Fire-and-forget: no esperamos el increment para no demorar la redirección.
        incrementQrVisit(slug);
        // Redirect del navegador (replace para que el back no vuelva acá).
        window.location.replace(qr.target_url);
      } catch (e) {
        console.error("QrRedirect:", e);
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (state === "loading") {
    return (
      <div style={wrap}>
        <div style={{ width: 32, height: 32, border: "3px solid var(--ag-line, #E8DFD0)", borderTopColor: "var(--ag-c-terra, #C45D3E)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
        <h1 style={{ margin: "0 0 8px", fontFamily: "Georgia, serif", fontSize: 22, color: "#2D1B0E" }}>
          QR no encontrado
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: "#6B5D4F", lineHeight: 1.5 }}>
          Este QR no está activo o ya no es válido. Pasá por nuestro catálogo.
        </p>
        <Link to="/" style={btn}>
          Ir al catálogo de {business.name}
        </Link>
      </div>
    </div>
  );
}

const wrap = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  padding: 24, background: "#FAF5EE", fontFamily: "system-ui, sans-serif",
};
const card = {
  maxWidth: 360, width: "100%", padding: "32px 24px", background: "#fff",
  borderRadius: 18, textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
};
const btn = {
  display: "inline-block", padding: "12px 22px", borderRadius: 12,
  background: "#2D1B0E", color: "#fff", fontWeight: 600, fontSize: 14,
  textDecoration: "none",
};
