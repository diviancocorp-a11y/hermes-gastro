// src/catalog-pro/OrderStatusCard.jsx
// StatusCard de seguimiento de pedido (adaptacion del card-24 que paso el
// user: card con icono, titulo, descripcion, ilustracion abajo a la derecha
// y CTA). Sin framer-motion/shadcn: CSS rise + hover lift, tokens del tema.
//
// Variantes:
//   <OrderStatusCard href="/order/123" />          → card completo (OrderSentView)
//   <OrderStatusCard compact href="/order/123" />  → mini, arriba de todo en el home
//
// Ilustracion: repartidor en bici (thiings.co, mismo asset del componente
// original); si no carga cae al emoji 🛵 — nunca queda hueco roto.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { removeActiveOrder } from "../lib/activeOrders";
import { cancelOwnOrder, useRegretCountdown } from "./regretOrder";

const ILLUSTRATION = "https://www.thiings.co/_next/image?url=https%3A%2F%2Flftz25oez4aqbxpq.public.blob.vercel-storage.com%2Fimage-uBD2X8E9FMFPGgAZv0YYRXCMZbaJTt.png&w=320&q=75";

/* El pedido sigue "vivo"? Fetch inicial + realtime: cuando pasa a
   completed/cancelled la card del catalogo desaparece sola y se saca de la
   lista de pedidos activos. Tambien expone created_at/status para la
   ventana de arrepentimiento. */
