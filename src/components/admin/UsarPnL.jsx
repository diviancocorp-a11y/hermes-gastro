// src/components/admin/UsarPnL.jsx
// Reporte P&L USAR Dark Kitchen — desglose con semáforos según targets.
//
// Estructura:
//   INGRESOS POR CANAL
//     ─ línea por canal (con %)
//   = Ingreso Bruto
//   − Comisiones de plataforma
//   = Ingreso Neto
//   − COGS
//     ─ Food Cost (Proteínas / Lácteos / Vegetales / Secos / Bebidas)
//     ─ Packaging
//   = Margen Bruto
//   − Labor BOH
//   − OPEX (Marketing / Rent / Utilities / Other)
//   = EBITDA
//
// Cada % en su propia línea con semáforo (verde si ≤ target, rojo si pasa).

import { useMemo } from "react";
import { formatInt } from "../../lib/utils";
import { FOOD_CATEGORIES, DEFAULT_USAR_TARGETS } from "../../constants/usar";
import DeltaBadge from "../DeltaBadge";

const CHANNEL_LABELS = {
  rappi: "Rappi", pedidosya: "PedidosYa", ubereats: "Uber Eats",
  whatsapp: "WhatsApp", mostrador: "Mostrador", web_own: "Web propia",
};

function pct(num, denom) {
  if (!denom || denom <= 0) return 0;
  return (num / denom) * 100;
}

function formatPct(n) {
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

/**
 * Determina color del semáforo según valor vs target.
 * mode: 'less' (verde si val ≤ target) | 'more' (verde si val ≥ target)
 */
function semaphore(val, target, mode = "less") {
  if (target == null) return "neutral";
  const ok = mode === "less" ? val <= target : val >= target;
  return ok ? "good" : "bad";
}

const COLORS = {
  good:    { fg: "var(--ag-c-sales)",  bg: "var(--ag-c-sales-soft)" },
  bad:     { fg: "var(--ag-c-orders)", bg: "var(--ag-c-orders-soft)" },
  neutral: { fg: "var(--ag-ink-2)",    bg: "var(--ag-bg-soft)" },
};

// Fila del P&L — componente puro a nivel módulo (no recrear en cada render)
function Row({ label, value, kind = "line", indent = 0, percent, semaState = "neutral", note }) {
  const isTotal = kind === "total" || kind === "sub";
  const c = COLORS[semaState] || COLORS.neutral;
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      padding: kind === "header" ? "10px 0 4px" : "5px 0",
      borderTop: kind === "total" ? "1px solid var(--ag-line)" : null,
      borderBottom: kind === "header" ? "1px solid var(--ag-line)" : null,
      marginTop: kind === "total" ? 4 : 0,
      paddingLeft: indent ? indent * 14 : 0,
    }}>
      <span style={{
        flex: 1,
        fontSize: kind === "header" ? 10.5 : isTotal ? 12.5 : 11.5,
        fontWeight: isTotal ? 800 : kind === "header" ? 700 : 500,
        textTransform: kind === "header" ? "uppercase" : "none",
        letterSpacing: kind === "header" ? "0.08em" : 0,
        color: kind === "header" ? "var(--ag-ink-3)" : "var(--ag-ink-2)",
      }}>
        {label}
      </span>
      {percent != null && (
        <span style={{ marginRight: 10 }}>
          <DeltaBadge
            value={formatPct(percent)}
            deltaType={semaState === "good" ? "increase" : semaState === "bad" ? "decrease" : "neutral"}
            variant={semaState === "neutral" ? "outline" : "solid"}
            iconStyle="filled"
            size="sm"
          />
        </span>
      )}
      <span style={{
        fontSize: kind === "header" ? 10.5 : isTotal ? 13.5 : 12.5,
        fontWeight: isTotal ? 800 : 600,
        color: kind === "header" ? "var(--ag-ink-3)" : "var(--ag-ink)",
        fontVariantNumeric: "tabular-nums",
        fontFamily: isTotal ? "'DM Sans', sans-serif" : "inherit",
        minWidth: 80, textAlign: "right",
      }}>
        {value < 0 ? `-$${formatInt(Math.abs(value))}` : `$${formatInt(value)}`}
      </span>
      {note && (
        <span style={{ fontSize: 9.5, color: "var(--ag-ink-3)", marginLeft: 6 }}>{note}</span>
      )}
    </div>
  );
}

