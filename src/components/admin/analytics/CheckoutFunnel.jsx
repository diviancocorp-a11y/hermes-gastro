// src/components/admin/analytics/CheckoutFunnel.jsx
// Checkout funnel: estimated views → cart → checkout → completed.
// Note: without real page-view tracking, we estimate views from order count × typical ratios.
// If you integrate analytics (e.g. Plausible/PostHog), replace estimates with real data.
import { useMemo } from 'react';
import { formatInt } from '../../../lib/utils';

const FUNNEL_STAGES = [
  { key: 'views', label: 'Visitas catálogo', icon: '👁', color: '#1565C0' },
  { key: 'cart', label: 'Agregaron al carrito', icon: '🛒', color: '#D4A017' },
  { key: 'checkout', label: 'Iniciaron checkout', icon: '📋', color: '#E07A5C' },
  { key: 'completed', label: 'Pedido completado', icon: '✅', color: '#3A7D44' },
];

export default function CheckoutFunnel({ orders }) {
  const funnel = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;
    const allOrders = orders.length;

    // Estimated conversion ratios (industry average for food delivery):
    // ~15% of visitors add to cart, ~50% of cart proceed to checkout, ~70% of checkout complete
    // We work backwards from completed orders to estimate earlier stages
    const checkout = allOrders; // everyone who submitted = checkout
    const cart = Math.round(checkout / 0.65);    // ~65% of cart → submit
    const views = Math.round(cart / 0.20);        // ~20% of views → cart

    return [
      { ...FUNNEL_STAGES[0], value: views },
      { ...FUNNEL_STAGES[1], value: cart },
      { ...FUNNEL_STAGES[2], value: checkout },
      { ...FUNNEL_STAGES[3], value: completed },
    ];
  }, [orders]);

  const maxVal = funnel[0]?.value || 1;

  return (
    <div className="c" style={{ padding: 16 }}>
      <div className="fl" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🔽 Embudo de checkout</div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 12 }}>
        * Visitas y carrito son estimaciones. Conectá analytics para datos reales.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {funnel.map((stage, i) => {
          const pct = maxVal ? ((stage.value / maxVal) * 100) : 0;
          const convFromPrev = i > 0 && funnel[i - 1].value
            ? ((stage.value / funnel[i - 1].value) * 100).toFixed(0)
            : null;

          return (
            <div key={stage.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>
                  {stage.icon} {stage.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>
                  {formatInt(stage.value)}
                  {convFromPrev && <span style={{ color: 'var(--t3)', fontWeight: 500, marginLeft: 4 }}>({convFromPrev}%)</span>}
                </span>
              </div>
              <div style={{ height: 10, background: 'var(--b2)', borderRadius: 5, overflow: 'hidden' }}>
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
    </div>
  );
}
