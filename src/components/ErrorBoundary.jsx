import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100vh", padding: 24,
          fontFamily: "'DM Sans', sans-serif", background: "#FFF8F0", color: "#2D1B0E"
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, background: "#C45D3E",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, marginBottom: 20
          }}>!</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Algo salió mal</h2>
          <p style={{ color: "#9C8B7A", fontSize: 14, textAlign: "center", maxWidth: 320, marginBottom: 20 }}>
            Ocurrió un error inesperado. Por favor recargá la página para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#C45D3E", color: "#fff", border: "none", borderRadius: 12,
              padding: "12px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer"
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