export default function UsarPnL({
  orders = [],
  sales = [],
  expenses = [],
  ingredients = [],
  recipes = [],
  settings = {},
  calculateRecipeCost,
}) {
  const targets = settings?.usar_targets || DEFAULT_USAR_TARGETS;

  // ─── INGRESOS POR CANAL ─────────────────────────────────────
  const byChannel = useMemo(() => {
    const map = {};
    orders.filter(o => o.status !== "cancelled").forEach(o => {
      const ch = o.delivery_channel || "mostrador";
      if (!map[ch]) map[ch] = { gross: 0, commission: 0, count: 0 };
      map[ch].gross += Number(o.total) || 0;
      map[ch].commission += Number(o.platform_commission_amt) || 0;
      map[ch].count += 1;
    });
    return Object.entries(map)
      .map(([slug, v]) => ({ slug, label: CHANNEL_LABELS[slug] || slug, ...v }))
      .sort((a, b) => b.gross - a.gross);
  }, [orders]);

  const grossTotal = byChannel.reduce((s, c) => s + c.gross, 0);
  const totalCommission = byChannel.reduce((s, c) => s + c.commission, 0);
  const netRevenue = grossTotal - totalCommission;

  // ─── FOOD COST POR CATEGORÍA ───────────────────────────────
  // Para cada sale: tomar la receta, descomponer en ingredients, sumar costo por food_category
  const foodByCategory = useMemo(() => {
    const map = { protein: 0, dairy: 0, vegetable: 0, dry: 0, beverage: 0, packaging: 0 };
    sales.forEach(s => {
      const r = recipes.find(x => x.id === s.recipe_id);
      if (!r?.ingredients) return;
      const qty = s.qty || 1;
      r.ingredients.forEach(ri => {
        const ig = ingredients.find(i => i.id === ri.ingredient_id);
        if (!ig) return;
        const cost = (ig.cost || 0) * (ri.quantity || 0) * qty;
        const cat = ig.food_category || "dry";
        if (cat in map) map[cat] += cost;
      });
    });
    return map;
  }, [sales, recipes, ingredients]);

  const foodCostTotal = foodByCategory.protein + foodByCategory.dairy + foodByCategory.vegetable + foodByCategory.dry + foodByCategory.beverage;
  const packagingCost = foodByCategory.packaging;
  const cogsTotal = foodCostTotal + packagingCost;
  const grossMargin = netRevenue - cogsTotal;

  // ─── LABOR + OPEX ─────────────────────────────────────────
  const byUsarExpense = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const cat = e.usar_category || "other_opex";
      map[cat] = (map[cat] || 0) + (Number(e.amount) || 0);
    });
    return map;
  }, [expenses]);

  const laborTotal = byUsarExpense.labor_boh || 0;
  const marketingTotal = byUsarExpense.marketing || 0;
  const otherOpex = (byUsarExpense.rent || 0) + (byUsarExpense.utilities || 0) + (byUsarExpense.other_opex || 0);
  const opexTotal = marketingTotal + otherOpex;

  // ─── EBITDA ───────────────────────────────────────────────
  const ebitda = grossMargin - laborTotal - opexTotal;

  // ─── % vs Bruto ───────────────────────────────────────────
  const foodPct = pct(foodCostTotal, grossTotal);
  const packagingPct = pct(packagingCost, grossTotal);
  const cogsPct = pct(cogsTotal, grossTotal);
  const laborPct = pct(laborTotal, grossTotal);
  const marketingPct = pct(marketingTotal, grossTotal);
  const ebitdaPct = pct(ebitda, grossTotal);

  if (grossTotal === 0) {
    return (
      <div className="ag-card" style={{ padding: "20px 16px", textAlign: "center", color: "var(--ag-ink-3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Sin datos USAR este mes</div>
        <div style={{ fontSize: 11.5 }}>Cargá pedidos con canal para ver el P&L.</div>
      </div>
    );
  }

  return (
    <div className="ag-card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ag-ink)" }}>P&L USAR · Dark Kitchen</div>
        <div style={{ fontSize: 10, color: "var(--ag-ink-3)", letterSpacing: "0.05em" }}>
          Targets: Food ≤{targets.food_cost_pct}% · Labor ≤{targets.labor_pct}% · EBITDA ≥{targets.target_ebitda_pct}%
        </div>
      </div>

      {/* ── INGRESOS ──────────────────────────────────────── */}
      <Row label="Ingresos por canal" kind="header" />
      {byChannel.map(c => (
        <Row
          key={c.slug}
          label={`${c.label} · ${c.count} pedidos`}
          value={c.gross}
          percent={pct(c.gross, grossTotal)}
          indent={1}
        />
      ))}
      <Row label="Ingreso Bruto" value={grossTotal} kind="total" />

      <Row label="− Comisiones plataforma" value={-totalCommission} />
      <Row label="Ingreso Neto" value={netRevenue} kind="total" />

      {/* ── COGS ──────────────────────────────────────────── */}
      <Row label="COGS — Costo de mercadería" kind="header" />
      {FOOD_CATEGORIES.filter(c => c.value !== "packaging").map(c => (
        <Row
          key={c.value}
          label={`${c.icon} ${c.label}`}
          value={-(foodByCategory[c.value] || 0)}
          indent={1}
        />
      ))}
      <Row
        label="Food Cost total"
        value={-foodCostTotal}
        percent={foodPct}
        semaState={semaphore(foodPct, targets.food_cost_pct, "less")}
        kind="sub"
        indent={1}
      />
      <Row
        label="📦 Packaging"
        value={-packagingCost}
        percent={packagingPct}
        semaState={semaphore(packagingPct, targets.packaging_pct, "less")}
        indent={1}
      />
      <Row label="COGS total" value={-cogsTotal} percent={cogsPct} kind="total" />

      <Row label="Margen Bruto" value={grossMargin} percent={pct(grossMargin, grossTotal)} kind="total" />

      {/* ── LABOR ────────────────────────────────────────── */}
      <Row label="Labor" kind="header" />
      <Row
        label="Personal cocina (BOH)"
        value={-laborTotal}
        percent={laborPct}
        semaState={semaphore(laborPct, targets.labor_pct, "less")}
        indent={1}
      />

      {/* ── OPEX ─────────────────────────────────────────── */}
      <Row label="OPEX" kind="header" />
      <Row
        label="Marketing digital"
        value={-marketingTotal}
        percent={marketingPct}
        semaState={semaphore(marketingPct, targets.marketing_pct, "less")}
        indent={1}
      />
      <Row label="Otros OPEX (alquiler, servicios)" value={-otherOpex} indent={1} />
      <Row label="OPEX total" value={-opexTotal} kind="sub" indent={1} />

      {/* ── EBITDA ───────────────────────────────────────── */}
      <Row
        label="EBITDA"
        value={ebitda}
        percent={ebitdaPct}
        semaState={semaphore(ebitdaPct, targets.target_ebitda_pct, "more")}
        kind="total"
      />

      <p style={{ fontSize: 10, color: "var(--ag-ink-3)", margin: "12px 0 0", lineHeight: 1.4, fontStyle: "italic" }}>
        Estructura USAR adaptada a Dark Kitchen. % calculados sobre Ingreso Bruto.
        Semáforo: verde ≤ target / rojo &gt; target (EBITDA invertido: verde ≥ target).
      </p>
    </div>
  );
}
