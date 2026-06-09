// src/catalog-pro/OrderSentView.jsx
// Pantalla post-checkout: codigo pedido + tracking + retiro (dinamico) + WA.
// La direccion de retiro sale de settings.store_address (no hardcodeada).

import { useState } from "react";
import { Icon, formatOrderCode } from "../../lib/utils";
import business, { waLink } from "@business";
import { upsertCustomer } from "../../services/phoneAuth";
import { setGuestUser, getGuestUser } from "../../lib/guestUser";

export default function OrderSentView({ orderId, form, receiptFile, onReset, settings = {} }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const wasPaidDigital = form.payment === "transferencia" || form.payment === "mercadopago";
  const primary = business.branding?.primary || "var(--ag-c-terra)";
  const storeAddress = settings?.store_address || "";
  const mapsHref = storeAddress
    ? ("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(storeAddress))
    : null;

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
            <a href={"/order/" + orderId}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 18px", borderRadius: 12,
                background: primary, color: "#fff",
                fontSize: 14, fontWeight: 700, textDecoration: "none",
                marginBottom: 18, boxShadow: "0 6px 18px " + primary + "40",
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

            {form.delivery === "retiro" && storeAddress && (
              <div style={{
                padding: "14px 16px", background: "var(--ag-bg-soft)",
                border: "1px solid var(--ag-line)", borderRadius: 12,
                marginBottom: 14, textAlign: "left",
              }}>
                <div style={{ fontSize: 11, color: "var(--ag-ink-3)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  📍 Retirá en
                </div>
                <div style={{ fontSize: 14, color: "var(--ag-ink)", lineHeight: 1.5, marginBottom: 10 }}>
                  {storeAddress}
                </div>
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ag-c-prep)", fontWeight: 700, textDecoration: "none" }}
                  >
                    📌 Ver en Google Maps
                  </a>
                )}
              </div>
            )}
          </>
        )}

        <ProfileCaptureCard form={form} />

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

// Captura post-pedido: email (cupones) + cumpleaños (premios/galletas).
function ProfileCaptureCard({ form }) {
  const guest = getGuestUser();
  const hasEmail = !!(form?.email || guest?.email);
  const hasBday = !!form?.birth_date;

  const [email, setEmail] = useState("");
  const [bday, setBday] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (hasEmail && hasBday) return null;

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailValid = emailRe.test(email.trim());
  const canSave = (hasEmail || emailValid) && (hasBday || !!bday);

  const onSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const finalEmail = !hasEmail && email.trim() ? email.trim() : (form?.email || guest?.email || null);
      const finalBday = !hasBday && bday ? bday : (form?.birth_date || null);
      await upsertCustomer({
        phone: form?.phone || guest?.phone,
        name: form?.name || guest?.name,
        email: finalEmail,
        birth_date: finalBday,
      });
      setGuestUser({
        id: guest?.id || null,
        name: guest?.name || form?.name || "",
        phone: guest?.phone || form?.phone || "",
        email: finalEmail || guest?.email || "",
      });
      setSaved(true);
    } catch (e) {
      console.warn("profile capture:", e?.message);
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
        ✓ ¡Listo! Te vamos a mimar con cupones y un regalo en tu cumpleaños. 🎂
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
        Sumá beneficios
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--ag-ink-3, #9C8B7A)", lineHeight: 1.5 }}>
        Dejá tu correo para optar por cupones y descuentos, y tu fecha de nacimiento para premios y galletas gratis en tu cumpleaños. 🎂
      </p>

      {!hasEmail && (
        <input
          type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          style={{
            width: "100%", height: 40, padding: "0 12px", marginBottom: 8,
            background: "#fff", color: "var(--ag-ink, #2D1B0E)",
            border: "1px solid var(--ag-line, rgba(0,0,0,0.15))",
            borderRadius: 10, fontFamily: "inherit", fontSize: 13, outline: "none",
            boxSizing: "border-box",
          }}
        />
      )}

      {!hasBday && (
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ display: "block", fontSize: 11, color: "var(--ag-ink-3, #9C8B7A)", marginBottom: 4 }}>Fecha de nacimiento</span>
          <input
            type="date" value={bday}
            onChange={(e) => setBday(e.target.value)}
            style={{
              width: "100%", height: 40, padding: "0 12px",
              background: "#fff", color: "var(--ag-ink, #2D1B0E)",
              border: "1px solid var(--ag-line, rgba(0,0,0,0.15))",
              borderRadius: 10, fontFamily: "inherit", fontSize: 13, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </label>
      )}

      <button
        type="button" onClick={onSave} disabled={!canSave || saving}
        style={{
          width: "100%", height: 42, border: 0, borderRadius: 10,
          background: canSave ? "var(--ag-c-terra, #C45D3E)" : "var(--ag-bg-card, #f3ede4)",
          color: canSave ? "#fff" : "var(--ag-ink-3, #9C8B7A)",
          fontFamily: "inherit", fontSize: 13, fontWeight: 700,
          cursor: canSave ? "pointer" : "not-allowed",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Guardando..." : "Guardar mis beneficios"}
      </button>
    </div>
  );
}
