/**
 * Waste.jsx — Hub de mermas con Registro + Analytics.
 *
 * Tabs:
 *   - Registro: lista filtrada (todos / solo insumos / solo pedidos cancelados)
 *               agrupada por fecha con costo por día
 *   - Analytics: KPIs mes + tendencia semanal + breakdown por motivo + top insumos
 *
 * Config inline: % merma proyectada (afecta cálculo de rentabilidad en recetas).
 *
 * Modal: WasteForm — registrar merma manual de un insumo (mismo patrón que Stock).
 */
import { useState, useMemo } from "react";
import { formatInt, formatMoney, todayISO } from "../../lib/utils";
import { registerWaste } from "../../lib/adminService";

// Motivos con icono, label, y color del sistema visual (token-based, no hex)
const REASONS = {
  vencimiento: { label: "Vencimiento",  icon: "🗓️", fg: "var(--ag-c-stock)",   soft: "var(--ag-c-stock-soft)"   },
  rotura:      { label: "Rotura",       icon: "💔", fg: "var(--ag-c-orders)",  soft: "var(--ag-c-orders-soft)"  },
  prueba:      { label: "Prueba",       icon: "🧪", fg: "var(--ag-c-prep)",    soft: "var(--ag-c-prep-soft)"    },
  derrame:     { label: "Derrame",      icon: "💧", fg: "var(--ag-c-recipes)", soft: "var(--ag-c-recipes-soft)" },
  otro:        { label: "Otro",         icon: "📝", fg: "var(--ag-ink-3)",     soft: "var(--ag-bg-soft)"         },
  cancel:      { label: "Pedido cancelado", icon: "❌", fg: "var(--ag-c-orders)", soft: "var(--ag-c-orders-soft)" },
};
const reasonMeta = (k) => REASONS[k] || REASONS.otro;

const WASTE_REASONS_FORM = ["vencimiento", "rotura", "prueba", "derrame", "otro"];

