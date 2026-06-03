// src/catalog-pro/CartScreen.jsx
// Carrito catalog-pro: items + subtotal + CTA "Continuar al pago".
//
// Mantiene el carrito SIMPLE: solo lo que el cliente ya decidio (items + qty).
// Cupon, propina y envio dependen de decisiones del checkout (medio de pago,
// retiro/delivery), por eso NO se muestran aca. Eso evita "envio gratis"
// fantasma antes de elegir delivery.
//
// Props:
//   items: [{id, name, price, qty, img}]
//   subtotal
//   onBack(), onUpdateQty(id, qty), onContinue(), onSeguirAgregando()

import Icon from "./Icon";
import { fmtAR } from "./format";
import { toneFor } from "./homeHelpers";

export default function CartScreen({
  items = [],
  subtotal = 0,
  onBack, onUpdateQty, onContinue, onSeguirAgregando,
  // Upsell: productos populares para mostrar como "Lo mas pedido"
  // antes del checkout. El user puede agregarlos al carrito desde aca.
  topProducts = [],
  onAddProduct,
}) {
  const count = items.reduce((s, it) => s + it.qty, 0);
  // Excluir lo que ya esta en el carrito.
  const cartIds = new Set(items.map(it => it.id));
  const upsell = (topProducts || []).filter(p => !cartIds.has(p.id)).slice(0, 6);

  if (items.length === 0) {
    return (
      <div className="cp-root cp-surface" style={{ position: "fixed", inset: 0, width: "100%", zIndex: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>🛒</div>
        <h2 className="h-2" style={{ margin: "0 0 8px" }}>Tu pedido esta vacio</h2>
        <p className="body-s" style={{ margin: "0 0 20px" }}>Agrega algo del catalogo.</p>
        <button onClick={onBack} style={{ height: 48, padding: "0 24px", borderRadius: "var(--rs)", border: 0, background: "var(--ac)", color: "#fff", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 15, cursor: "pointer" }}>
          Volver al menu
        </button>
      </div>
    );
  }

  return (
    <div className="cp-root cp-surface cp-no-scrollbar" style={{ position: "fixed", inset: 0, width: "100%", zIndex: 240, overflowY: "auto", paddingBottom: 130 }}>
      {/* Header */}
      <div style={{ padding: "16px 14px 10px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, background: "var(--bg)", zIndex: 5, borderBottom: "1px solid var(--line)" }}>
        <button onClick={onBack} style={iconBtn} aria-label="Atras"><Icon name="arrow-left" size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, color: "var(--tx)" }}>Mi pedido</div>
          <div className="body-s" style={{ fontSize: 11 }}>{count} {count === 1 ? "producto" : "productos"}</div>
        </div>
      </div>

      {/* Greeting editorial */}
      <div style={{ padding: "16px 22px 4px" }}>
        <h1 className="h-2" style={{ margin: 0 }}>
          Revisa lo que <em style={{ fontStyle: "italic", color: "var(--t2)" }}>te llevas</em>
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

      {/* Subtotal — sin cupon/propina/envio (eso se decide en el checkout) */}
      <div style={{ padding: "28px 22px 12px" }}>
        <div style={{ background: "var(--b2)", borderRadius: 14, padding: "18px" }}>
          <div className="caption" style={{ marginBottom: 12, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--t3)" }}>Subtotal</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "var(--t2)" }}>{count} {count === 1 ? "producto" : "productos"}</span>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 28, color: "var(--tx)" }}>{fmtAR(subtotal)}</span>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--t3)", lineHeight: 1.4 }}>
            Envio, cupon y propina se calculan en el siguiente paso.
          </p>
        </div>
      </div>

      {/* Upsell: Lo mas pedido (antes era una seccion del home) */}
      {upsell.length > 0 && (
        <div style={{ padding: "12px 22px 8px" }}>
          <div style={{ marginBottom: 12 }}>
            <div className="caption" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--t3)" }}>Sumale algo extra</div>
            <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-heading)", fontSize: 20, color: "var(--tx)" }}>
              Lo mas <em style={{ fontStyle: "italic", color: "var(--ac)" }}>pedido</em>
            </h3>
          </div>
          <div className="cp-no-scrollbar" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {upsell.map(p => (
              <div key={p.id} style={{
                flex: "0 0 140px", border: "1px solid var(--line)", borderRadius: 12,
                background: "var(--bg)", overflow: "hidden", display: "flex", flexDirection: "column",
              }}>
                <div style={{ height: 90, background: toneFor(p.name), overflow: "hidden" }}>
                  {p.image_url && <img src={p.image_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />}
                </div>
                <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: 13, color: "var(--tx)", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 32 }}>{p.name}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>{fmtAR(p.sale_price)}</span>
                    <button type="button" onClick={() => onAddProduct?.(p)} style={{
                      width: 28, height: 28, borderRadius: 999, border: 0,
                      background: "var(--ac)", color: "#fff", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }} aria-label="Agregar">
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky CTA */}
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
        background: "var(--bg)", borderTop: "1px solid var(--line)",
        padding: "14px 22px max(20px, env(safe-area-inset-bottom))",
      }}>
        <button onClick={() => onContinue?.()} style={{
          width: "100%", height: 56, borderRadius: "var(--rs)", border: 0,
          background: "var(--ac)", color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingLeft: 22, paddingRight: 18, fontFamily: "var(--font-body)",
        }}>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
            <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 400 }}>Continuar al pago</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{count} {count === 1 ? "item" : "items"}</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 22 }}>{fmtAR(subtotal)}</span>
            <Icon name="arrow-right" size={18} />
          </span>
        </button>
      </div>
    </div>
  );
}

const iconBtn = {
  width: 38, height: 38, borderRadius: 999, background: "transparent",
  border: "1px solid var(--line)", display: "flex", alignItems: "center",
  justifyContent: "center", color: "var(--tx)", cursor: "pointer",
};

const stepBtn = {
  width: 28, height: 28, background: "transparent", border: 0,
  color: "var(--tx)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
