// src/components/admin/MenuEngineering.jsx
// Matriz Kasavana-Smith: clasifica platos en 4 cuadrantes según
// popularidad (mix %) y margen de contribución $.
//
//                ALTA POPULARIDAD       BAJA POPULARIDAD
// ALTA MARGEN    ⭐ STARS               🧩 PUZZLES
// BAJA MARGEN    🐴 PLOWHORSES          🐶 DOGS
//
// Umbral de "alto" vs "bajo":
//   - Popularidad: > popularity_avg → alta. (= 1 / N_items × 0.70 según método clásico)
//   - Margen:      > margin_avg     → alto. ($ contribution margin promedio del menú)
//
// Recibe sales del período + recipes.

import { useMemo, useState } from "react";
import { formatInt } from "../../lib/utils";

// Nombres en espanol (nomenclatura clasica de la matriz Kasavana-Smith
// traducida): Star=Estrella, Puzzle=Incognita, Plowhorse=Caballito de
// batalla, Dog=Perro. Las keys internas quedan en ingles (no tocar).
const QUADRANT_META = {
  star:     { label: "ESTRELLA",  emoji: "⭐", color: "var(--ag-c-sales)",   bg: "var(--ag-c-sales-soft)",   advice: "Tu mejor plato: popular Y rentable. Protegelo, destacalo en el catálogo y no le toques el precio." },
  puzzle:   { label: "INCÓGNITA", emoji: "🧩", color: "var(--ag-c-prep)",    bg: "var(--ag-c-prep-soft)",    advice: "Deja buen margen pero vende poco. Dale visibilidad: foto mejor, primera posición, promo del día." },
  plowhorse:{ label: "CABALLITO", emoji: "🐴", color: "var(--ag-c-stock)",   bg: "var(--ag-c-stock-soft)",   advice: "Vende mucho pero deja poco. Subí el precio de a poco o bajá el costo de la receta (porción/insumo)." },
  dog:      { label: "PERRO",     emoji: "🐶", color: "var(--ag-c-orders)",  bg: "var(--ag-c-orders-soft)",  advice: "Ni vende ni deja margen. Evaluá sacarlo del menú o reinventarlo — ocupa lugar y stock." },
};

function classify(item, avgQty, avgMargin) {
  const popular = item.qty >= avgQty;
  const profitable = item.margin >= avgMargin;
  if (popular && profitable)   return "star";
  if (!popular && profitable)  return "puzzle";
  if (popular && !profitable)  return "plowhorse";
  return "dog";
}

