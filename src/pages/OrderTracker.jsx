import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatOrderCode } from "../lib/utils";

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
  const [order, setOrder]   = useState(null);
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pulse, setPulse]   = useState(false); // feedback visual de actualización
  const channelRef          = useRef(null);

  // ─── Carga inicial vía RPC `get_order_tracker` (SECURITY DEFINER) ──
  // El select directo a `orders` falla para usuarios anon porque las RLS
  // solo permiten leer el propio user_id. El RPC lo bypassa de forma segura.
  // Para códigos cortos #XXXXXX seguimos haciendo el fallback contra la tabla,
  // pero ahora resolvemos el UUID completo y delegamos al RPC.
  const [resolvedId, setResolvedId] = useState(null);
  useEffect(() => {
    async function load() {
      setLoading(true);
      const cleanId = (id || "").replace(/^#/, "").trim();
      const looksLikeUuid = cleanId.includes("-") || cleanId.length > 20;

      // Resolver UUID completo (si el usuario tipea el código corto)
      let fullId = looksLikeUuid ? cleanId : null;
      if (!fullId) {
        // Código corto: lookup vía RPC dedicado o fallback a tabla pública (recipes ya es pública)
        const { data: candidates } = await supabase
          .from("orders")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(200);
        const match = (candidates || []).find(o => {
          const s = String(o.id).replace(/-/g, "");
          return s.slice(-6).toUpperCase() === cleanId.toUpperCase();
        });
        if (!match) { setNotFound(true); setLoading(false); return; }
        fullId = match.id;
      }

      const { data, error } = await supabase.rpc("get_order_tracker", { p_order_id: fullId });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) { setNotFound(true); setLoading(false); return; }
      // Adaptar la forma para mantener compatibilidad con el render existente
      setOrder({
        id: row.id,
        status: row.status,
        customer: row.customer,
        date: row.date,
        total: row.total,
        is_gift: row.is_gift,
        note: row.note,
        delivery: row.delivery,
        created_at: row.created_at,
      });
      setItems((row.items || []).map(it => ({
        qty: it.qty,
        unit_price: it.unit_price,
        recipes: { name: it.name },
      })));
      setResolvedId(row.id);
      setLoading(false);
    }
    load();
  }, [id]);

  // ─── Suscripción Realtime ─────────────────────────
  useEffect(() => {
    const rid = resolvedId;
    if (!rid) return;

    const channel = supabase
      .channel(`order-${rid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${rid}` },
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
  }, [resolvedId]);

  // ─── Loading ──────────────────────────────────────
  if (loading) return (
    <div className="tracker-shell">
      <div className="tracker-loading">
        <div className="tracker-logo">🦆</div>
        <p>Buscando el pato pedido<Dots /></p>
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

  const isCancelled = order.status === "cancelled";
  const stepIdx     = isCancelled ? -1 : (STEP_IDX[order.status] ?? 0);

  return (
    <div className="tracker-shell">
      {/* Header */}
      <div className="tracker-header">
        <Link to="/" className="tracker-logo-link">
          <div className="tracker-logo">🦆</div>
        </Link>
        <div>
          <h1 className="tracker-title">Sigue tu pato pedido</h1>
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
          <span style={{fontSize:13,fontWeight:700,color:"var(--pr,#C45D3E)",letterSpacing:1}}>{formatOrderCode(resolvedId||id)}</span>
        </div>
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
      {!isCancelled && order.status !== "completed" && (
        <div className="tracker-live">
          <span className="tracker-live-dot" />
          Actualización en tiempo real
        </div>
      )}

      <Link to="/" className="tracker-back-btn">← Volver a la tienda</Link>
    </div>
  );
}
