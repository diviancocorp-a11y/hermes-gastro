// src/catalog-pro/SearchScreen.jsx
// Búsqueda predictiva: idle (recientes + categorías) / typing (matches con highlight) / empty.
//
// Props: products (real), categories, recents (localStorage-managed afuera),
//   onBack(), onSelectProduct(p), onSelectCategory(name), onAddToCart(p)

import { useState, useMemo, useRef, useEffect } from "react";
import Icon from "./Icon";
import { fmtAR } from "./format";
import { ProductPhoto, AddRound } from "./atoms";
import { mapProduct } from "./homeHelpers";

const RECENTS_KEY = "cp_recent_searches";

function getRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]"); } catch { return []; }
}
function pushRecent(q) {
  if (!q || q.length < 2) return;
  try {
    const cur = getRecents().filter(x => x.toLowerCase() !== q.toLowerCase());
    const next = [q, ...cur].slice(0, 6);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {}
}

function highlight(text, q) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <strong style={{ color: "var(--ac)", fontWeight: 700 }}>{text.slice(i, i + q.length)}</strong>
      {text.slice(i + q.length)}
    </>
  );
}

export default function SearchScreen({
  products = [], categories = [], hasDeal, dealPrice, prepDefault,
  onBack, onSelectProduct, onSelectCategory, onAddToCart,
}) {
  const [q, setQ] = useState("");
  const [recents, setRecents] = useState(getRecents());
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const matches = useMemo(() => {
    if (q.length === 0) return [];
    const ql = q.toLowerCase();
    return products
      .filter(p => (p.name || "").toLowerCase().includes(ql) || (p.description || "").toLowerCase().includes(ql))
      .slice(0, 12);
  }, [q, products]);

  const commitSearch = (term) => {
    pushRecent(term);
    setRecents(getRecents());
  };

  const clearRecents = () => {
    try { localStorage.removeItem(RECENTS_KEY); } catch {}
    setRecents([]);
  };

  return (
    <div className="cp-root cp-surface cp-no-scrollbar" style={{ position: "fixed", inset: 0, width: "100%", zIndex: 240, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ padding: "16px 14px 10px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, background: "var(--bg)", zIndex: 5, borderBottom: "1px solid var(--line)" }}>
        <button onClick={onBack} style={iconBtn} aria-label="Atrás"><Icon name="arrow-left" size={18} /></button>
        <div style={{ flex: 1, height: 44, background: "var(--b2)", borderRadius: 12, display: "flex", alignItems: "center", padding: "0 12px", gap: 10 }}>
          <Icon name="search" size={16} style={{ color: "var(--t2)" }} />
          <input
            ref={inputRef} value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && q) commitSearch(q); }}
            placeholder="Buscar producto…"
            style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontFamily: "var(--font-body)", fontSize: 15, color: "var(--tx)" }}
          />
          {q && <button onClick={() => setQ("")} style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--t3)", padding: 4 }}><Icon name="x" size={16} /></button>}
        </div>
      </div>

      {/* TYPING — matches */}
      {q.length > 0 && (
        <div style={{ padding: "8px 0" }}>
          {matches.length === 0 ? (
            <div style={{ padding: "48px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <h3 className="h-3" style={{ margin: "0 0 8px" }}>Nada con «{q}»</h3>
              <p className="body-s" style={{ margin: 0 }}>Probá con otra palabra o mirá las categorías.</p>
            </div>
          ) : matches.map(p => {
            const m = mapProduct(p, { hasDeal, dealPrice, prepDefault });
            return (
              <div key={p.id} onClick={() => { commitSearch(q); onSelectProduct?.(p); }} style={{
                display: "grid", gridTemplateColumns: "52px 1fr auto", gap: 12, alignItems: "center",
                padding: "10px 22px", cursor: "pointer",
              }}>
                <ProductPhoto src={m.img} height={52} radius={8} tone={m.tone} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 14, color: "var(--tx)" }}>
                    {highlight(p.name, q)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2 }}>{fmtAR(m.price)}</div>
                </div>
                <AddRound size={30} onClick={(e) => { e?.stopPropagation?.(); onAddToCart?.(p); }} />
              </div>
            );
          })}
        </div>
      )}

      {/* IDLE — recientes + categorías */}
      {q.length === 0 && (
        <div style={{ padding: "16px 0" }}>
          {recents.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 22px 8px" }}>
                <div className="caption">Búsquedas recientes</div>
                <button onClick={clearRecents} style={{ background: "transparent", border: 0, fontSize: 11, color: "var(--t3)", cursor: "pointer" }}>Limpiar</button>
              </div>
              {recents.map((r, i) => (
                <button key={r} onClick={() => setQ(r)} style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 22px", background: "transparent", border: 0,
                  borderBottom: i < recents.length - 1 ? "1px solid var(--line)" : "none",
                  cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--tx)",
                }}>
                  <Icon name="clock" size={15} style={{ color: "var(--t3)" }} />
                  {r}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: "16px 22px 8px" }}><div className="caption">Categorías</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 22px" }}>
            {categories.filter(c => c.name !== "Todos").map(c => (
              <button key={c.name} onClick={() => onSelectCategory?.(c.name)} style={{
                textAlign: "left", padding: "14px 16px", borderRadius: 12,
                border: "1px solid var(--line)", background: "var(--b2)", cursor: "pointer",
                fontFamily: "var(--font-heading)", fontSize: 16, color: "var(--tx)",
              }}>
                {c.displayName || c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn = {
  width: 38, height: 38, borderRadius: 999, background: "transparent",
  border: "1px solid var(--line)", display: "flex", alignItems: "center",
  justifyContent: "center", color: "var(--tx)", cursor: "pointer", flexShrink: 0,
};