function Waste({ waste, orders, recipes, ingredients, setIngredients, showToast, loadAll }) {
  const [tab, setTab] = useState("all");        // 'all' | 'stats'
  const [filter, setFilter] = useState("all");  // 'all' | 'manual' | 'cancel' | <reason>
  const [showWasteForm, setShowWasteForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null); // id de pedido cancelado expandido
  const t = todayISO();
  const monthStart = t.slice(0, 7) + "-01";

  // El % merma proyectada y % gastos ahora viven en Settings → Costos proyectados.

  // Unifica waste_log manual + pedidos cancelados
  const allWaste = useMemo(() => {
    const manual = (waste || []).map(w => {
      const ig = ingredients.find(x => x.id === w.ingredient_id);
      return {
        id: w.id,
        type: "manual",
        date: w.date || (w.created_at || "").split("T")[0],
        reason: w.reason || "otro",
        note: w.note || "",
        ingredient: w.ingredients?.name || ig?.name || "?",
        unit: w.ingredients?.unit || ig?.unit || "",
        qty: w.qty || 0,
        cost: (ig?.cost || 0) * (w.qty || 0),
        created_at: w.created_at || "",
      };
    });
    const cancelled = (orders || []).filter(o => o.status === "cancelled").map(o => {
      const items = o.order_items || o.items || [];
      const itemDetails = items.map(it => {
        const r = recipes.find(x => x.id === it.recipe_id);
        const qty = it.quantity || it.qty || 1;
        // Construir lista de insumos consumidos por este producto (cantidad por unidad × qty del pedido)
        const insumos = (r?.ingredients || []).map(ri => {
          const ig = ingredients.find(x => x.id === ri.ingredient_id);
          if (!ig) return null;
          const totalQty = (ri.quantity || 0) * qty;
          return {
            name: ig.name,
            unit: ig.unit,
            qty: totalQty,
            cost: (ig.cost || 0) * totalQty,
          };
        }).filter(Boolean);
        return {
          name: r?.name || "?",
          qty,
          insumos,
        };
      });
      const itemNames = itemDetails.map(d => d.name + " ×" + d.qty).join(", ");
      return {
        id: "cancel-" + o.id,
        type: "cancel",
        date: o.date || (o.created_at || "").split("T")[0],
        reason: "cancel",
        note: (o.customer || "?") + ": " + itemNames,
        ingredient: "", unit: "", qty: 0,
        cost: o.total || 0,
        created_at: o.created_at || "",
        itemDetails,                                 // para expand
        customer: o.customer || "?",
      };
    });
    return [...manual, ...cancelled].sort((a, b) =>
      (b.created_at || b.date || "").localeCompare(a.created_at || a.date || "")
    );
  }, [waste, orders, recipes, ingredients]);

  const filtered = useMemo(() => {
    if (filter === "all") return allWaste;
    if (filter === "manual") return allWaste.filter(w => w.type === "manual");
    if (filter === "cancel") return allWaste.filter(w => w.type === "cancel");
    return allWaste.filter(w => w.reason === filter);
  }, [allWaste, filter]);

  const monthWaste = useMemo(() => allWaste.filter(w => w.date >= monthStart), [allWaste, monthStart]);
  const totalCostMonth = monthWaste.reduce((a, w) => a + w.cost, 0);
  const manualCount = monthWaste.filter(w => w.type === "manual").length;
  const cancelCount = monthWaste.filter(w => w.type === "cancel").length;

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
        label: start.getDate() + "/" + (start.getMonth() + 1),
        cost: w.reduce((a, x) => a + x.cost, 0),
        count: w.length,
      });
    }
    return weeks;
  }, [allWaste]);
  const maxWeek = Math.max(...weeklyTrend.map(w => w.cost), 1);

  const grouped = filtered.reduce((a, w) => {
    const d = w.date || "sin-fecha";
    if (!a[d]) a[d] = [];
    a[d].push(w);
    return a;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <div style={{ padding: "12px 16px 6px", position: "relative", zIndex: 2 }}>
        {/* Header: título + tabs */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 22, margin: 0, color: "var(--ag-ink)", letterSpacing: "-0.01em", lineHeight: 1.1 }}>Mermas</h1>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--ag-ink-3)" }}>
              {monthWaste.length} evento{monthWaste.length !== 1 ? "s" : ""} este mes · −${formatInt(totalCostMonth)}
            </p>
          </div>
        </div>

        {/* Tabs pills */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { id: "all",   label: "📋 Registro" },
            { id: "stats", label: "📊 Analytics" },
          ].map(p => {
            const on = tab === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setTab(p.id)}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 999,
                  border: on ? "2px solid var(--ag-c-terra)" : "1px solid var(--ag-line)",
                  background: on ? "var(--ag-c-terra)" : "var(--ag-bg-card)",
                  color: on ? "#fff" : "var(--ag-ink-2)",
                  fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}
              >{p.label}</button>
            );
          })}
        </div>

        {/* ═══ STATS TAB ═══ */}
        {tab === "stats" && (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <div className="ag-card" style={{ padding: "12px 14px", borderTop: "3px solid var(--ag-c-orders)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pérdida del mes</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ag-c-orders)", lineHeight: 1.1 }}>−${formatInt(totalCostMonth)}</div>
              </div>
              <div className="ag-card" style={{ padding: "12px 14px", borderTop: "3px solid var(--ag-c-prep)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Eventos</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ag-c-prep)", lineHeight: 1.1 }}>{monthWaste.length}</div>
                <div style={{ fontSize: 10, color: "var(--ag-ink-3)", marginTop: 2 }}>{manualCount} insumos · {cancelCount} pedidos</div>
              </div>
            </div>

            {/* Tendencia semanal */}
            {weeklyTrend.some(w => w.cost > 0) && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ag-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Tendencia 4 semanas
                </div>
                <div className="ag-card" style={{ padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 88 }}>
                    {weeklyTrend.map((w, i) => (
                      <div key={i} style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <div style={{
                          background: w.cost > 0 ? "var(--ag-c-orders)" : "var(--ag-bg-soft)",
                          height: Math.max(4, (w.cost / maxWeek) * 60),
                          borderRadius: 6, marginBottom: 4, transition: "height 0.3s",
                        }} />
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ag-ink-3)" }}>{w.label}</div>
                        {w.cost > 0 && <div style={{ fontSize: 9.5, color: "var(--ag-c-orders)", fontWeight: 700 }}>${formatInt(w.cost)}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Por motivo */}
            {byReason.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ag-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Por motivo
                </div>
                <div className="ag-card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
                  {byReason.map(([reason, data], i) => {
                    const meta = reasonMeta(reason);
                    const pct = totalCostMonth > 0 ? (data.cost / totalCostMonth * 100) : 0;
                    return (
                      <div key={reason} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 14px",
                        borderTop: i === 0 ? "none" : "1px solid var(--ag-line)",
                      }}>
                        <div style={{
                          padding: "3px 10px", borderRadius: 999,
                          background: meta.soft, color: meta.fg,
                          fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em",
                          whiteSpace: "nowrap", flexShrink: 0,
                        }}>{meta.icon} {meta.label.toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ height: 6, background: "var(--ag-bg-soft)", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ width: pct + "%", height: "100%", background: meta.fg, borderRadius: 999, transition: "width 0.3s" }} />
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: meta.fg }}>−${formatInt(data.cost)}</div>
                          <div style={{ fontSize: 10, color: "var(--ag-ink-3)" }}>{data.count} ev.</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Top insumos perdidos */}
            {topIngredients.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ag-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Insumos más perdidos
                </div>
                <div className="ag-card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
                  {topIngredients.map(([name, data], i) => (
                    <div key={name} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px",
                      borderTop: i === 0 ? "none" : "1px solid var(--ag-line)",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 999,
                        background: "var(--ag-c-orders-soft)", color: "var(--ag-c-orders)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 800, flexShrink: 0,
                      }}>#{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {name}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", marginTop: 1 }}>
                          {data.count} veces · {formatMoney(data.qty)} {data.unit}
                        </div>
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ag-c-orders)", flexShrink: 0 }}>
                        −${formatInt(data.cost)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {monthWaste.length === 0 && (
              <div className="ag-card" style={{ padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <div style={{ color: "var(--ag-ink-3)", fontSize: 13 }}>Sin datos de merma este mes</div>
              </div>
            )}
          </>
        )}

        {/* ═══ REGISTRO TAB ═══ */}
        {tab === "all" && (
          <>
            {/* CTA registrar (arriba) */}
            {setIngredients && (
              <button
                type="button"
                onClick={() => setShowWasteForm(true)}
                style={{
                  width: "100%", padding: "12px",
                  background: "var(--ag-bg-card)",
                  border: "1.5px solid var(--ag-c-stock)",
                  color: "var(--ag-c-stock)",
                  borderRadius: 12,
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  marginBottom: 12,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Registrar merma
              </button>
            )}

            {/* Filtros pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", scrollbarWidth: "none", padding: "0 2px 4px" }}>
              {[
                { id: "all",    label: "Todos" },
                { id: "manual", label: "Insumos" },
                { id: "cancel", label: "Pedidos" },
              ].map(f => {
                const on = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    style={{
                      padding: "7px 14px", borderRadius: 999,
                      border: on ? "2px solid var(--ag-c-orders)" : "1px solid var(--ag-line)",
                      background: on ? "var(--ag-c-orders)" : "var(--ag-bg-card)",
                      color: on ? "#fff" : "var(--ag-ink-2)",
                      fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                      cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                    }}
                  >{f.label}</button>
                );
              })}
            </div>

            {/* Lista agrupada por fecha */}
            {sortedDates.length === 0 ? (
              <div className="ag-card" style={{ padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
                <div style={{ color: "var(--ag-ink-3)", fontSize: 13 }}>Sin mermas registradas</div>
              </div>
            ) : sortedDates.map(d => {
              const dayItems = grouped[d];
              const dayCost = dayItems.reduce((a, w) => a + w.cost, 0);
              const dayLabel = d === "sin-fecha"
                ? "Sin fecha"
                : new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
              return (
                <div key={d} style={{ marginBottom: 14 }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0 4px 6px", fontSize: 11, fontWeight: 700,
                    color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    <span>{dayLabel}</span>
                    <span style={{ color: "var(--ag-c-orders)" }}>−${formatInt(dayCost)}</span>
                  </div>
                  <div className="ag-card" style={{ padding: 0, borderTop: "3px solid var(--ag-c-orders)", overflow: "hidden" }}>
                    {dayItems.map((w, i) => {
                      const meta = reasonMeta(w.reason);
                      // Borde izquierdo según tipo:
                      //   insumo manual → amarillo (stock)
                      //   pedido cancelado → rojo (orders)
                      const borderLeftColor = w.type === "manual" ? "var(--ag-c-stock)" : "var(--ag-c-orders)";
                      const isCancelExpandable = w.type === "cancel" && Array.isArray(w.itemDetails) && w.itemDetails.length > 0;
                      const isExpanded = expandedId === w.id;
                      return (
                        <div key={w.id}>
                          <div
                            onClick={() => isCancelExpandable && setExpandedId(isExpanded ? null : w.id)}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: 10,
                              padding: "10px 14px",
                              borderTop: i === 0 ? "none" : "1px solid var(--ag-line)",
                              borderLeft: "4px solid " + borderLeftColor,
                              cursor: isCancelExpandable ? "pointer" : "default",
                              userSelect: "none",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                                <span style={{
                                  padding: "2px 8px", borderRadius: 6,
                                  background: meta.soft, color: meta.fg,
                                  fontSize: 10, fontWeight: 800, letterSpacing: "0.04em",
                                }}>{meta.icon} {meta.label.toUpperCase()}</span>
                                {isCancelExpandable && (
                                  <span style={{ fontSize: 10, color: "var(--ag-ink-3)", fontWeight: 600 }}>
                                    {isExpanded ? "▲ ocultar insumos" : "▼ ver insumos perdidos"}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ag-ink)" }}>
                                {w.type === "manual"
                                  ? `${w.ingredient} — ${formatMoney(w.qty)} ${w.unit}`
                                  : w.note}
                              </div>
                              {w.type === "manual" && w.note && (
                                <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", marginTop: 2 }}>💬 {w.note}</div>
                              )}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ag-c-orders)", flexShrink: 0 }}>
                              −${formatInt(w.cost)}
                            </div>
                          </div>

                          {/* Expand de pedido cancelado: insumos perdidos */}
                          {isCancelExpandable && isExpanded && (
                            <div style={{
                              padding: "12px 14px 14px 18px",
                              borderTop: "1px solid var(--ag-line)",
                              borderLeft: "4px solid var(--ag-c-orders)",
                              background: "var(--ag-bg-soft)",
                            }}>
                              <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                                Insumos perdidos
                              </div>
                              {w.itemDetails.map((d, idx) => (
                                <div key={idx} style={{ marginBottom: idx < w.itemDetails.length - 1 ? 10 : 0 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ag-ink)", marginBottom: 4 }}>
                                    {d.name} ×{d.qty}
                                  </div>
                                  {d.insumos.length === 0 ? (
                                    <div style={{ fontSize: 11, color: "var(--ag-ink-3)", fontStyle: "italic", paddingLeft: 8 }}>
                                      Sin receta cargada — no se puede desglosar
                                    </div>
                                  ) : (
                                    <div style={{ background: "var(--ag-bg-card)", borderRadius: 8, padding: 4 }}>
                                      {d.insumos.map((ins, j) => (
                                        <div key={j} style={{
                                          display: "flex", justifyContent: "space-between", alignItems: "center",
                                          padding: "5px 10px",
                                          borderTop: j === 0 ? "none" : "1px solid var(--ag-line)",
                                          fontSize: 11.5,
                                        }}>
                                          <span style={{ flex: 1, color: "var(--ag-ink)", fontWeight: 600 }}>{ins.name}</span>
                                          <span style={{ color: "var(--ag-ink-2)", marginRight: 10 }}>
                                            {formatMoney(ins.qty)} {ins.unit}
                                          </span>
                                          <span style={{ color: "var(--ag-c-orders)", fontWeight: 700 }}>
                                            −${formatInt(ins.cost)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Modal merma */}
      {showWasteForm && setIngredients && (
        <WasteForm
          ingredients={ingredients}
          setIngredients={setIngredients}
          showToast={showToast || (() => {})}
          onClose={() => { setShowWasteForm(false); if (loadAll) loadAll(); }}
        />
      )}
    </>
  );
}

function WasteForm({ ingredients, setIngredients, showToast, onClose }) {
  const [ingId, setIngId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("vencimiento");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const ing = ingredients.find(x => x.id === ingId);
  const qtyNum = Number(qty) || 0;
  const newStock = ing ? Math.max(0, (ing.stock || 0) - qtyNum) : 0;
  const canSave = ingId && qtyNum > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await registerWaste(ingId, qtyNum, reason, note);
    setSaving(false);
    if (ok) {
      setIngredients(p => p.map(i => i.id === ingId ? { ...i, stock: newStock } : i));
      showToast("Merma registrada: " + qtyNum + " " + (ing?.unit || ""));
      onClose();
    } else {
      showToast("Error al registrar merma");
    }
  };

  return (
    <div className="ag-page-over">
      <div className="ag-page-over-head">
        <button type="button" className="ag-subpage-back" onClick={onClose} aria-label="Cancelar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Cancelar</span>
        </button>
        <h2 className="ag-page-over-title">Registrar merma</h2>
      </div>

      <div className="ag-page-over-body">
        <div style={{ padding: "10px 12px", marginBottom: 16, background: "var(--ag-bg-card)", border: "1px solid var(--ag-c-stock)", borderRadius: 10, fontSize: 12, color: "var(--ag-ink-2)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--ag-c-stock)" }}>⚠ Ajuste sin venta.</strong> Esto descuenta stock por vencimientos, roturas o pruebas. No genera ingreso.
        </div>

        <label className="ag-field-lbl">Insumo *</label>
        <select className="ag-field-input" value={ingId} onChange={e => setIngId(e.target.value)} style={{ marginBottom: 12 }}>
          <option value="">Seleccionar insumo...</option>
          {ingredients.map(i => (
            <option key={i.id} value={i.id}>{i.name} (stock: {i.stock || 0} {i.unit})</option>
          ))}
        </select>

        <label className="ag-field-lbl">
          Cantidad a descontar {ing && <span style={{ color: "var(--ag-ink-3)", fontWeight: 600 }}>({ing.unit})</span>}
        </label>
        <input className="ag-field-input" type="number" min="0.001" step="0.001" value={qty} onChange={e => setQty(e.target.value)} placeholder="Ej: 0.5" style={{ marginBottom: 12 }} />

        {ing && qtyNum > 0 && (
          <div style={{ padding: "10px 12px", marginBottom: 16, background: "var(--ag-bg-card)", borderRadius: 10, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "var(--ag-ink-3)" }}>Stock actual:</span>
            <strong style={{ color: "var(--ag-ink)" }}>{ing.stock || 0} {ing.unit}</strong>
            <span style={{ color: "var(--ag-ink-3)" }}>→</span>
            <span style={{ color: "var(--ag-ink-3)" }}>nuevo:</span>
            <strong style={{ color: newStock <= 0 ? "var(--ag-c-orders)" : "var(--ag-c-stock)" }}>
              {newStock} {ing.unit}
            </strong>
          </div>
        )}

        <label className="ag-field-lbl">Motivo</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {WASTE_REASONS_FORM.map(rk => {
            const meta = reasonMeta(rk);
            const on = reason === rk;
            return (
              <button key={rk} type="button" onClick={() => setReason(rk)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 12px", borderRadius: 999,
                  border: on ? "2px solid var(--ag-c-terra)" : "1px solid var(--ag-line)",
                  background: on ? "rgba(245,158,11,0.08)" : "var(--ag-bg)",
                  color: on ? "var(--ag-c-terra)" : "var(--ag-ink-2)",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                {meta.label}
              </button>
            );
          })}
        </div>

        <label className="ag-field-lbl">Nota (opcional)</label>
        <input className="ag-field-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Ej: Caja dañada al descargar" style={{ marginBottom: 14 }} />

        <button type="button" className="ag-btn-primary" disabled={!canSave || saving} onClick={save}
          style={{ width: "100%", padding: "14px", fontSize: 15, opacity: canSave && !saving ? 1 : 0.5 }}>
          {saving ? "Guardando…" : "⚠ Confirmar merma"}
        </button>
      </div>
    </div>
  );
}

export default Waste;
