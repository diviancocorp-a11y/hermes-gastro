import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { formatOrderCode } from "../lib/utils";
import { fmtAR } from "../lib/format";
import business from "@business";
import { cancelOwnOrder, useRegretCountdown } from "../catalog-pro/regretOrder";
import usePedidoEnVivo from "../hooks/usePedidoEnVivo";

// ─── Mapa de estados ──────────────────────────────────
const STEPS = [
  { id: "new",       icon: "📋", label: "Pedido recibido",    desc: "Recibimos tu pedido y lo estamos revisando." },
  { id: "preparing", icon: "👩‍🍳", label: "En preparación",     desc: "¡Manos a la obra! Estamos preparando todo con amor." },
  { id: "active",    icon: "🎁", label: "Listo para entrega",  desc: "Tu pedido está empaquetado y listo para vos." },
  { id: "completed", icon: "✅", label: "¡Pedido completado!", desc: "¡Gracias por elegirnos! Tu pedido fue entregado. 🎂" },
];

const STEP_IDX = { "new": 0, "preparing": 1, "active": 2, "completed": 3 };

// ─── Animación de puntos ──────────────────────────────
function Dots() {
  return <span className="tracker-dots"><span>.</span><span>.</span><span>.</span></span>;
}

export default function OrderTracker() {
  const { id } = useParams();
  // El pedido por el RPC publico get_order_tracker (0081), acotado al negocio
  // del host. Se actualiza solo mientras puede cambiar (ver usePedidoEnVivo:
  // polling, porque Realtime aplica la RLS y el comprador sin sesion no
  // recibia nada).
  const { pedido, cargando: loading, noEncontrado: notFound, cambio } = usePedidoEnVivo(id);

  // El cancelado del boton de arrepentimiento se ve al toque, sin esperar la
  // proxima consulta.
  const [canceladoAca, setCanceladoAca] = useState(false);
  const order = pedido && (canceladoAca ? { ...pedido, status: "cancelled" } : pedido);
  const items = pedido?.items || [];

  // Parpadeo cuando el estado cambia despues de la primera carga.
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!cambio) return undefined;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1500);
    return () => clearTimeout(t);
  }, [cambio]);

  // WhatsApp del local: el del negocio (viene con el pedido) y si no hay, el
  // del build. Sin numero valido NO mostramos el boton de ayuda — un wa.me sin
  // numero abre la pantalla "enviar a" de WhatsApp.
  const waNumber = String(pedido?.whatsapp || business?.whatsapp || "").replace(/\D/g, "");

  // Arrepentimiento: 60s desde la creacion, solo pedidos "new"
  const [cancelling, setCancelling] = useState(false);
  const regretLeft = useRegretCountdown(
    order && order.status === "new" ? order.created_at : null
  );
  const onRegret = async () => {
    if (cancelling || !order) return;
    setCancelling(true);
    const ok = await cancelOwnOrder(order.id);
    setCancelling(false);
    if (ok) setCanceladoAca(true);
  };

  // ─── Loading ──────────────────────────────────────
  if (loading) return (
    <div className="tracker-shell cp-root">
      <div className="tracker-loading">
        <div className="tracker-logo">📦</div>
        <p>Buscando tu pedido<Dots /></p>
      </div>
    </div>
  );

  // ─── No encontrado ────────────────────────────────
  if (notFound) return (
    <div className="tracker-shell cp-root">
      <div className="tracker-notfound">
        <div style={{ fontSize: 56 }}>🔍</div>
        <h2>Pedido no encontrado</h2>
        <p>Verificá el link que te enviamos o contactanos por WhatsApp.</p>
        <Link to="/" className="tracker-back-btn">← Volver a la tienda</Link>
      </div>
    </div>
  );

  const isCancelled = order.status === "cancelled";
  const stepIdx     = isCancelled ? -1 : (STEP_IDX[order.status] ?? 0);

  return (
    <div className="tracker-shell cp-root">
      {/* Header */}
      <div className="tracker-header">
        <div>
          <h1 className="tracker-title">Seguí tu pedido en vivo</h1>
          <p className="tracker-sub">Se actualiza sola</p>
        </div>
      </div>

      {/* Card principal */}
      <div className={`tracker-card ${pulse ? "tracker-pulse" : ""}`}>
        {isCancelled ? (
          <div className="tracker-cancelled">
            <div style={{ fontSize: 48 }}>❌</div>
            <h2>Pedido cancelado</h2>
            <p>Si tenés alguna pregunta, escribinos por WhatsApp.</p>
          </div>
        ) : (
          <>
            {/* Ícono del estado actual */}
            <div className="tracker-state-icon">{STEPS[stepIdx]?.icon}</div>
            <h2 className="tracker-state-label">{STEPS[stepIdx]?.label}</h2>
            <p className="tracker-state-desc">{STEPS[stepIdx]?.desc}</p>

            {/* Barra de progreso */}
            <div className="tracker-progress">
              {STEPS.map((step, i) => (
                <div key={step.id} className="tracker-progress-step">
                  <div className={`tracker-step-dot ${i <= stepIdx ? "done" : ""} ${i === stepIdx ? "active" : ""}`}>
                    {i < stepIdx ? "✓" : i === stepIdx && order.status !== "completed" ? <Dots /> : i === stepIdx ? "✓" : ""}
                  </div>
                  <div className={`tracker-step-label ${i <= stepIdx ? "done" : ""}`}>{step.label}</div>
                  {i < STEPS.length - 1 && (
                    <div className={`tracker-step-line ${i < stepIdx ? "done" : ""}`} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Resumen del pedido */}
      <div className="tracker-summary">
        <div className="tracker-summary-hd" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>📦 Tu pedido</span>
          <span style={{fontSize:13,fontWeight:700,color:"var(--ac)",letterSpacing:1}}>{formatOrderCode(order.id)}</span>
        </div>
        <div className="tracker-summary-info">
          {order.customer_first_name && <span>👤 {order.customer_first_name}</span>}
          <span>{order.delivery === "envio" ? "🛵 Delivery" : "🏪 Retiro en local"}</span>
          {order.is_gift && <span>🎁 Pedido regalo</span>}
        </div>
        <div className="tracker-items">
          {items.map((it, i) => (
            <div key={i} className="tracker-item">
              <span>{it.name || "Producto"} × {it.qty}</span>
              <span>{fmtAR(it.qty * it.unit_price)}</span>
            </div>
          ))}
          <div className="tracker-item tracker-total">
            <span>Total</span>
            <span>{fmtAR(order.total)}</span>
          </div>
        </div>
        {order.note && (
          <div className="tracker-note">💬 {order.note}</div>
        )}
      </div>

      {/* Live indicator */}
      {!isCancelled && order.status !== "completed" && (
        <div className="tracker-live">
          <span className="tracker-live-dot" />
          Se actualiza sola
        </div>
      )}

      {/* Arrepentimiento: ventana de 60s para cancelar si se equivoco */}
      {regretLeft > 0 && (
        <button onClick={onRegret} disabled={cancelling} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          margin: "14px auto 0", maxWidth: 420, width: "100%", padding: "12px 18px",
          borderRadius: 999, border: "1px solid var(--err, #C62828)",
          background: "transparent", color: "var(--err, #C62828)",
          fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>
          {cancelling ? "Cancelando…" : `✕ ¿Te equivocaste? Cancelar pedido (${regretLeft}s)`}
        </button>
      )}

      {/* Ayuda SIEMPRE visible: va directo al chat de WhatsApp del local con
          el codigo del pedido prellenado (solo si hay numero configurado) */}
      {waNumber && (
        <a
          href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hola! Tengo una consulta sobre mi pedido ${formatOrderCode(order.id)}`)}`}
          target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            margin: "14px auto 0", maxWidth: 420, padding: "12px 18px",
            borderRadius: 999, border: "1px solid var(--ac, #D97706)",
            background: "transparent", color: "var(--ac, #D97706)",
            fontSize: 14, fontWeight: 700, textDecoration: "none",
          }}
        >
          💬 ¿Necesitás ayuda con tu pedido?
        </a>
      )}

      <Link to="/" className="tracker-back-btn">← Volver a la tienda</Link>
    </div>
  );
}
