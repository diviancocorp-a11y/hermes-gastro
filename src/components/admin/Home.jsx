import { useMemo, useState, lazy, Suspense } from "react";
import DeltaBadge, { computeDelta } from "../DeltaBadge";
import { formatInt, todayISO, OrderStatus } from "../../lib/utils";

import KpiCard from "./shared/cards/KpiCard";
import AnaCard from "./shared/cards/AnaCard";
import AlertRow from "./shared/cards/AlertRow";
import AnimateNumber from "./shared/AnimateNumber";
import ActivityChartCard from "./shared/cards/ActivityChartCard";

const Analytics = lazy(() => import("./Analytics"));

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function Home({
  user, lowStockIngredients, monthSales, monthExpenses, monthProfit, profitMargin,
  prevMonthSales = 0, prevMonthExpenses = 0, prevMonthProfit = 0, prevMonthOrdersCount = 0,
  sales, orders, recipes, ingredients,
  calculateRecipeCost, activeOrders, settings, waste,
  onStock, onOrders, onShowToast, onMonthSummary,
}) {
  const [showAnalytics, setShowAnalytics] = useState(false);

  const nw = activeOrders.filter(o => o.status === OrderStatus.NEW);
  const monthStart = todayISO().slice(0, 7) + "-01";
  const currentMonth = MONTH_NAMES[new Date().getMonth()];

  // Pedidos creados en el mes actual (no solo activos)
  const monthOrdersCount = useMemo(
    () => orders.filter(o => (o.created_at || o.date || '').slice(0, 10) >= monthStart).length,
    [orders, monthStart]
  );

  const top = useMemo(() => {
    const m = {};
    sales.filter(s => s.date >= monthStart).forEach(s => { m[s.recipe_id] = (m[s.recipe_id] || 0) + (s.qty || 1); });
    return Object.entries(m).map(([id, q]) => ({ r: recipes.find(x => x.id === id), q })).filter(x => x.r).sort((a, b) => b.q - a.q).slice(0, 3);
  }, [sales, recipes, monthStart]);

  return (
    <div style={{ padding: "12px 16px 24px", position: 'relative', zIndex: 2 }}>

      {/* ─── Page head: "Resumen de <mes>" + email chico + botón mes ─── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '4px 0 14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 800,
            fontSize: 22,
            margin: 0,
            color: 'var(--ag-ink)',
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
          }}>Resumen de {currentMonth}</h1>
          {/* El operador (nombre/email) ya se muestra en la burbuja de perfil */}
        </div>
        <button
          type="button"
          className="ag-cta"
          onClick={() => onMonthSummary?.()}
          aria-label={`Ver resumen del mes (${currentMonth})`}
          style={{ padding: '8px 14px', fontSize: 12, gap: 6, flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8"  y1="2" x2="8"  y2="6" />
            <line x1="3"  y1="10" x2="21" y2="10" />
          </svg>
          <span>{currentMonth}</span>
        </button>
      </div>

      {/* ─── Alertas (siempre 2 cards lado a lado: pedidos + stock) ─── */}
      <div className="ag-alerts" style={{ marginBottom: 14 }}>
        <AlertRow
          tone={nw.length > 0 ? "urgent" : "ok"}
          title={nw.length > 0
            ? `${nw.length} pedido${nw.length > 1 ? 's' : ''} nuevo${nw.length > 1 ? 's' : ''}`
            : 'Sin pedidos nuevos'}
          hint={nw.length > 0 ? 'esperando' : 'al día'}
          onClick={onOrders}
        />
        <AlertRow
          tone={lowStockIngredients.length > 0 ? "warn" : "ok"}
          title={lowStockIngredients.length > 0
            ? `${lowStockIngredients.length} insumo${lowStockIngredients.length > 1 ? 's' : ''} bajo${lowStockIngredients.length > 1 ? 's' : ''}`
            : 'Stock ok'}
          hint={lowStockIngredients.length > 0 ? 'stock crítico' : 'todo cubierto'}
          onClick={onStock}
        />
      </div>

      {/* ─── KPIs principales ─── */}
      <div className="ag-kpi-grid" style={{ marginBottom: 14 }}>
        <KpiCard
          state="sales"
          label="Ventas del mes"
          value={<AnimateNumber value={Math.round(monthSales)} prefix="$" />}
          deltaNode={prevMonthSales > 0 ? (() => {
            const d = computeDelta(monthSales, prevMonthSales);
            return <DeltaBadge value={d.value} deltaType={d.type} variant="solid" iconStyle="filled" size="sm" />;
          })() : null}
          delta={prevMonthSales > 0 ? "vs mes anterior" : "primer mes"}
        />
        <KpiCard
          state="orders"
          label="Gastos del mes"
          value={<AnimateNumber value={Math.round(monthExpenses || 0)} prefix="$" />}
          deltaNode={prevMonthExpenses > 0 ? (() => {
            const d = computeDelta(monthExpenses, prevMonthExpenses);
            // En gastos, subir es malo: invertimos el sentido visual
            const type = d.type === "increase" ? "decrease" : d.type === "decrease" ? "increase" : "neutral";
            return <DeltaBadge value={d.value} deltaType={type} variant="solid" iconStyle="filled" size="sm" />;
          })() : null}
          delta={prevMonthExpenses > 0 ? "vs mes anterior" : "primer mes"}
        />
        <KpiCard
          state={monthProfit >= 0 ? "crm" : "orders"}
          label="Ganancia del mes"
          value={<AnimateNumber value={Math.round(monthProfit)} prefix="$" />}
          deltaNode={prevMonthProfit !== 0 ? (() => {
            const d = computeDelta(monthProfit, prevMonthProfit);
            return <DeltaBadge value={d.value} deltaType={d.type} variant="solid" iconStyle="filled" size="sm" />;
          })() : null}
          delta={`${profitMargin.toFixed(1)}% margen`}
          trend={monthProfit >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          state="prep"
          label="Pedidos del mes"
          value={<AnimateNumber value={monthOrdersCount} />}
          deltaNode={prevMonthOrdersCount > 0 ? (() => {
            const d = computeDelta(monthOrdersCount, prevMonthOrdersCount);
            return <DeltaBadge value={d.value} deltaType={d.type} variant="solid" iconStyle="filled" size="sm" />;
          })() : null}
          delta={nw.length > 0 ? `${nw.length} nuevo${nw.length > 1 ? 's' : ''}` : "vs mes anterior"}
          onClick={onOrders}
        />
      </div>

      {/* ─── Actividad: pedidos de hoy por hora / ventas por día ─── */}
      <div style={{ marginBottom: 14 }}>
        <ActivityChartCard orders={orders} sales={sales} />
      </div>

      {/* ─── Mermas del mes ─── */}
      {waste && waste.length > 0 && (() => {
        const mo2 = todayISO().slice(0, 7) + "-01";
        const mw = waste.filter(w => w.date >= mo2);
        if (mw.length === 0) return null;
        const byReason = {};
        mw.forEach(w => {
          const r = w.reason || "otro";
          if (!byReason[r]) byReason[r] = { count: 0, cost: 0 };
          byReason[r].count += w.qty || 0;
          const ig = ingredients.find(i => i.id === w.ingredient_id);
          byReason[r].cost += (ig?.cost || 0) * (w.qty || 0);
        });
        const reasonIcon = { vencimiento: '📅', rotura: '💔', derrame: '💧' };
        return (
          <div style={{ marginBottom: 14 }}>
            <AnaCard title="Mermas del mes" state="orders" meta="por motivo">
              <div style={{ marginTop: 8 }}>
                {Object.entries(byReason).sort((a, b) => b[1].cost - a[1].cost).map(([reason, data]) => (
                  <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--ag-line)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--ag-c-orders-soft)', color: 'var(--ag-c-orders)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{reasonIcon[reason] || '⚠️'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ag-ink)', textTransform: 'capitalize' }}>{reason}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ag-ink-3)' }}>{data.count} unidades</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ag-c-orders)' }}>-${formatInt(data.cost)}</div>
                  </div>
                ))}
              </div>
            </AnaCard>
          </div>
        );
      })()}

      {/* ─── Top más vendidos ─── */}
      {top.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <AnaCard title="Más vendidos" state="recipes" meta="del mes">
            <div style={{ marginTop: 8 }}>
              {top.map((t, i) => {
                const c = calculateRecipeCost(t.r);
                const rt = t.r.sale_price > 0 ? ((t.r.sale_price - c) / t.r.sale_price * 100) : 0;
                const podiumColor = ['var(--ag-c-sales)', 'var(--ag-c-stock)', 'var(--ag-c-crm)'][i];
                const podiumBg    = ['var(--ag-c-sales-soft)', 'var(--ag-c-stock-soft)', 'var(--ag-c-crm-soft)'][i];
                return (
                  <div key={t.r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--ag-line)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: podiumBg, color: podiumColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>#{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ag-ink)' }}>{t.r.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ag-ink-3)' }}>{t.q} uni · Rent. {rt.toFixed(0)}%</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ag-ink)' }}>${formatInt(t.q * t.r.sale_price)}</div>
                  </div>
                );
              })}
            </div>
          </AnaCard>
        </div>
      )}

      {/* ─── Analytics avanzado (CTA centrado, colapsable) ─── */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 14px' }}>
        <button
          type="button"
          onClick={() => setShowAnalytics(p => !p)}
          className="ag-cta"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
          <span>{showAnalytics ? 'Ocultar analítica avanzada' : 'Ver analítica avanzada'}</span>
          <span className="ag-cta-caret" data-open={showAnalytics ? 'true' : 'false'}>▾</span>
        </button>
      </div>

      {showAnalytics && (
        <Suspense fallback={<div className="ag-card" style={{ textAlign: 'center', padding: 20, color: 'var(--ag-ink-3)' }}>Cargando analítica...</div>}>
          <Analytics sales={sales} orders={orders} recipes={recipes} calculateRecipeCost={calculateRecipeCost} />
        </Suspense>
      )}
    </div>
  );
}

export default Home;
