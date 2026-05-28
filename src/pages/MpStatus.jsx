// src/pages/MpStatus.jsx
// Rutas /pago/exitoso, /pago/fallido, /pago/pendiente
//
// MP redirige al cliente aquí después del checkout (back_urls de la preference).
// Mostramos el estado y un botón "Ver mi pedido" → /order/:id
//
// El estado real del pago lo updatea el webhook (mp-webhook), no esta página.
// Esta página es solo informativa para el cliente.

import { useSearchParams, Link } from "react-router-dom";

export default function MpStatus({ status }) {
  // status: 'exitoso' | 'fallido' | 'pendiente'
  const [params] = useSearchParams();
  const orderId = params.get("orderId");
  const mpStatus = params.get("status") || params.get("collection_status"); // info opcional de MP

  const cfg = {
    exitoso: {
      icon: "✓",
      color: "#10b981",
      title: "¡Pago aprobado!",
      msg: "Recibimos tu pago. Vamos a empezar a preparar tu pedido.",
    },
    fallido: {
      icon: "✕",
      color: "#ef4444",
      title: "El pago no se completó",
      msg: "MercadoPago rechazó el pago. Podés intentar de nuevo desde el pedido o elegir otro medio de pago.",
    },
    pendiente: {
      icon: "⏳",
      color: "#f59e0b",
      title: "Pago pendiente",
      msg: "MercadoPago todavía está procesando tu pago. Te vamos a avisar cuando se confirme.",
    },
  }[status] || {
    icon: "?",
    color: "#6b7280",
    title: "Estado desconocido",
    msg: "No pudimos determinar el estado del pago.",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 16,
      background: "var(--ag-bg, #fafaf7)",
    }}>
      <div style={{ fontSize: 64, color: cfg.color }}>{cfg.icon}</div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: cfg.color, textAlign: "center" }}>
        {cfg.title}
      </h1>
      <p style={{
        margin: 0,
        fontSize: 15,
        color: "var(--ag-text, #1a1a1a)",
        textAlign: "center",
        maxWidth: 420,
        lineHeight: 1.5,
      }}>
        {cfg.msg}
      </p>
      {mpStatus && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--ag-muted, #6b6b6b)" }}>
          Detalle MP: {mpStatus}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {orderId && (
          <Link
            to={`/order/${orderId}`}
            style={{
              padding: "12px 22px",
              borderRadius: 10,
              background: cfg.color,
              color: "white",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Ver mi pedido
          </Link>
        )}
        <Link
          to="/"
          style={{
            padding: "12px 22px",
            borderRadius: 10,
            background: "transparent",
            color: "var(--ag-text, #1a1a1a)",
            border: "1px solid var(--ag-border, #e5e5e5)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Volver al menú
        </Link>
      </div>
    </div>
  );
}
