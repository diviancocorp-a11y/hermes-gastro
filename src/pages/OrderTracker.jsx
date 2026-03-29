import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ─── Mapa de estados ──────────────────────────────────
const STEPS = [
  { id: "new",       icon: "📋", label: "Pedido recibido",   desc: "Recibimos tu pedido y lo estamos revisando." },
  { id: "prep",      icon: "👩‍🍳", label: "En preparación",    desc: "¡Manos a la obra! Estamos preparando todo con amor." },
  { id: "active",    icon: "🎁", label: "Listo para entrega", desc: "Tu pedido está empaquetado y listo para vos." },
  { id: "done",      icon: "✅", label: "¡Entregado!",        desc: "¡Gracias por elegirnos! Esperamos verte pronto." },
];

const STEP_IDX = { new: 0, prep: 1, active: 2, done: 3 };

// ─── Animación de puntos ──────────────────────────────
function Dots() {
  return <span className="tracker-dots"><span>.</span><span>.</span><span>.</span></span>;
}

export default function OrderTracker() {
  const { id } = useParams();
  const [order, setOrder]   = useState(null);
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pulse, setPulse]   = useState(false); // feedback visual de actualización
  const channelRef          = useRef(null);

  // ─── Carga inicial ────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, customer, date, total, is_gift, note, delivery, created_at, order_items(qty, unit_price, recipes(name))")
        .eq("id", id)
        .single();

      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setOrder(data);
      setItems(data.order_items || []);
      setLoading(false);
    }
    load();
  }, [id]);

  // ─── Suscripción Realtime ─────────────────────────
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          setOrder(prev => ({ ...prev, ...payload.new }));
          // Feedback visual: parpadeo al actualizar
          setPulse(true);
          setTimeout(() => setPulse(false), 1500);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ─── Loading ──────────────────────────────────────
  if (loading) return (
    <div className="tracker-shell">
      <div className="tracker-loading">
        <div className="tracker-logo">🦆</div>
        <p>Buscando tu pedido<Dots /></p>
      </div>
    </div>
  );

  // ─── No encontrado ────────────────────────────────
  if (notFound) return (
    <div className="tracker-shell">
      <div className="tracker-notfound">
        <div style={{ fontSize: 56 }}>🔍</div>
        <h2>Pedido no encontrado</h2>
        <p>Verificá el link que te enviamos o contactanos por WhatsApp.</p>
        <Link to="/" className="tracker-back-btn">← Volver a la tienda</Link>
      </div>
    </div>
  );

  const isCancelled = order.status === "cancel";
  const stepIdx     = isCancelled ? -1 : (STEP_IDX[order.status] ?? 0);

  return (
    <div className="tracker-shell">
      {/* Header */}
      <div className="tracker-header">
        <Link to="/" className="tracker-logo-link">
          <div className="tracker-logo">🦆</div>
        </Link>
        <div>
          <h1 className="tracker-title">Pato Tracker</h1>
          <p className="tracker-sub">Seguimiento en tiempo real</p>
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
                    {i < stepIdx ? "✓" : i === stepIdx && order.status !== "done" ? <Dots /> : i === stepIdx ? "✓" : ""}
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
        <div className="tracker-summary-hd">📦 Tu pedido</div>
        <div className="tracker-summary-info">
          <span>👤 {order.customer}</span>
          <span>{order.delivery === "envio" ? "🛵 Delivery" : "🏪 Retiro en local"}</span>
          {order.is_gift && <span>🎁 Pedido regalo</span>}
        </div>
        <div className="tracker-items">
          {items.map((it, i) => (
            <div key={i} className="tracker-item">
              <span>{it.recipes?.name || "Producto"} × {it.qty}</span>
              <span>${(it.qty * it.unit_price).toLocaleString("es-AR")}</span>
            </div>
          ))}
          <div className="tracker-item tracker-total">
            <span>Total</span>
            <span>${(order.total || 0).toLocaleString("es-AR")}</span>
          </div>
        </div>
        {order.note && (
          <div className="tracker-note">💬 {order.note}</div>
        )}
      </div>

      {/* Live indicator */}
      {!isCancelled && order.status !== "done" && (
        <div className="tracker-live">
          <span className="tracker-live-dot" />
          Actualización en tiempo real
        </div>
      )}

      <Link to="/" className="tracker-back-btn">← Volver a la tienda</Link>
    </div>
  );
}
