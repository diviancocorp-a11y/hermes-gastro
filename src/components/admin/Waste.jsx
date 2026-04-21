import { useState, useMemo } from "react";
import { Icon, formatInt, formatMoney, todayISO } from "../../lib/utils";

const REASON_LABELS = {
  vencimiento: "🗓️ Vencimiento",
  rotura: "💔 Rotura",
  prueba: "🧪 Prueba",
  derrame: "💧 Derrame",
  otro: "📝 Otro",
  cancel: "❌ Pedido cancelado"
};
const REASON_COLORS = {
  vencimiento: { bg: "#FFF8E1", tx: "#8D6E00" },
  rotura: { bg: "#FFEBEE", tx: "#C62828" },
  prueba: { bg: "#E3F2FD", tx: "#1565C0" },
  derrame: { bg: "#FFF3E0", tx: "#E65100" },
  otro: { bg: "var(--b2)", tx: "var(--t3)" },
  cancel: { bg: "#FCE4EC", tx: "#AD1457" }
};

function Waste({ waste, orders, recipes, ingredients }) {
  const [tab, setTab] = useState("all"); // all | stats
  const [filter, setFilter] = useState("all");
  const t = todayISO();
  const monthStart = t.slice(0, 7) + "-01";

  // Build unified waste list: manual entries + cancelled orders (as waste)
  const allWaste = useMemo(() => {
    // 1. Manual waste entries from waste_log
    const manual = (waste || []).map(w => ({
      id: w.id,
      type: "manual",
      date: w.date || (w.created_at || "").split("T")[0],
      reason: w.reason || "otro",
      note: w.note || "",
      ingredient: w.ingredients?.name || "?",
      unit: w.ingredients?.unit || "",
      qty: w.qty || 0,
      cost: (() => {
        const ig = ingredients.find(x => x.id === w.ingredient_id);
        return (ig?.cost || 0) * (w.qty || 0);
      })(),
      created_at: w.created_at || ""
    }));

    // 2. Cancelled orders that were in prep (waste = didn't return to stock)
    const ST_CANCEL = "cancelled";
    const cancelled = (orders || [])
      .filter(o => o.status === ST_CANCEL)
      .map(o => {
        const items = o.order_items || o.items || [];
        const itemNames = items.map(it => {
          const r = recipes.find(x => x.id === it.recipe_id);
          return r ? `${r.name} ×${it.quantity || it.qty || 1}` : "";
        }).filter(Boolean).join(", ");
        return {
          id: "cancel-" + o.id,
          type: "cancel",
          date: o.date || (o.created_at || "").split("T")[0],
          reason: "cancel",
          note: `${o.customer || "?"}: ${itemNames}`,
          ingredient: "",
          unit: "",
          qty: 0,
          cost: o.total || 0,
          created_at: o.created_at || ""
        };
      });

    return [...manual, ...cancelled].sort((a, b) =>
      (b.created_at || b.date || "").localeCompare(a.created_at || a.date || "")
    );
  }, [waste, orders, recipes, ingredients]);

  // Filter
  const filtered = useMemo(() => {
    if (filter === "all") return allWaste;
    if (filter === "manual") return allWaste.filter(w => w.type === "manual");
    if (filter === "cancel") return allWaste.filter(w => w.type === "cancel");
    return allWaste.filter(w => w.reason === filter);
  }, [allWaste, filter]);

  // Stats
  const monthWaste = useMemo(() => allWaste.filter(w => w.date >= monthStart), [allWaste, monthStart]);
  const totalCostMonth = monthWaste.reduce((a, w) => a + w.cost, 0);
  const manualCount = monthWaste.filter(w => w.type === "manual").length;
  const cancelCount = monthWaste.filter(w => w.type === "cancel").length;

  // Breakdown by reason (this month)
  const byReason = useMemo(() => {
    const r = {};
    monthWaste.forEach(w => {
      const key = w.reason || "otro";
      if (!r[key]) r[key] = { count: 0, cost: 0 };
      r[key].count++;
      r[key].cost += w.cost;
    });
    return Object.entries(r).sort((a, b) => b[1].cost - a[1].cost);
  }, [monthWaste]);

  // Top wasted ingredients (this month)
  const topIngredients = useMemo(() => {
    const r = {};
    monthWaste.filter(w => w.type === "manual" && w.ingredient).forEach(w => {
      if (!r[w.ingredient]) r[w.ingredient] = { qty: 0, unit: w.unit, cost: 0, count: 0 };
      r[w.ingredient].qty += w.qty;
      r[w.ingredient].cost += w.cost;
      r[w.ingredient].count++;
    });
    return Object.entries(r).sort((a, b) => b[1].cost - a[1].cost).slice(0, 8);
  }, [monthWaste]);

  // Weekly trend (last 4 weeks)
  const weeklyTrend = useMemo(() => {
    const weeks = [];
    for (let i = 3; i >= 0; i--) {
      const end = new Date();
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];
      const w = allWaste.filter(x => x.date >= startStr && x.date <= endStr);
      weeks.push({
        label: `${start.getDate()}/${start.getMonth() + 1}`,
        cost: w.reduce((a, x) => a + x.cost, 0),
        count: w.length
      });
    }
    return weeks;
  }, [allWaste]);

  const maxWeek = Math.max(...weeklyTrend.map(w => w.cost), 1);

  // Group by date
  const grouped = filtered.reduce((a, w) => {
    const d = w.date || "sin-fecha";
    if (!a[d]) a[d] = [];
    a[d].push(w);
    return a;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <div className="s">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="st" style={{ margin: 0 }}>Mermas</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className={`btn bs bsm ${tab === "all" ? "" : ""}`} style={{ color: tab === "all" ? "var(--ac)" : "var(--t3)", borderColor: tab === "all" ? "var(--ac)" : "var(--b2)" }} onClick={() => setTab("all")}>📋 Registro</button>
            <button className={`btn bs bsm`} style={{ color: tab === "stats" ? "var(--ac)" : "var(--t3)", borderColor: tab === "stats" ? "var(--ac)" : "var(--b2)" }} onClick={() => setTab("stats")}>📊 Analytics</button>
          </div>
        </div>
      </div>

      {/* ═══ STATS TAB ═══ */}
      {tab === "stats" && (
        <div className="s">
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div className="c" style={{ textAlign: "center", padding: 14, background: "#FFF3E0" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#E65100", textTransform: "uppercase" }}>Pérdida del mes</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#E65100", fontFamily: "'DM Serif Display',serif" }}>${formatInt(totalCostMonth)}</div>
            </div>
            <div className="c" style={{ textAlign: "center", padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase" }}>Total eventos</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Serif Display',serif" }}>{monthWaste.length}</div>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>{manualCount} insumos · {cancelCount} pedidos</div>
            </div>
          </div>

          {/* Weekly trend */}
          {weeklyTrend.some(w => w.cost > 0) && (
            <div className="c" style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 10, textTransform: "uppercase" }}>Tendencia semanal</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
                {weeklyTrend.map((w, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ background: w.cost > 0 ? "#FF8A65" : "var(--b2)", height: Math.max(4, (w.cost / maxWeek) * 60), borderRadius: 6, marginBottom: 4, transition: "height .3s" }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)" }}>{w.label}</div>
                    {w.cost > 0 && <div style={{ fontSize: 9, color: "#E65100" }}>${formatInt(w.cost)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown by reason */}
          {byReason.length > 0 && (
            <div className="c" style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 10, textTransform: "uppercase" }}>Por motivo</div>
              {byReason.map(([reason, data]) => {
                const calculateRecipeCost = REASON_COLORS[reason] || REASON_COLORS.otro;
                const pct = totalCostMonth > 0 ? (data.cost / totalCostMonth * 100) : 0;
                return (
                  <div key={reason} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--b2)" }}>
                    <span style={{ fontSize: 12, background: calculateRecipeCost.bg, color: calculateRecipeCost.tx, padding: "2px 8px", borderRadius: 6, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {REASON_LABELS[reason] || reason}
                    </span>
                    <div style={{ flex: 1, height: 6, background: "var(--b2)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: calculateRecipeCost.tx, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>${formatInt(data.cost)}</span>
                    <span style={{ fontSize: 10, color: "var(--t3)" }}>({data.count})</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Top wasted ingredients */}
          {topIngredients.length > 0 && (
            <div className="c" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 10, textTransform: "uppercase" }}>Insumos más perdidos</div>
              {topIngredients.map(([name, data]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--b2)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>{data.count} veces · {formatMoney(data.qty)} {data.unit}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#E65100" }}>${formatInt(data.cost)}</div>
                </div>
              ))}
            </div>
          )}

          {monthWaste.length === 0 && (
            <div className="c"><div className="empty"><div className="eic">📊</div><div>Sin datos de merma este mes</div></div></div>
          )}
        </div>
      )}

      {/* ═══ LIST TAB ═══ */}
      {tab === "all" && (<>
        {/* Filter chips */}
        <div style={{ padding: "0 16px 8px", display: "flex", gap: 6, overflowX: "auto", flexWrap: "nowrap" }}>
          {[
            { id: "all", l: "Todos" },
            { id: "manual", l: "Insumos" },
            { id: "cancel", l: "Pedidos" },
          ].map(f => (
            <button key={f.id} className={`btn bs bsm`} style={{ color: filter === f.id ? "var(--ac)" : "var(--t3)", borderColor: filter === f.id ? "var(--ac)" : "var(--b2)", whiteSpace: "nowrap" }} onClick={() => setFilter(f.id)}>
              {f.l}
            </button>
          ))}
        </div>

        <div className="s">
          {sortedDates.length === 0 ? (
            <div className="c"><div className="empty"><div className="eic">⚠️</div><div>Sin mermas registradas</div></div></div>
          ) : sortedDates.map(d => {
            const dayItems = grouped[d];
            const dayCost = dayItems.reduce((a, w) => a + w.cost, 0);
            return (
              <div key={d}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px 6px", fontSize: 12, fontWeight: 700, color: "var(--t3)" }}>
                  <span>{new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span style={{ color: "#E65100" }}>-${formatInt(dayCost)}</span>
                </div>
                {dayItems.map(w => {
                  const calculateRecipeCost = REASON_COLORS[w.reason] || REASON_COLORS.otro;
                  return (
                    <div key={w.id} className="c" style={{ padding: "10px 14px", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 11, background: calculateRecipeCost.bg, color: calculateRecipeCost.tx, padding: "1px 8px", borderRadius: 6, fontWeight: 600 }}>
                              {REASON_LABELS[w.reason] || w.reason}
                            </span>
                          </div>
                          {w.type === "manual" ? (
                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                              {w.ingredient} — {formatMoney(w.qty)} {w.unit}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                              {w.note}
                            </div>
                          )}
                          {w.type === "manual" && w.note && (
                            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>💬 {w.note}</div>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#E65100", flexShrink: 0, marginLeft: 8 }}>
                          -${formatInt(w.cost)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </>)}
    </>
  );
}

export default Waste;
