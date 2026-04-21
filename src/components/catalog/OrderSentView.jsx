import { useState } from "react";
import { Icon, formatInt, formatOrderCode } from "../../lib/utils";
import { waLink } from "../../config/business";
import ReviewForm from "./ReviewForm";

export default function OrderSentView({ orderId, form, receiptFile, onReset }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const wasPaidDigital = form.payment === "transferencia" || form.payment === "mercadopago";

  return (
    <div className="po" style={{ zIndex: 250 }}>
      <div className="success">
        <div className="suc-ic">{Icon.check({ size: 40, color: "#fff" })}</div>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28 }}>¡Pedido confirmado!</h2>
        <p style={{ fontSize: 15, color: "var(--t3)", lineHeight: 1.6, marginTop: 12 }}>
          {wasPaidDigital && receiptFile
            ? "Tu comprobante fue recibido. Lo estamos verificando y tu pedido pasará a preparación en breve."
            : wasPaidDigital
            ? "Recordá subir el comprobante de pago para que procesemos tu pedido más rápido."
            : "Estamos preparando todo con mucho amor 🦆"}
        </p>
        {orderId && (<>
          <a href={`/order/${orderId}`} className="tracker-link-btn">
            🔴 Seguir mi pedido en vivo
          </a>
          <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--b2)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 6 }}>📋 Código de tu pedido</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <code style={{ fontSize: 22, fontWeight: 700, color: "var(--tx)", letterSpacing: 2, fontFamily: "'DM Serif Display',monospace" }}>
                {formatOrderCode(orderId)}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(formatOrderCode(orderId)); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }}
                style={{ flexShrink: 0, padding: "6px 12px", background: copiedCode ? "var(--gn, #3A7D44)" : "var(--pr, #C45D3E)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", transition: "background .2s" }}
              >
                {copiedCode ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 8, marginBottom: 0 }}>Usá este código para reclamos, factura o seguimiento.</p>
          </div>
          {form.delivery === "retiro" && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--b2)", borderRadius: 12 }}>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8, fontWeight: 600 }}>📍 Retirá en:</div>
              <div style={{ fontSize: 14, color: "var(--tx)", lineHeight: 1.5, marginBottom: 10 }}>
                Andrés Chazarreta 1435<br/>Villa Rosa, Pilar<br/>Buenos Aires
              </div>
              <a href="https://maps.google.com/?q=Andrés+Chazarreta+1435+Villa+Rosa+Pilar+Buenos+Aires" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ac)", fontWeight: 600, textDecoration: "none" }}>
                📌 Ver en Google Maps
              </a>
            </div>
          )}
        </>)}
        {wasPaidDigital && (
          <a href={waLink('Hola! Acabo de hacer un pedido y tengo una consulta')} target="_blank" rel="noopener noreferrer"
            style={{display:"block",marginTop:14,padding:"10px 16px",background:"#25D366",color:"#fff",borderRadius:12,fontSize:13,fontWeight:600,textAlign:"center",textDecoration:"none"}}>
            💬 ¿Dudas? Escribinos por WhatsApp
          </a>
        )}
        {/* Review form */}
        {orderId && <ReviewForm orderId={orderId} customerName={form.name} customerPhone={form.phone} />}

        <button onClick={onReset} style={{ marginTop: 14, fontSize: 12, color: "var(--t3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 4 }}>
          ← Volver a la tienda
        </button>
      </div>
    </div>
  );
}
