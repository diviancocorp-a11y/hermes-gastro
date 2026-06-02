// src/components/catalog/OrderSentView.jsx
// Pantalla post-checkout: código pedido + tracking + retiro + WA.
// Sistema visual v2 (tokens ag-*).

import { useState } from "react";
import { Icon, formatOrderCode } from "../../lib/utils";
import business, { waLink } from "@business";
import { upsertCustomer } from "../../services/phoneAuth";
import { setGuestUser, getGuestUser } from "../../lib/guestUser";

export default function OrderSentView({ orderId, form, receiptFile, onReset }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const wasPaidDigital = form.payment === "transferencia" || form.payment === "mercadopago";
  const primary = business.branding?.primary || "var(--ag-c-terra)";

  const copyCode = () => {
    try {
      navigator.clipboard.writeText(formatOrderCode(orderId));
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  return (
    <div
      data-testid="order-confirmation"
      style={{
        position: "fixed", inset: 0, background: "var(--ag-bg, #fafaf7)",
        zIndex: 250, overflowY: "auto",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
        padding: "32px 18px", fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>

        <div style={{
          width: 88, height: 88, margin: "0 auto 16px", borderRadius: "50%",
          background: "var(--ag-c-sales, #3a8a4a)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 12px 28px rgba(58,138,74,0.25)",
        }}>
          {Icon.check({ size: 44, color: "#fff" })}
        </div>

        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, margin: "0 0 12px", color: "var(--ag-ink, #1a1a1a)" }}>
          ¡Pedido confirmado!
        </h2>

        <p style={{ fontSize: 14, color: "var(--ag-ink-3)", lineHeight: 1.6, margin: "0 0 24px" }}>
          {wasPaidDigital && receiptFile
            ? "Tu comprobante fue recibido. Lo estamos verificando y tu pedido pasará a preparación en breve."
            : wasPaidDigital
            ? "Recordá subir el comprobante de pago para que procesemos tu pedido más rápido."
            : "Estamos preparando todo con mucho amor."}
        </p>

        {orderId && (
          <>
            <a href={`/order/${orderId}`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 18px", borderRadius: 12,
                background: primary, color: "#fff",
                fontSize: 14, fontWeight: 700, textDecoration: "none",
                marginBottom: 18, boxShadow: `0 6px 18px ${primary}40`,
              }}
            >
              🔴 Seguir mi pedido en vivo
            </a>

            <div style={{
              padding: "14px 16px", background: "var(--ag-bg-soft)",
              border: "1px solid var(--ag-line)", borderRadius: 12,
              marginBottom: 14, textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "var(--ag-ink-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                📋 Código de tu pedido
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <code style={{ fontSize: 22, fontWeight: 700, color: "var(--ag-ink)", letterSpacing: 2, fontFamily: "'DM Serif Display', monospace" }}>
                  {formatOrderCode(orderId)}
                </code>
                <button onClick={copyCode}
                  style={{
                    flexShrink: 0, padding: "6px 14px",
                    background: copiedCode ? "var(--ag-c-sales)" : primary,
                    color: "#fff", border: "none", borderRadius: 8,
                    fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                    cursor: "pointer", transition: "background .2s",
                  }}
                >
                  {copiedCode ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--ag-ink-3)", margin: "8px 0 0", lineHeight: 1.4 }}>
                Usá este código para reclamos, factura o seguimiento.
              </p>
            </div>

            {form.delivery === "retiro" && (
              <div style={{
                padding: "14px 16px", background: "var(--ag-bg-soft)",
                border: "1px solid var(--ag-line)", borderRadius: 12,
                marginBottom: 14, textAlign: "left",
              }}>
                <div style={{ fontSize: 11, color: "var(--ag-ink-3)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  📍 Retirá en
                </div>
                <div style={{ fontSize: 14, color: "var(--ag-ink)", lineHeight: 1.5, marginBottom: 10 }}>
                  Andrés Chazarreta 1435<br />Villa Rosa, Pilar<br />Buenos Aires
                </div>
                <a href="https://maps.google.com/?q=Andr%C3%A9s+Chazarreta+1435+Villa+Rosa+Pilar+Buenos+Aires"
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ag-c-prep)", fontWeight: 700, textDecoration: "none" }}
                >
                  📌 Ver en Google Maps
                </a>
              </div>
            )}
          </>
        )}

        {/* Captura post-pedido del email para activar cupones — solo si el cliente NO dejó email */}
        <EmailCaptureCard form={form} />

        {wasPaidDigital && (
          <a href={waLink("Hola! Acabo de hacer un pedido y tengo una consulta")}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: "block", padding: "11px 18px", background: "#25D366",
              color: "#fff", borderRadius: 12, fontSize: 13, fontWeight: 700,
              textAlign: "center", textDecoration: "none", marginBottom: 14,
            }}
          >
            💬 ¿Dudas? Escribinos por WhatsApp
          </a>
        )}

        <button onClick={onReset}
          style={{
            marginTop: 4, fontSize: 12, color: "var(--ag-ink-3)",
            background: "none", border: "none", cursor: "pointer",
            textDecoration: "underline", padding: 8, fontFamily: "inherit",
          }}
        >
          ← Volver a la tienda
        </button>
      </div>
    </div>
  );
}

// ─── EmailCaptureCard ──────────────────────────────────────────
// Después del pedido, si el cliente no dejó email, le ofrecemos guardarlo
// para activar cupones / promociones. El gesto está en el momento de máxima
// satisfacción (acaba de hacer el pedido), conversion rate alto.
function EmailCaptureCard({ form }) {
  const guest = getGuestUser();
  // Si ya hay email cargado, no mostramos nada
  if (form?.email || guest?.email) return null;

  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const onSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await upsertCustomer({
        phone: form?.phone || guest?.phone,
        email: email.trim(),
        name: form?.name || guest?.name,
      });
      // Persistir en localStorage tambien (sin tocar el id)
      setGuestUser({
        id: guest?.id || null,
        name: guest?.name || form?.name || "",
        phone: guest?.phone || form?.phone || "",
        email: email.trim(),
      });
      setSaved(true);
    } catch (e) {
      console.warn("upsert email:", e?.message);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div style={{
        padding: "12px 16px", background: "var(--ag-c-sales-soft, #E8F5E9)",
        border: "1px solid var(--ag-c-sales, #3a8a4a)", borderRadius: 12,
        marginBottom: 14, fontSize: 13, color: "var(--ag-c-sales, #3a8a4a)", textAlign: "center", fontWeight: 600,
      }}>
        ✓ ¡Listo! Te avisamos cuando salgan cupones y promociones para vos.
      </div>
    );
  }

  return (
    <div style={{
      padding: 16, background: "var(--ag-bg-soft, #FBF7F2)",
      border: "1px dashed var(--ag-line, rgba(0,0,0,0.15))", borderRadius: 14,
      marginBottom: 14, textAlign: "left",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink, #2D1B0E)", marginBottom: 4 }}>
        Activá tus cupones
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--ag-ink-3, #9C8B7A)", lineHeight: 1.5 }}>
        Dejá tu email y te avisamos cuando haya cupones y descuentos exclusivos para vos.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          onKeyDown={(e) => e.key === "Enter" && valid && onSave()}
          style={{
            flex: 1, height: 40, padding: "0 12px",
            background: "#fff", color: "var(--ag-ink, #2D1B0E)",
            border: "1px solid var(--ag-line, rgba(0,0,0,0.15))",
            borderRadius: 10, fontFamily: "inherit", fontSize: 13, outline: "none",
            boxSizing: "border-box",
          }}
        />
        <button
          type="button" onClick={onSave} disabled={!valid || saving}
          style={{
            height: 40, padding: "0 16px", border: 0, borderRadius: 10,
            background: valid ? "var(--ag-c-terra, #C45D3E)" : "var(--ag-bg-card, #f3ede4)",
            color: valid ? "#fff" : "var(--ag-ink-3, #9C8B7A)",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            cursor: valid ? "pointer" : "not-allowed",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
