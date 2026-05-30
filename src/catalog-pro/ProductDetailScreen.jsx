// src/catalog-pro/ProductDetailScreen.jsx
// Detalle de producto — hero inmersivo, header sticky que se opaca al scroll,
// info, notas, reviews (heurístico), "lo piden con esto", sticky CTA.
//
// NOTA: los modificadores (tamaños/extras) del prototipo NO se incluyen porque
// la DB no tiene ese modelo. Cuando exista tabla recipe_modifiers se agregan.
//
// Props:
//   product (real DB shape), related (productos reales),
//   hasDeal(p), dealPrice(p), prepDefault,
//   onBack(), onAddToCart(product, qty), onSelectRelated(p), onToggleFav(id), isFav

import { useState, useRef, useEffect } from "react";
import BadgeTag from "../components/BadgeTag";
import Icon from "./Icon";
import { fmtAR } from "./format";
import { ProductPhoto, Rating, Stepper, AddRound, SectionHeader } from "./atoms";
import { mapProduct } from "./homeHelpers";

export default function ProductDetailScreen({
  product, related = [], hasDeal, dealPrice, prepDefault,
  onBack, onAddToCart, onSelectRelated, onToggleFav, isFav = false,
}) {
  const p = mapProduct(product, { hasDeal, dealPrice, prepDefault });
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 180);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const total = p.price * qty;
  const relatedMapped = related.slice(0, 4).map(x => mapProduct(x, { hasDeal, dealPrice, prepDefault }));

  return (
    <div className="cp-root cp-surface cp-no-scrollbar" ref={scrollRef} style={{
      position: "fixed", inset: 0, width: "100%", zIndex: 240, overflowY: "auto", paddingBottom: 110,
    }}>
      {/* Hero */}
      <div style={{ position: "relative", height: 320 }}>
        <ProductPhoto src={p.img} height={320} radius={0} tone={p.tone} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, background: "linear-gradient(180deg, transparent 0%, var(--bg) 100%)" }} />
      </div>

      {/* Sticky header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        paddingTop: 16, paddingBottom: 10, paddingLeft: 14, paddingRight: 14,
        background: scrolled ? "var(--bg)" : "transparent",
        borderBottom: scrolled ? "1px solid var(--line)" : "1px solid transparent",
        transition: "all 220ms var(--ease)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        pointerEvents: "none",
      }}>
        <button onClick={onBack} style={{
          width: 38, height: 38, borderRadius: 999, pointerEvents: "auto",
          background: scrolled ? "transparent" : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)", border: 0, color: "var(--tx)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}><Icon name="arrow-left" size={18} /></button>
        {scrolled && (
          <div style={{
            position: "absolute", left: 0, right: 0, top: 18, textAlign: "center",
            fontFamily: "var(--font-heading)", fontSize: 16, color: "var(--tx)",
            pointerEvents: "none", padding: "0 56px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{p.name}</div>
        )}
        <button onClick={() => onToggleFav?.(product.id)} style={{
          width: 38, height: 38, borderRadius: 999, pointerEvents: "auto",
          background: scrolled ? "transparent" : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)", border: 0, color: isFav ? "var(--err)" : "var(--tx)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}><Icon name={isFav ? "heart-fill" : "heart"} size={18} /></button>
      </div>

      {/* Info */}
      <div style={{ padding: "0 22px", marginTop: -36, position: "relative", zIndex: 2 }}>
        {p.badge && (
          <span style={{
            display: "inline-block", marginBottom: 12,
            background: "var(--ac)", color: "#fff",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            padding: "4px 9px", borderRadius: 4,
          }}>{p.badge}</span>
        )}
        {p.deal && (
          <div style={{ marginBottom: 10 }}>
            <BadgeTag label={p.dealLabel} tone={p.dealTone} icon={p.dealIcon}>
              {p.dealLong}
            </BadgeTag>
          </div>
        )}
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 34, lineHeight: 1.25, letterSpacing: "-0.01em", margin: "0 0 10px", paddingBottom: "0.06em", color: "var(--tx)" }}>
          {p.name}
        </h1>
        {p.desc && <p className="body-l" style={{ color: "var(--t2)", margin: 0, fontSize: 15 }}>{p.desc}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          <Rating value={p.rating} count={p.reviews} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--t2)" }}>
            <Icon name="clock" size={12} /> {p.prepMin} min
          </span>
        </div>
      </div>

      <hr style={{ margin: "24px 22px 0", border: 0, borderTop: "1px solid var(--line)" }} />

      {/* Notas */}
      <div style={{ padding: "24px 22px 0" }}>
        <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-heading)", fontSize: 20, color: "var(--tx)" }}>
          Notas para la cocina
        </h3>
        <p className="body-s" style={{ marginTop: 0, marginBottom: 12 }}>
          Algo que tengamos en cuenta. Hacemos lo posible — no garantizamos cambios mayores.
        </p>
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Sin sal · cocción jugosa · sin cebolla…" maxLength={140}
          style={{
            width: "100%", minHeight: 80, padding: 14, resize: "none",
            border: "1px solid var(--line)", borderRadius: 12,
            background: "var(--bg)", color: "var(--tx)",
            fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.5, outline: "none",
          }}
        />
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{notes.length}/140</div>
      </div>

      {/* Reviews (heurístico visual) */}
      <div style={{ padding: "32px 22px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 20, color: "var(--tx)" }}>Qué dicen</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "16px 18px", background: "var(--b2)", borderRadius: 14 }}>
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 36, lineHeight: 1, color: "var(--tx)" }}>
              {p.rating.toFixed(1)}
            </div>
            <div className="body-s" style={{ fontSize: 11, marginTop: 4 }}>{p.reviews} opiniones</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            {[5, 4, 3, 2, 1].map(stars => {
              const pct = stars === 5 ? 78 : stars === 4 ? 16 : stars === 3 ? 4 : 1;
              return (
                <div key={stars} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
                  <span style={{ width: 8, color: "var(--t2)" }}>{stars}</span>
                  <div style={{ flex: 1, height: 4, background: "var(--b3)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--ac)" }} />
                  </div>
                  <span style={{ width: 26, textAlign: "right", color: "var(--t3)" }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lo piden con esto */}
      {relatedMapped.length > 0 && (
        <div style={{ padding: "32px 0 0" }}>
          <SectionHeader title="Lo piden" em="con esto" />
          <div className="cp-no-scrollbar" style={{ display: "flex", gap: 12, padding: "0 22px", overflowX: "auto" }}>
            {relatedMapped.map(x => (
              <div key={x.id} onClick={() => onSelectRelated?.(x._raw)} style={{ flex: "0 0 130px", cursor: "pointer" }}>
                <div style={{ position: "relative" }}>
                  <ProductPhoto src={x.img} height={120} radius={10} tone={x.tone} />
                  <div style={{ position: "absolute", bottom: -10, right: 6 }}>
                    <AddRound size={28} onClick={(e) => { e?.stopPropagation?.(); onAddToCart?.(x._raw, 1); }} />
                  </div>
                </div>
                <div style={{ paddingTop: 14 }}>
                  <div style={{
                    fontFamily: "var(--font-heading)", fontSize: 14, color: "var(--tx)", lineHeight: 1.2,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 34,
                  }}>{x.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: "var(--tx)" }}>{fmtAR(x.price)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky CTA */}
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, width: "100%",
        background: "var(--bg)", borderTop: "1px solid var(--line)",
        padding: "14px 22px max(20px, env(safe-area-inset-bottom))",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Stepper value={qty} onChange={(v) => setQty(Math.max(1, v))} size="lg" />
        <button
          onClick={() => onAddToCart?.(product, qty)}
          style={{
            flex: 1, height: 52, borderRadius: "var(--rs)", border: 0,
            background: "var(--ac)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingLeft: 18, paddingRight: 14, cursor: "pointer",
            fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 15,
          }}
        >
          <span>Agregar al pedido</span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>{fmtAR(total)}</span>
        </button>
      </div>
    </div>
  );
}