export default function MenuEngineering({
  sales = [],
  recipes = [],
  calculateRecipeCost,
}) {
  const [tab, setTab] = useState("all");
  const [showHelp, setShowHelp] = useState(false);

  // ─── Agregación por receta ────────────────────────────────
  const items = useMemo(() => {
    const map = new Map(); // recipe_id → { qty, revenue, cost }
    sales.forEach(s => {
      const r = recipes.find(x => x.id === s.recipe_id);
      if (!r) return;
      const qty = Number(s.qty) || 1;
      const revenue = Number(s.total) || (Number(r.sale_price) || 0) * qty;
      const unit_cost = s.unit_cost != null && s.unit_cost > 0
        ? Number(s.unit_cost)
        : (calculateRecipeCost?.(r) || 0);
      const cost = unit_cost * qty;
      if (!map.has(r.id)) {
        map.set(r.id, { id: r.id, name: r.name, sale_price: r.sale_price || 0, qty: 0, revenue: 0, cost: 0 });
      }
      const cur = map.get(r.id);
      cur.qty += qty;
      cur.revenue += revenue;
      cur.cost += cost;
    });

    const arr = Array.from(map.values()).map(it => ({
      ...it,
      margin: it.revenue - it.cost,
      marginPct: it.revenue > 0 ? ((it.revenue - it.cost) / it.revenue) * 100 : 0,
      marginPerUnit: it.qty > 0 ? (it.revenue - it.cost) / it.qty : 0,
    }));

    return arr;
  }, [sales, recipes, calculateRecipeCost]);

  // ─── Umbrales: promedio del menú ──────────────────────────
  const totals = useMemo(() => {
    if (items.length === 0) return { avgQty: 0, avgMargin: 0, totalQty: 0, totalRevenue: 0, totalMargin: 0 };
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
    const totalMargin = items.reduce((s, i) => s + i.margin, 0);
    return {
      avgQty: totalQty / items.length,
      avgMargin: totalMargin / items.length,
      totalQty, totalRevenue, totalMargin,
    };
  }, [items]);

  // ─── Clasificar ──────────────────────────────────────────
  const classified = useMemo(() => items.map(it => ({
    ...it,
    quadrant: classify(it, totals.avgQty, totals.avgMargin),
    mixPct: totals.totalQty > 0 ? (it.qty / totals.totalQty) * 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue), [items, totals]);

  // ─── Counts por cuadrante ─────────────────────────────────
  const counts = useMemo(() => {
    const c = { star: 0, puzzle: 0, plowhorse: 0, dog: 0 };
    classified.forEach(it => { c[it.quadrant] += 1; });
    return c;
  }, [classified]);

  const visible = tab === "all" ? classified : classified.filter(it => it.quadrant === tab);

  if (items.length === 0) {
    return (
      <div className="ag-card" style={{ padding: "20px 16px", textAlign: "center", color: "var(--ag-ink-3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Sin ventas para analizar</div>
        <div style={{ fontSize: 11.5 }}>Necesitás ventas registradas en el período para ver el análisis de menú.</div>
      </div>
    );
  }

  // ── Tabs ──────────────────────────────────────────────────
  const tabs = [
    { id: "all",       label: "Todos",         count: items.length },
    { id: "star",      label: "⭐ Estrellas",   count: counts.star,      color: QUADRANT_META.star.color },
    { id: "puzzle",    label: "🧩 Incógnitas",  count: counts.puzzle,    color: QUADRANT_META.puzzle.color },
    { id: "plowhorse", label: "🐴 Caballitos",  count: counts.plowhorse, color: QUADRANT_META.plowhorse.color },
    { id: "dog",       label: "🐶 Perros",      count: counts.dog,       color: QUADRANT_META.dog.color },
  ];

  return (
    <div className="ag-card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ag-ink)" }}>Ingeniería de Menú · Matriz Kasavana</div>
        <div style={{ fontSize: 10, color: "var(--ag-ink-3)" }}>
          {items.length} platos · ${formatInt(totals.totalRevenue)} ingresos
        </div>
      </div>
      <p style={{ fontSize: 11, color: "var(--ag-ink-3)", margin: "4px 0 8px", lineHeight: 1.4 }}>
        Clasifica cada plato según popularidad y margen vs el promedio del menú. <strong>Estrellas</strong> protegé, <strong>Caballitos</strong> subí precio, <strong>Incógnitas</strong> dales visibilidad, <strong>Perros</strong> evaluá sacar.{" "}
        <button type="button" onClick={() => setShowHelp(h => !h)}
          style={{ background: "none", border: 0, padding: 0, color: "var(--ag-c-sales)", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
          {showHelp ? "Ocultar explicación" : "¿Cómo funciona?"}
        </button>
      </p>

      {showHelp && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--ag-bg-soft)", fontSize: 11.5, color: "var(--ag-ink-2)", lineHeight: 1.55, marginBottom: 12 }}>
          <strong>¿Qué es esto?</strong> La matriz Kasavana-Smith es el método clásico de la
          industria gastronómica (1982) para decidir qué hacer con cada plato del menú.
          Cruza dos preguntas: <strong>¿se vende mucho?</strong> (popularidad: unidades vendidas
          vs el promedio de tus platos) y <strong>¿deja plata?</strong> (margen de contribución:
          precio de venta menos costo de receta, vs el promedio).
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>⭐ <strong>Estrella</strong>: vende mucho y deja mucho</div>
            <div>🧩 <strong>Incógnita</strong>: deja mucho, vende poco</div>
            <div>🐴 <strong>Caballito</strong>: vende mucho, deja poco</div>
            <div>🐶 <strong>Perro</strong>: ni vende ni deja</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <strong>Cómo leer cada plato:</strong> "Mix" es qué porcentaje de tus ventas
            representa · "Margen" es la plata que dejó en el período · "Margen %" es
            cuánto de cada peso vendido queda después del costo de insumos.
            El consejo 💡 de cada plato te dice la jugada recomendada.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
        {tabs.map(t => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: on ? `2px solid ${t.color || "var(--ag-c-terra)"}` : "1px solid var(--ag-line)",
                background: on ? (t.color ? `${t.color}22` : "var(--ag-bg-soft)") : "var(--ag-bg)",
                color: on ? (t.color || "var(--ag-c-terra)") : "var(--ag-ink-2)",
                fontSize: 11.5, fontWeight: 700, fontFamily: "inherit",
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {t.label} <span style={{ opacity: 0.65 }}>({t.count})</span>
            </button>
          );
        })}
      </div>

      {/* Lista de platos clasificados */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.length === 0 ? (
          <div style={{ padding: 16, textAlign: "center", color: "var(--ag-ink-3)", fontSize: 12 }}>
            Sin platos en este cuadrante.
          </div>
        ) : visible.map(it => {
          const meta = QUADRANT_META[it.quadrant];
          return (
            <div
              key={it.id}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: meta.bg,
                borderLeft: `3px solid ${meta.color}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  padding: "2px 7px", borderRadius: 999,
                  background: meta.color, color: "#fff",
                  fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em",
                }}>
                  {meta.emoji} {meta.label}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--ag-ink)" }}>
                  {it.name}
                </span>
                <span style={{ fontSize: 11, color: "var(--ag-ink-2)", fontVariantNumeric: "tabular-nums" }}>
                  {it.qty} u
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11, color: "var(--ag-ink-2)" }}>
                <div>
                  <div style={{ fontSize: 9.5, color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mix</div>
                  <div style={{ fontWeight: 700 }}>{it.mixPct.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Margen</div>
                  <div style={{ fontWeight: 700 }}>${formatInt(it.margin)}</div>
                </div>
                <div>
                  {/* Fix Sprint post-4: decia "Margen/u" pero muestra marginPct (porcentaje) */}
                  <div style={{ fontSize: 9.5, color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Margen %</div>
                  <div style={{ fontWeight: 700 }}>{it.marginPct.toFixed(0)}%</div>
                </div>
              </div>

              <p style={{ fontSize: 10.5, color: meta.color, fontWeight: 600, margin: "6px 0 0", lineHeight: 1.3 }}>
                💡 {meta.advice}
              </p>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 9.5, color: "var(--ag-ink-3)", margin: "10px 0 0", lineHeight: 1.3, fontStyle: "italic" }}>
        Umbrales: popularidad promedio = {totals.avgQty.toFixed(1)} unidades/plato · margen promedio = ${formatInt(totals.avgMargin)}/plato.
      </p>
    </div>
  );
}
