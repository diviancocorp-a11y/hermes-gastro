// src/pages/MpStatus.jsx
// Rutas /pago/exitoso, /pago/fallido, /pago/pendiente
//
// MP redirige al cliente aqui despues del checkout (back_urls de la preference).
//
// 14/jun: en /pago/exitoso reconstruimos la pantalla completa de confirmacion
// (OrderSentView, la misma del flujo in-app) trayendo el pedido por el RPC
// get_order_tracker (SECURITY DEFINER, seguro para invitados).
//
// IMPORTANTE: el back_url de MP NO prueba que el pago entro -> la verdad la
// pone el webhook (mp-webhook), que promueve la orden de `pending_payment` a
// `new` y setea payment_status='approved'. Por eso NO festejamos solo por
// estar en /pago/exitoso: leemos el estado real del pedido y mostramos
//   - confirmado  -> OrderSentView (pantalla completa)
//   - verificando -> "estamos confirmando tu pago" con auto-poll (el webhook
//                    suele tardar unos segundos)
//   - rechazado   -> aviso para reintentar

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getGuestUser } from "../lib/guestUser";
import OrderSentView from "../components/catalog/OrderSentView";

// Clasifica el estado del pago a partir del pedido real.
function classify(row) {
  if (!row) return "error";
  const ps = String(row.payment_status || "").toLowerCase();
  const st = String(row.status || "").toLowerCase();
  if (ps === "approved" || (st && st !== "pending_payment" && st !== "cancelled")) return "confirmed";
  if (ps === "rejected" || ps === "cancelled" || st === "cancelled") return "rejected";
  return "verifying"; // pending_payment / in_process / pending / sin webhook todavia
}

export default function MpStatus({ status }) {
  // status: 'exitoso' | 'fallido' | 'pendiente'
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("orderId");
  const mpStatus = params.get("status") || params.get("collection_status"); // info opcional de MP

  const isSuccess = status === "exitoso";
  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(isSuccess);
  const triesRef = useRef(0);

  // Settings (direccion de retiro) una sola vez
  useEffect(() => {
    if (!isSuccess) return;
    let alive = true;
    supabase.from("settings").select("store_address").eq("id", 1).single()
      .then(({ data }) => { if (alive) setSettings({ store_address: data?.store_address || "" }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isSuccess]);

  // Trae el pedido y, si todavia esta "verificando", reintenta cada 3s (~36s).
  useEffect(() => {
    if (!isSuccess || !orderId) { setLoading(false); return; }
    let alive = true;
    let timer = null;
    const tick = async () => {
      const { data, error } = await supabase.rpc("get_order_tracker", { p_order_id: orderId });
      if (!alive) return;
      setLoading(false);
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) { setOrder(null); return; }
      setOrder(row);
      if (classify(row) === "verifying" && triesRef.current < 12) {
        triesRef.current += 1;
        timer = setTimeout(tick, 3000);
      }
    };
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [isSuccess, orderId]);

  // ── Loading inicial mientras traemos el pedido ──
  if (isSuccess && loading) {
    return (
      <StatusScreen icon={<Spinner />} color="var(--ac)" title="Confirmando tu pedido…"
        msg="Un segundo, estamos buscando los datos de tu compra." />
    );
  }

  // ── Pago exitoso con pedido cargado ──
  if (isSuccess && order) {
    const phase = classify(order);

    if (phase === "confirmed") {
      const guest = getGuestUser();
      const form = {
        payment: "mercadopago",
        delivery: order.delivery,
        name: order.customer || guest?.name || "",
        phone: guest?.phone || "",
        email: guest?.email || "",
        birth_date: guest?.birth_date || "",
      };
      return (
        <OrderSentView
          orderId={order.id}
          form={form}
          settings={settings}
          paymentConfirmed
          onReset={() => navigate("/")}
        />
      );
    }

    if (phase === "verifying") {
      const stillPolling = triesRef.current < 12;
      return (
        <StatusScreen icon={stillPolling ? <Spinner /> : "⏳"} color="#f59e0b"
          title="Estamos confirmando tu pago"
          msg={stillPolling
            ? "MercadoPago nos está enviando la confirmación. Esto puede tardar unos segundos…"
            : "Tu pago sigue en proceso. Apenas se confirme te avisamos. Podés seguir el estado de tu pedido."}
          orderId={orderId} primaryLabel="Ver estado de mi pedido" />
      );
    }

    // rejected
    return (
      <StatusScreen icon="✕" color="#ef4444"
        title="El pago no se completó"
        msg="MercadoPago no aprobó el pago. Podés intentar de nuevo o elegir otro medio de pago desde tu pedido."
        orderId={orderId} primaryLabel="Volver a mi pedido" />
    );
  }

  // ── Fallback: /pago/fallido, /pago/pendiente, o exitoso sin pedido ──
  const cfg = {
    exitoso: { icon: "✓", color: "#16A34A", title: "¡Pago aprobado!", msg: "Recibimos tu pago. Vamos a empezar a preparar tu pedido." },
    fallido: { icon: "✕", color: "#ef4444", title: "El pago no se completó", msg: "MercadoPago rechazó el pago. Podés intentar de nuevo desde el pedido o elegir otro medio de pago." },
    pendiente: { icon: "⏳", color: "#f59e0b", title: "Pago pendiente", msg: "MercadoPago todavía está procesando tu pago. Te vamos a avisar cuando se confirme." },
  }[status] || { icon: "?", color: "var(--ac)", title: "Estado desconocido", msg: "No pudimos determinar el estado del pago." };

  return (
    <StatusScreen icon={cfg.icon} color={cfg.color} title={cfg.title} msg={cfg.msg}
      orderId={orderId} primaryLabel="Ver mi pedido" mpStatus={mpStatus} />
  );
}

// ─── Pantalla de estado simple, con el tema dark del catalogo (cp-root) ───
function StatusScreen({ icon, color, title, msg, orderId, primaryLabel = "Ver mi pedido", mpStatus }) {
  return (
    <div className="cp-root cp-surface" style={shell}>
      <div style={{ fontSize: 60, color, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <h1 style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800, color, textAlign: "center", fontFamily: "var(--font-heading)" }}>
        {title}
      </h1>
      <p style={{ margin: 0, fontSize: 15, color: "var(--t2)", textAlign: "center", maxWidth: 420, lineHeight: 1.5 }}>
        {msg}
      </p>
      {mpStatus && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--t3)" }}>Detalle MP: {mpStatus}</p>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {orderId && (
          <Link to={`/order/${orderId}`} style={{
            padding: "12px 22px", borderRadius: 10, background: color,
            color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700,
          }}>
            {primaryLabel}
          </Link>
        )}
        <Link to="/" style={{
          padding: "12px 22px", borderRadius: 10, background: "transparent",
          color: "var(--tx)", border: "1px solid var(--line)",
          textDecoration: "none", fontSize: 14, fontWeight: 600,
        }}>
          Volver al menú
        </Link>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 52, height: 52, borderRadius: "50%",
      border: "4px solid var(--line)", borderTopColor: "var(--ac)",
      display: "inline-block", animation: "cp-spin 0.9s linear infinite",
    }}>
      <style>{"@keyframes cp-spin{to{transform:rotate(360deg)}}"}</style>
    </span>
  );
}

const shell = {
  position: "fixed", inset: 0, zIndex: 250,
  minHeight: "100vh", background: "var(--bg)", color: "var(--tx)",
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  padding: 24, gap: 16, overflowY: "auto",
};