function useOrderAlive(orderId) {
  const [state, setState] = useState({ alive: true, createdAt: null, status: null });
  useEffect(() => {
    if (!orderId) return;
    let cancel = false;
    const kill = () => {
      if (cancel) return;
      setState((s) => ({ ...s, alive: false }));
      removeActiveOrder(orderId);
    };
    supabase.rpc("get_order_tracker", { p_order_id: orderId }).then(({ data, error }) => {
      if (cancel) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (error) return; // sin info: dejamos la card visible
      if (!row || row.status === "completed" || row.status === "cancelled") { kill(); return; }
      setState({ alive: true, createdAt: row.created_at, status: row.status });
    });
    const channel = supabase
      .channel(`order-card-${orderId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const st = payload?.new?.status;
          if (st === "completed" || st === "cancelled") kill();
          else if (st) setState((s) => ({ ...s, status: st }));
        })
      .subscribe();
    return () => { cancel = true; supabase.removeChannel(channel); };
  }, [orderId]);
  return state;
}

function Illu({ size = 110 }) {
  return (
    <span style={{ position: "relative", display: "block", width: size, height: size * 0.8 }} aria-hidden>
      <img src={ILLUSTRATION} alt="" loading="lazy" draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
          if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = "block";
        }} />
      <span style={{ display: "none", fontSize: size * 0.55, lineHeight: 1, position: "absolute", inset: 0, textAlign: "center" }}>🛵</span>
    </span>
  );
}

export default function OrderStatusCard({ href, compact = false, title, description, orderId }) {
  // Solo el compacto del catalogo vigila el estado (la pagina final no hace falta)
  const { alive, createdAt, status } = useOrderAlive(compact ? orderId : null);
  // Ventana de arrepentimiento: 60s desde la creacion, solo pedidos "new"
  const regretLeft = useRegretCountdown(compact && status === "new" ? createdAt : null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (compact && !alive && !cancelled) return null;

  const onRegret = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (cancelling) return;
    setCancelling(true);
    const ok = await cancelOwnOrder(orderId);
    setCancelling(false);
    if (ok) {
      setCancelled(true);
      setTimeout(() => setCancelled(false), 4000); // se despide y desaparece
    }
  };

  if (compact && cancelled) {
    return (
      <div className="cp-osc cp-osc-compact" style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 16,
        background: "var(--b2, #F4EDE3)", border: "1px solid var(--line, #E8DFD2)",
      }}>
        <span aria-hidden>✓</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--tx, #2D2418)" }}>
          Pedido cancelado — no se te cobró nada
        </span>
      </div>
    );
  }

  if (compact) {
    // Version mini para el home: una linea, siempre visible arriba de todo
    return (
      <a href={href} className="cp-osc cp-osc-compact" style={{
        position: "relative", display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 16, overflow: "hidden",
        background: "color-mix(in srgb, var(--ac, #D97706) 10%, var(--bg, #FBF7F2))",
        border: "1px solid color-mix(in srgb, var(--ac, #D97706) 35%, var(--line, #E8DFD2))",
        textDecoration: "none",
      }}>
        <span style={{ position: "relative", flexShrink: 0, width: 10, height: 10 }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: 99, background: "var(--ac, #D97706)" }} />
          <span style={{ position: "absolute", inset: -3, borderRadius: 99, border: "2px solid var(--ac, #D97706)", opacity: 0.5, animation: "cp-osc-ping 1.6s ease-out infinite" }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--tx, #2D2418)" }}>
            {title || "Tu pedido está en marcha"}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--t2, #8A7A66)" }}>
            {description || "Tocá para seguirlo en vivo"}
          </span>
          {/* Arrepentimiento: 60s para cancelar si se equivoco */}
          {regretLeft > 0 && (
            <button onClick={onRegret} disabled={cancelling} style={{
              marginTop: 6, padding: "4px 10px", borderRadius: 999,
              border: "1px solid var(--err, #C62828)", background: "transparent",
              color: "var(--err, #C62828)", fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {cancelling ? "Cancelando…" : `✕ ¿Te equivocaste? Cancelar (${regretLeft}s)`}
            </button>
          )}
        </span>
        {/* camion centrado verticalmente respecto a la card */}
        <span style={{ position: "absolute", right: 44, top: "50%", transform: "translateY(-50%)", opacity: 0.9, pointerEvents: "none" }}>
          <Illu size={54} />
        </span>
        <span style={{ flexShrink: 0, color: "var(--ac, #D97706)", fontWeight: 800, fontSize: 16 }} aria-hidden>→</span>
        <style>{`
          @keyframes cp-osc-ping { 0% { transform: scale(0.8); opacity: 0.6; } 100% { transform: scale(1.8); opacity: 0; } }
          @media (prefers-reduced-motion: reduce) { .cp-osc * { animation: none !important; } }
        `}</style>
      </a>
    );
  }

  // Version completa (pagina final del pedido)
  return (
    <div className="cp-osc" style={{
      position: "relative", width: "100%", maxWidth: 420, overflow: "hidden",
      borderRadius: 18, border: "1px solid var(--line, #E8DFD2)",
      background: "var(--bg, #FBF7F2)", padding: "22px 22px 24px",
      boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
      animation: "cp-osc-rise 400ms ease both",
      transition: "transform 200ms ease",
    }}>
      <div style={{ fontSize: 22, marginBottom: 8 }} aria-hidden>📦</div>
      <h3 style={{
        fontFamily: "var(--font-heading, 'DM Serif Display', serif)",
        fontSize: 20, margin: 0, color: "var(--tx, #2D2418)", letterSpacing: "-0.01em",
      }}>
        {title || "¡Pedido en marcha!"}
      </h3>
      <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--t2, #8A7A66)", lineHeight: 1.5, maxWidth: 250 }}>
        {description || "Lo estamos preparando. Seguí el estado en vivo y enterate apenas salga."}
      </p>
      <a href={href} style={{
        display: "inline-block", marginTop: 16, padding: "10px 18px",
        borderRadius: 999, border: "1px solid var(--ac, #D97706)",
        background: "transparent", color: "var(--ac, #D97706)",
        fontSize: 13.5, fontWeight: 700, textDecoration: "none",
      }}>
        Seguir mi pedido →
      </a>
      <div style={{ position: "absolute", right: -6, bottom: -8, pointerEvents: "none" }}>
        <Illu size={130} />
      </div>
      <style>{`
        @keyframes cp-osc-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .cp-osc:hover { transform: translateY(-4px); }
        @media (prefers-reduced-motion: reduce) { .cp-osc { animation: none; transition: none; } }
      `}</style>
    </div>
  );
}
