// src/components/admin/analytics/CheckoutFunnel.jsx
// Checkout funnel: estimated views → cart → checkout → completed. Visual v2.
import { useMemo } from 'react';
import { formatInt } from '../../../lib/utils';

const FUNNEL_STAGES = [
  { key: 'views',     label: 'Visitas catálogo',    icon: '👁',  color: 'var(--ag-c-prep)' },
  { key: 'cart',      label: 'Agregaron al carrito', icon: '🛒', color: 'var(--ag-c-stock)' },
  { key: 'checkout',  label: 'Iniciaron checkout',   icon: '📋', color: 'var(--ag-c-recipes)' },
  { key: 'completed', label: 'Pedido completado',    icon: '✅', color: 'var(--ag-c-sales)' },
];

// Card por defecto a nivel módulo (evita recrear componente en cada render)
function DefaultCard({ children }) {
  return <div className="ag-card">{children}</div>;
}

export default function CheckoutFunnel({ orders, Wrapper }) {
  const funnel = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed').length;
    const allOrders = orders.length;

    // Estimated conversion ratios
    const checkout = allOrders;
    const cart = Math.round(checkout / 0.65);
    const views = Math.round(cart / 0.20);

    return [
      { ...FUNNEL_STAGES[0], value: views },
      { ...FUNNEL_STAGES[1], value: cart },
      { ...FUNNEL_STAGES[2], value: checkout },
      { ...FUNNEL_STAGES[3], value: completed },
    ];
  }, [orders]);

  const maxVal = funnel[0]?.value || 1;
  const Card = Wrapper || DefaultCard;

  return (
    <Card title="Embudo de checkout" state="prep" meta="estimado">
      <div style={{ fontSize: 11, color: 'var(--ag-ink-3)', margin: '4px 0 12px' }}>
        Visitas y carrito son estimaciones. Conectá analytics para datos reales.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {funnel.map((stage, i) => {
          const pct = maxVal ? ((stage.value / maxVal) * 100) : 0;
          const convFromPrev = i > 0 && funnel[i - 1].value
            ? ((stage.value / funnel[i - 1].value) * 100).toFixed(0)
            : null;

          return (
            <div key={stage.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ag-ink)' }}>
                  {stage.icon} {stage.label}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: stage.color }}>
                  {formatInt(stage.value)}
                  {convFromPrev && <span style={{ color: 'var(--ag-ink-3)', fontWeight: 500, marginLeft: 4 }}>({convFromPrev}%)</span>}
                </span>
              </div>
              <div style={{ height: 10, background: 'var(--ag-bg-soft)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: stage.color,
                  borderRadius: 5,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
