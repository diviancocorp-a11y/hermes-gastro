// src/catalog-pro/CartScreen.jsx
// Carrito catalog-pro: items + cupón + propina + resumen + CTA.
// Conectado al carrito real del Catalog.
//
// Props:
//   items: [{id, name, price, qty, img}]
//   subtotal, discount, shipping, deliveryLabel
//   coupon (obj o null), couponCode, onCouponCodeChange, onApplyCoupon, onRemoveCoupon, couponErr
//   tip, onTipChange
//   onBack(), onUpdateQty(id, qty), onContinue(), onSeguirAgregando()

import Icon from "./Icon";
import { fmtAR } from "./format";
import { toneFor } from "./homeHelpers";

function SumRow({ label, value, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--t2)" }}>{label}</span>
      <span style={{ color: accent || "var(--tx)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function CartScreen({
  items = [], subtotal = 0, discount = 0, shipping = 0, deliveryLabel = "retiro en local",
  coupon, couponCode = "", onCouponCodeChange, onApplyCoupon, onRemoveCoupon, couponErr,
  tip = 0, onTipChange,
  onBack, onUpdateQty, onContinue, onSeguirAgregando,
}) {
  const count = items.reduce((s, it) => s + it.qty, 0);
  const tipAmount = Math.round(subtotal * (tip / 100));
  const total = subtotal - discount + tipAmount + shipping;

  if (items.length === 0) {
    return (
      <div className="cp-root cp-surface" style={{ position: "fixed", inset: 0, width: "100%", zIndex: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>🛒</div>
        <h2 className="h-2" style={{ margin: "0 0 8px" }}>Tu pedido está vacío</h2>
        <p className="body-s" style={{ margin: "0 0 20px" }}>Agregá algo rico del catálogo.</p>
        <button onClick={onBack} style={{ height: 48, padding: "0 24px", borderRadius: "var(--rs)", border: 0, background: "var(--ac)", color: "#fff", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 15, cursor: "pointer" }}>
          Volver al menú
        </button>
      </div>
    );
  }

  return (
    <div className="cp-root cp-surface cp-no-scrollbar" style={{ position: "fixed", inset: 0, width: "100%", zIndex: 240, overflowY: "auto", paddingBottom: 130 }}>
      {/* Header */}
      <div style={{ padding: "16px 14px 10px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, background: "var(--bg)", zIndex: 5, borderBottom: "1px solid var(--line)" }}>
        <button onClick={onBack} style={iconBtn} aria-label="Atrás"><Icon name="arrow-left" size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, color: "var(--tx)" }}>Mi pedido</div>
          <div className="body-s" style={{ fontSize: 11 }}>{count} productos</div>
        </div>
      </div>

      {/* Greeting editorial */}
      <div style={{ padding: "16px 22px 4px" }}>
        <h1 className="h-2" style={{ margin: 0 }}>
          Revisá lo que <em style={{ fontStyle: "italic", color: "var(--t2)" }}>te llevás</em>
        </h1>
      </div>

      {/* Items */}
      <div style={{ padding: "8px 22px 0" }}>
        {items.map((it, i) => (
          <div key={it.id} style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none" }}>
            <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 12, overflow: "hidden", background: toneFor(it.name) }}>
              {it.img && <img src={it.img} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 16, color: "var(--tx)", lineHeight: 1.2, marginBottom: 6 }}>{it.name}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                {/* Stepper inline */}
                <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 999, overflow: "hidden" }}>
                  <button onClick={() => onUpdateQty?.(it.id, it.qty - 1)} style={stepBtn}>
                    {it.qty <= 1 ? <Icon name="x" size={13} /> : <Icon name="minus" size={13} />}
                  </button>
                  <span style={{ minWidth: 22, textAlign: "center", fontWeight: 600, fontSize: 13 }}>{it.qty}</span>
                  <button onClick={() => onUpdateQty?.(it.id, it.qty + 1)} style={stepBtn}><Icon name="plus" size={13} /></button>
                </div>
                <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, color: "var(--tx)" }}>{fmtAR(it.price * it.qty)}</span>
              </div>
            </div>
          </div>
        ))}
        <button onClick={onSeguirAgregando} style={{
          width: "100%", marginTop: 14, height: 44, borderRadius: 12,
          border: "1.5px dashed var(--line)", background: "transparent",
          color: "var(--t2)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, cursor: "pointer",
        }}>+ Seguir agregando productos</button>
      </div>

      {/* Cupón */}
      <div style={{ padding: "28px 22px 0" }}>
        <h3 style={{ margin: "0 0 12px", fontFamily: "var(--font-heading)", fontSize: 20, color: "var(--tx)" }}>Cupón de descuento</h3>
        {coupon ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderRadius: 12,
            background: "color-mix(in oklab, var(--ok) 10%, transparent)",
            border: "1px solid color-mix(in oklab, var(--ok) 40%, transparent)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="ticket" size={18} style={{ color: "var(--ok)" }} />
              <div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ok)" }}>{coupon.code || couponCode}</div>
                <div style={{ fontSize: 11, color: "var(--t2)" }}>−{coupon.discount_pct}% aplicado</div>
              </div>
            </div>
            <button onClick={onRemoveCoupon} style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--t3)" }}><Icon name="x" size={16} /></button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid var(--line)", borderRadius: 12, padding: 4 }}>
              <input
                value={couponCode}
                onChange={(e) => onCouponCodeChange?.(e.target.value.toUpperCase())}
                placeholder="Ingresá tu cupón"
                style={{ flex: 1, height: 44, border: 0, padding: "0 12px", background: "transparent", fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--tx)", outline: "none", letterSpacing: "0.05em" }}
              />
              <button onClick={onApplyCoupon} disabled={!couponCode} style={{
                height: 40, padding: "0 16px", borderRadius: 8, border: 0,
                background: couponCode ? "var(--tx)" : "var(--b3)",
                color: couponCode ? "var(--bg)" : "var(--t3)",
                fontSize: 13, fontWeight: 500, cursor: couponCode ? "pointer" : "not-allowed", fontFamily: "var(--font-body)",
              }}>Aplicar</button>
            </div>
            {couponErr && <div style={{ fontSize: 12, color: "var(--err)", marginTop: 6 }}>{couponErr}</div>}
          </>
        )}
      </div>

      {/* Propina */}
      <div style={{ padding: "28px 22px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 20, color: "var(--tx)" }}>Propina para la cocina</h3>
          <span className="caption" style={{ color: "var(--t3)", fontSize: 10 }}>Opcional</span>
        </div>
        <p className="body-s" style={{ fontSize: 12, marginTop: 0, marginBottom: 12 }}>100% va para el equipo.</p>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 5, 10, 15, 20].map(v => (
            <button key={v} onClick={() => onTipChange?.(v)} style={{
              flex: 1, height: 44, borderRadius: 10,
              background: tip === v ? "var(--tx)" : "transparent",
              color: tip === v ? "var(--bg)" : "var(--t2)",
              border: "1px solid " + (tip === v ? "var(--tx)" : "var(--line)"),
              fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}>{v === 0 ? "No" : `${v}%`}</button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div style={{ padding: "32px 22px 0" }}>
        <div style={{ background: "var(--b2)", borderRadius: 14, padding: "18px" }}>
          <div className="caption" style={{ marginBottom: 14 }}>Resumen</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SumRow label="Subtotal" value={fmtAR(subtotal)} />
            {discount > 0 && <SumRow label="Cupón" value={`−${fmtAR(discount)}`} accent="var(--ok)" />}
            {tipAmount > 0 && <SumRow label={`Propina · ${tip}%`} value={fmtAR(tipAmount)} />}
            <SumRow label={`Envío · ${deliveryLabel}`} value={shipping > 0 ? fmtAR(shipping) : "Gratis"} accent={shipping > 0 ? undefined : "var(--t3)"} />
          </div>
          <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid var(--line)" }} />
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span className="body-m" style={{ fontWeight: 500, color: "var(--tx)" }}>Total a pagar</span>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 28, color: "var(--tx)" }}>{fmtAR(total)}</span>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
        background: "var(--bg)", borderTop: "1px solid var(--line)",
        padding: "14px 22px max(20px, env(safe-area-inset-bottom))",
      }}>
        <button onClick={() => onContinue?.(tip, tipAmount)} style={{
          width: "100%", height: 56, borderRadius: "var(--rs)", border: 0,
          background: "var(--ac)", color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingLeft: 22, paddingRight: 18, fontFamily: "var(--font-body)",
        }}>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
            <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 400 }}>Continuar al pago</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{count} ítems</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 22 }}>{fmtAR(total)}</span>
            <Icon name="arrow-right" size={18} />
          </span>
        </button>
      </div>
    </div>
  );
}

const iconBtn = { width: 38, height: 38, borderRadius: 999, background: "transparent", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tx)", cursor: "pointer", flexShrink: 0 };
const stepBtn = { width: 30, height: 30, border: 0, background: "transparent", color: "var(--t2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
