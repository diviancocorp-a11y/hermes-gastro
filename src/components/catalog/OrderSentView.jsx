// src/catalog-pro/OrderSentView.jsx
// Pantalla post-checkout: usa el TEMA del catalogo (cp-root + tokens --*).
// Direccion de retiro dinamica (settings.store_address). Recibe un snapshot
// del form (el form vivo del catalogo se resetea al confirmar).

import { useState } from "react";
import { Icon, formatOrderCode } from "../../lib/utils";
import { waLink } from "@business";
import { upsertCustomer } from "../../services/phoneAuth";
import { setGuestUser, getGuestUser } from "../../lib/guestUser";
import OrderStatusCard from "../../catalog-pro/OrderStatusCard";
import { cancelOwnOrder, useRegretCountdown } from "../../catalog-pro/regretOrder";

const GREEN = "#16A34A";

export default function OrderSentView({ orderId, form, receiptFile, onReset, settings = {} }) {
  const [copiedCode, setCopiedCode] = useState(false);
  // Arrepentimiento: el pedido se acaba de crear, ventana de 60s desde ahora
  const [placedAt] = useState(() => Date.now());
  const regretLeft = useRegretCountdown(orderId ? placedAt : null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const onRegret = async () => {
    if (cancelling) return;
    setCancelling(true);
    const ok = await cancelOwnOrder(orderId);
    setCancelling(false);
    if (ok) setCancelled(true);
  };
  const wasPaidDigital = form.payment === "transferencia" || form.payment === "mercadopago";
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
      className="cp-root cp-surface"
      data-testid="order-confirmation"
      style={{
        position: "fixed", inset: 0, background: "var(--bg)", color: "var(--tx)",
        zIndex: 250, overflowY: "auto",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
        padding: "32px 18px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>

        <div style={{
          width: 88, height: 88, margin: "0 auto 16px", borderRadius: "50%",
          background: GREEN,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 12px 28px rgba(22,163,74,0.28)",
        }}>
          {Icon.check({ size: 44, color: "#fff" })}
        </div>

        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 28, margin: "0 0 12px", color: "var(--tx)" }}>
          ¡Pedido confirmado!
        </h2>

        <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 24px" }}>
          {wasPaidDigital && receiptFile
            ? "Tu comprobante fue recibido. Lo estamos verificando y tu pedido pasará a preparación en breve."
            : wasPaidDigital
            ? "Recordá subir el comprobante de pago para que procesemos tu pedido más rápido."
            : "Estamos preparando todo con mucho amor."}
        </p>

        {orderId && (
          <>
            {/* StatusCard de seguimiento (card-24 adaptado) */}
            {!cancelled ? (
              <>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: regretLeft > 0 ? 10 : 18 }}>
                  <OrderStatusCard href={"/order/" + orderId} />
                </div>
                {/* Arrepentimiento: 60s para cancelar si se equivoco */}
                {regretLeft > 0 && (
                  <button onClick={onRegret} disabled={cancelling} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    margin: "0 auto 18px", padding: "10px 18px", borderRadius: 999,
                    border: "1px solid var(--err, #C62828)", background: "transparent",
                    color: "var(--err, #C62828)", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    {cancelling ? "Cancelando…" : `✕ ¿Te equivocaste? Cancelar pedido (${regretLeft}s)`}
                  </button>
                )}
              </>
            ) : (
              <div style={{
                margin: "0 auto 18px", maxWidth: 420, padding: "16px 18px",
                borderRadius: 16, background: "var(--b2)", border: "1px solid var(--line)",
                fontSize: 14, color: "var(--tx)", fontWeight: 600,
              }}>
                ✓ Pedido cancelado — no se te cobró nada. Podés volver a la carta y pedir de nuevo.
              </div>
            )}

            <div style={{
              padding: "14px 16px", background: "var(--b2)",
              border: "1px solid var(--line)", borderRadius: 12,
              marginBottom: 14, textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                📋 Código de tu pedido
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <code style={{ fontSize: 22, fontWeight: 700, color: "var(--tx)", letterSpacing: 2, fontFamily: "var(--font-heading)" }}>
                  {formatOrderCode(orderId)}
                </code>
                <button onClick={copyCode}
                  style={{
                    flexShrink: 0, padding: "6px 14px",
                    background: copiedCode ? GREEN : "var(--ac)",
                    color: "#fff", border: "none", borderRadius: 8,
                    fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                  }}
                >
                  {copiedCode ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--t3)", margin: "8px 0 0", lineHeight: 1.4 }}>
                Usá este código para reclamos, factura o seguimiento.
              </p>
            </div>

            {form.delivery === "retiro" && storeAddress && (
              <div style={{
                padding: "14px 16px", background: "var(--b2)",
                border: "1px solid var(--line)", borderRadius: 12,
                marginBottom: 14, textAlign: "left",
              }}>
                <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  📍 Retirá en
                </div>
                <div style={{ fontSize: 14, color: "var(--tx)", lineHeight: 1.5, marginBottom: 10 }}>
                  {storeAddress}
                </div>
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ac)", fontWeight: 700, textDecoration: "none" }}
                  >
                    📌 Ver en Google Maps
                  </a>
                )}
              </div>
            )}
          </>
        )}

        {/* Card 1: cupones (email) — Card 2: cumpleaños */}
        <EmailCard form={form} />
        <BirthdayCard form={form} />

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
            marginTop: 4, fontSize: 12, color: "var(--t3)",
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

