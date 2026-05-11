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
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100vh", padding: 24,
          fontFamily: "'DM Sans', sans-serif", background: "var(--bg, #FFF8F0)", color: "var(--tx, #2D1B0E)"
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, background: "var(--ac, #C45D3E)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, marginBottom: 20
          }}>!</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>{i18n.t('errorBoundary.title')}</h2>
          <p style={{ color: "var(--t3, #9C8B7A)", fontSize: 14, textAlign: "center", maxWidth: 320, marginBottom: 20 }}>
            {i18n.t('errorBoundary.description')}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "var(--ac, #C45D3E)", color: "#fff", border: "none", borderRadius: 12,
              padding: "12px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer"
            }}
          >
            {i18n.t('errorBoundary.reload')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
