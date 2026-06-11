import { Component } from "react";
import { captureException } from "../lib/observability.js";
import i18n from "../lib/i18n.js";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    captureException(error, {
      tags: { source: 'ErrorBoundary' },
      extra: { componentStack: info.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      // Mismo lenguaje visual que la 404 (src/pages/NotFound.jsx): titulo
      // gigante translucido + ilustracion + CTA con tokens del tenant.
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100vh", padding: 24, textAlign: "center",
          fontFamily: "'DM Sans', sans-serif", background: "var(--bg, #FFF8F0)", color: "var(--tx, #2D1B0E)"
        }}>
          <div style={{ position: "relative", marginBottom: 8, width: "100%", maxWidth: 480 }}>
            <div aria-hidden="true" style={{
              fontSize: "clamp(72px, 22vw, 120px)", fontWeight: 800, lineHeight: 1,
              color: "var(--ac, #C45D3E)", opacity: 0.18, letterSpacing: "-0.04em", userSelect: "none",
            }}>
              ¡Ups!
            </div>
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: "clamp(40px, 12vw, 64px)",
            }}>
              <span role="img" aria-label="Olla derramada">🫕</span>
            </div>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>{i18n.t('errorBoundary.title')}</h2>
          <p style={{ color: "var(--t3, #9C8B7A)", fontSize: 14, textAlign: "center", maxWidth: 320, marginBottom: 22, lineHeight: 1.55 }}>
            {i18n.t('errorBoundary.description')}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "var(--ac, #C45D3E)", color: "#fff", border: "none", borderRadius: 999,
              padding: "13px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            }}
          >
            {i18n.t('errorBoundary.reload')}
          </button>
          <a href="/" style={{
            marginTop: 14, fontSize: 13.5, color: "var(--t3, #9C8B7A)",
            textDecoration: "underline",
          }}>
            Ir al inicio
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
