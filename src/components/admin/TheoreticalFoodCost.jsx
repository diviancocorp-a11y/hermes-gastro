// src/components/admin/TheoreticalFoodCost.jsx
// Detector de fugas: compara Food Cost teórico vs real.
//
// THEORETICAL: lo que deberías haber gastado según las ventas del mes.
//   = Σ (sales[i].qty × recipe.ingredients[j].qty × ingredient.cost)
//   agrupado por food_category.
//
// ACTUAL: lo que efectivamente gastaste en comida ese mes.
//   = Σ expenses.amount donde usar_category ∈ {food_protein, food_dairy, ...}
//   agrupado por food_category.
//
// VARIANCE = (actual − theoretical) / theoretical × 100
//   > +10% → fuga (merma + robo + sobreporción)
//   < −10% → sobre-stockeo o recetas mal cargadas
//
// Importante: si actual < theoretical podrías estar consumiendo stock viejo
// sin compras del mes. NO es necesariamente bueno — revisar stock_inicial.

import { useMemo } from "react";
import { formatInt } from "../../lib/utils";
import { FOOD_CATEGORIES } from "../../constants/usar";

const VARIANCE_ALERT_THRESHOLD = 10; // %

function variance(actual, theoretical) {
  if (!theoretical || theoretical === 0) return null;
  return ((actual - theoretical) / theoretical) * 100;
}

function statusFromVariance(v) {
  if (v == null) return { kind: "neutral", label: "Sin teórico" };
  if (Math.abs(v) <= VARIANCE_ALERT_THRESHOLD) return { kind: "good", label: "Dentro del rango" };
  if (v > 0) return { kind: "bad", label: "Fuga (gastaste de más)" };
  return { kind: "warn", label: "Bajo (revisar stock previo o recetas)" };
}

const STATUS_STYLE = {
  good:    { fg: "var(--ag-c-sales)",  bg: "var(--ag-c-sales-soft)",  icon: "✓" },
  bad:     { fg: "var(--ag-c-orders)", bg: "var(--ag-c-orders-soft)", icon: "⚠" },
  warn:    { fg: "var(--ag-c-stock)",  bg: "var(--ag-c-stock-soft)",  icon: "?" },
  neutral: { fg: "var(--ag-ink-3)",    bg: "var(--ag-bg-soft)",       icon: "—" },
};

export default function TheoreticalFoodCost({
  sales = [],
  expenses = [],
  ingredients = [],
  recipes = [],
}) {
  // ─── Theoretical por food_category ────────────────────────
  const theoreticalByCat = useMemo(() => {
    const map = { protein: 0, dairy: 0, vegetable: 0, dry: 0, beverage: 0, packaging: 0 };
    sales.forEach(s => {
      const r = recipes.find(x => x.id === s.recipe_id);
      if (!r?.ingredients) return;
      const qty = Number(s.qty) || 1;
      r.ingredients.forEach(ri => {
        const ig = ingredients.find(i => i.id === ri.ingredient_id);
        if (!ig) return;
        const cost = (Number(ig.cost) || 0) * (Number(ri.quantity) || 0) * qty;
        const cat = ig.food_category || "dry";
        if (cat in map) map[cat] += cost;
      });
    });
    return map;
  }, [sales, recipes, ingredients]);

  // ─── Actual por food_category (gastos del mes en food_*) ──
  const actualByCat = useMemo(() => {
    const map = { protein: 0, dairy: 0, vegetable: 0, dry: 0, beverage: 0, packaging: 0 };
    expenses.forEach(e => {
      const usar = e.usar_category;
      if (!usar) return;
      const amt = Number(e.amount) || 0;
      if (usar === "packaging") { map.packaging += amt; return; }
      if (usar.startsWith("food_")) {
        const cat = usar.replace(/^food_/, "");
        if (cat in map) map[cat] += amt;
      }
    });
    return map;
  }, [expenses]);

  // ─── Totales ──────────────────────────────────────────────
  const totalTheoretical = Object.values(theoreticalByCat).reduce((s, n) => s + n, 0);
  const totalActual = Object.values(actualByCat).reduce((s, n) => s + n, 0);
  const totalVariance = variance(totalActual, totalTheoretical);
  const totalStatus = statusFromVariance(totalVariance);

  if (totalTheoretical === 0 && totalActual === 0) {
    return (
      <div className="ag-card" style={{ padding: "20px 16px", textAlign: "center", color: "var(--ag-ink-3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Sin datos para comparar</div>
        <div style={{ fontSize: 11.5 }}>Necesitás ventas y gastos USAR cargados este mes.</div>
      </div>
    );
  }

  const totalStyle = STATUS_STYLE[totalStatus.kind];

  return (
    <div className="ag-card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ag-ink)" }}>Detector de fugas · Teórico vs Real</div>
        <div style={{ fontSize: 10, color: "var(--ag-ink-3)" }}>Alerta &gt; ±{VARIANCE_ALERT_THRESHOLD}%</div>
      </div>
      <p style={{ fontSize: 11, color: "var(--ag-ink-3)", margin: "4px 0 12px", lineHeight: 1.4 }}>
        Compara cuánto <strong>deberías</strong> haber gastado según ventas + recetas (teórico), vs cuánto <strong>realmente</strong> gastaste en comida (actual). Diferencias grandes indican merma, robo o sobreporción.
      </p>

      {/* TOTAL — banner principal */}
      <div style={{
        padding: "12px 14px", borderRadius: 10,
        background: totalStyle.bg,
        borderLeft: `3px solid ${totalStyle.fg}`,
        marginBottom: 12,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            DESVÍO TOTAL
          </div>
          {totalVariance != null && (
            <div style={{ fontSize: 18, fontWeight: 800, color: totalStyle.fg, fontVariantNumeric: "tabular-nums" }}>
              {totalVariance > 0 ? "+" : ""}{totalVariance.toFixed(1)}%
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
          <div>
            <div style={{ fontSize: 9.5, color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Teórico</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink)" }}>${formatInt(totalTheoretical)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Real</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink)" }}>${formatInt(totalActual)}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: totalStyle.fg, marginTop: 6 }}>
          {totalStyle.icon} {totalStatus.label}
        </div>
      </div>

      {/* DESGLOSE POR CATEGORÍA */}
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        Detalle por categoría
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {FOOD_CATEGORIES.map(c => {
          const theo = theoreticalByCat[c.value] || 0;
          const real = actualByCat[c.value] || 0;
          const v = variance(real, theo);
          const status = statusFromVariance(v);
          const style = STATUS_STYLE[status.kind];
          // Skip categorías sin datos
          if (theo === 0 && real === 0) return null;

          return (
            <div
              key={c.value}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: style.bg,
                borderLeft: `2px solid ${style.fg}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ag-ink)" }}>
                  {c.icon} {c.label}
                </span>
                {v != null && (
                  <span style={{ fontSize: 12, fontWeight: 800, color: style.fg, fontVariantNumeric: "tabular-nums" }}>
                    {v > 0 ? "+" : ""}{v.toFixed(1)}%
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 10.5, color: "var(--ag-ink-2)" }}>
                <span>Teórico <strong>${formatInt(theo)}</strong></span>
                <span>Real <strong>${formatInt(real)}</strong></span>
                <span>Δ <strong>${formatInt(real - theo)}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 9.5, color: "var(--ag-ink-3)", margin: "10px 0 0", lineHeight: 1.4, fontStyle: "italic" }}>
        Limitación: no contempla stock inicial/final. Si compraste para stockear (excedente vs consumo del mes), aparece como variance positivo aunque no sea fuga real.
      </p>
    </div>
  );
}