const cardBox = {
  padding: 16, background: "var(--b2)",
  border: "1px dashed var(--line)", borderRadius: 14,
  marginBottom: 14, textAlign: "left",
};
const inputBox = {
  width: "100%", height: 40, padding: "0 12px",
  background: "var(--bg)", color: "var(--tx)",
  border: "1px solid var(--line)", borderRadius: 10,
  fontFamily: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box",
};
const savedBox = {
  padding: "12px 16px", background: "rgba(22,163,74,0.12)",
  border: "1px solid rgba(22,163,74,0.4)", borderRadius: 12,
  marginBottom: 14, fontSize: 13, color: GREEN, textAlign: "center", fontWeight: 600,
};
function saveBtn(enabled, saving) {
  return {
    width: "100%", height: 42, border: 0, borderRadius: 10,
    background: enabled ? "var(--ac)" : "var(--b3)",
    color: enabled ? "#fff" : "var(--t3)",
    fontFamily: "inherit", fontSize: 13, fontWeight: 700,
    cursor: enabled ? "pointer" : "not-allowed", opacity: saving ? 0.7 : 1,
  };
}

// ─── Card de cupones (email) ───
function EmailCard({ form }) {
  const guest = getGuestUser();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (form?.email) return null; // ya dejó email en el pedido

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const onSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await upsertCustomer({ phone: form?.phone || guest?.phone, name: form?.name || guest?.name, email: email.trim() });
      setGuestUser({ id: guest?.id || null, name: guest?.name || form?.name || "", phone: guest?.phone || form?.phone || "", email: email.trim() });
      setSaved(true);
    } catch (e) { console.warn("email capture:", e?.message); }
    finally { setSaving(false); }
  };

  if (saved) return <div style={savedBox}>✓ ¡Listo! Te vamos a avisar de cupones y descuentos. 🎟️</div>;

  return (
    <div style={cardBox}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)", marginBottom: 4 }}>🎟️ Cupones y descuentos</div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>
        Dejá tu correo y te avisamos cuando haya cupones y promociones exclusivas para vos.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          onKeyDown={(e) => e.key === "Enter" && valid && onSave()}
          style={{ ...inputBox, flex: 1 }} />
        <button type="button" onClick={onSave} disabled={!valid || saving}
          style={{ ...saveBtn(valid, saving), width: "auto", padding: "0 16px" }}>
          {saving ? "..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ─── Card de cumpleaños (premios / galletas) ───
function BirthdayCard({ form }) {
  const guest = getGuestUser();
  const [bday, setBday] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (form?.birth_date) return null; // ya dejó su cumple en el pedido

  const onSave = async () => {
    if (!bday || saving) return;
    setSaving(true);
    try {
      await upsertCustomer({ phone: form?.phone || guest?.phone, name: form?.name || guest?.name, birth_date: bday });
      setSaved(true);
    } catch (e) { console.warn("bday capture:", e?.message); }
    finally { setSaving(false); }
  };

  if (saved) return <div style={savedBox}>✓ ¡Listo! Te vamos a mimar con un regalo en tu cumpleaños. 🎂</div>;

  return (
    <div style={cardBox}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)", marginBottom: 4 }}>🎂 Premios de cumpleaños</div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>
        Registrá tu fecha de nacimiento y optá por premios y galletas gratis en tu cumpleaños.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="date" value={bday} onChange={(e) => setBday(e.target.value)} style={{ ...inputBox, flex: 1 }} />
        <button type="button" onClick={onSave} disabled={!bday || saving}
          style={{ ...saveBtn(!!bday, saving), width: "auto", padding: "0 16px" }}>
          {saving ? "..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
