// src/catalog-pro/TopPedidos.jsx
// "Lo mas pedido" — version lite del patron "connoisseur stack interactor".
// Decision de adaptacion (jun 2026): el original usa GSAP (+50KB), hover de
// desktop y seccion full-screen. Esta version: CSS puro, datos REALES de
// recipe_sale_counts, rotacion automatica (touch-first), compacta, y el tap
// abre el detalle del producto (conversion, no decoracion).
//
// Render null si hay menos de 2 productos con ventas — un local recien
// abierto no muestra la seccion vacia.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtAR } from "../lib/format";

const TILES = 9; // grilla 3x3 del reveal

export default function TopPedidos({ products = [], soldOutIds, onSelectProduct }) {
  const [counts, setCounts] = useState(null);
  const [active, setActive] = useState(0);
  const pausedUntil = useRef(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("recipe_sale_counts")
      .select("recipe_id, sale_count")
      .order("sale_count", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (!cancelled) setCounts(error ? [] : (data || []));
      });
    return () => { cancelled = true; };
  }, []);

  const top = useMemo(() => {
    if (!counts) return [];
    const byId = new Map(products.map(p => [p.id, p]));
    return counts
      .map(c => ({ ...c, p: byId.get(c.recipe_id) }))
      .filter(c => c.p && c.p.image_url && !(soldOutIds && soldOutIds.has(c.recipe_id)))
      .slice(0, 3);
  }, [counts, products, soldOutIds]);

  // Rotacion automatica cada 4s (se pausa 8s tras interaccion del usuario)
  useEffect(() => {
    if (top.length < 2) return;
    const id = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setActive(a => (a + 1) % top.length);
    }, 4000);
    return () => clearInterval(id);
  }, [top.length]);

  if (top.length < 2) return null;
  const current = top[Math.min(active, top.length - 1)];

  const pick = (i) => {
    pausedUntil.current = Date.now() + 8000;
    setActive(i);
  };

  return (
    <div style={{ padding: "4px 22px 18px" }}>
      <style>{`
        @keyframes cp-tp-tile { from { transform: scale(0); } to { transform: scale(1); } }
        .cp-tp-tile { animation: cp-tp-tile 480ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) { .cp-tp-tile { animation: none !important; } }
      `}</style>

      <h2 className="h-1" style={{ margin: "0 0 12px", fontSize: 22 }}>
        Lo más <em style={{ color: "var(--ac)" }}>pedido</em>
      </h2>

      <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
        {/* Lista 01/02/03 */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
          {top.map((t, i) => {
            const on = i === active;
            return (
              <button
                key={t.recipe_id}
                type="button"
                onClick={() => (on ? onSelectProduct?.(t.p) : pick(i))}
                style={{
                  display: "flex", alignItems: "baseline", gap: 10,
                  background: "none", border: 0, padding: 0, textAlign: "left",
                  cursor: "pointer", fontFamily: "inherit", minWidth: 0,
                  transform: on ? "translateX(6px)" : "translateX(0)",
                  transition: "transform 400ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <span style={{
                  fontSize: 15, fontWeight: 800, flexShrink: 0,
                  color: on ? "var(--ac)" : "var(--t3)",
                  transition: "color 300ms",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: "block", fontFamily: "var(--font-heading)",
                    fontSize: on ? 17 : 15, lineHeight: 1.2,
                    color: on ? "var(--tx)" : "var(--t3)",
                    opacity: on ? 1 : 0.65,
                    transition: "all 300ms",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {t.p.name}
                  </span>
                  {on && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ac)" }}>
                      {fmtAR(t.p.sale_price)} · ver →
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Imagen con reveal de mosaico 3x3 (remonta al cambiar de producto) */}
        <button
          type="button"
          onClick={() => onSelectProduct?.(current.p)}
          aria-label={`Ver ${current.p.name}`}
          style={{
            width: 150, height: 150, flexShrink: 0, position: "relative",
            border: 0, padding: 0, background: "none", cursor: "pointer",
          }}
        >
          <div key={current.recipe_id} style={{
            position: "absolute", inset: 0,
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)",
            gap: 3,
          }}>
            {Array.from({ length: TILES }).map((_, i) => (
              <div
                key={i}
                className="cp-tp-tile"
                style={{
                  borderRadius: 6,
                  animationDelay: `${(i % 3) * 55 + Math.floor(i / 3) * 35}ms`,
                  backgroundImage: `url(${current.p.image_url})`,
                  backgroundSize: "300% 300%",
                  backgroundPosition: `${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%`,
                }}
              />
            ))}
          </div>
        </button>
      </div>
    </div>
  );
}
