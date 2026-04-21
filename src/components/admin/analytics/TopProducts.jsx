// src/components/admin/analytics/TopProducts.jsx
// Top 10 products by profit margin. Pure CSS bars, no deps.
import { useMemo } from 'react';
import { formatInt } from '../../../lib/utils';

const COLORS = ['#C45D3E', '#E07A5C', '#D4A017', '#3A7D44', '#5CAF6A', '#1565C0', '#42A5F5', '#7A2E4A', '#9C8B7A', '#6B5744'];

export default function TopProducts({ sales, recipes, calculateRecipeCost }) {
  const data = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      if (!s.recipe_id) return;
      if (!map[s.recipe_id]) map[s.recipe_id] = { qty: 0, revenue: 0 };
      map[s.recipe_id].qty += (s.qty || 1);
      map[s.recipe_id].revenue += (s.total || 0);
    });

    return Object.entries(map)
      .map(([id, agg]) => {
        const rec = recipes.find(r => r.id === id);
        if (!rec) return null;
        const cost = calculateRecipeCost(rec) * agg.qty;
        const margin = agg.revenue - cost;
        return { name: rec.name?.slice(0, 20) || 'N/A', margin, revenue: agg.revenue, cost, qty: agg.qty };
      })
      .filter(Boolean)
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 10);
  }, [sales, recipes, calculateRecipeCost]);

  if (data.length === 0) return null;

  const maxMargin = Math.max(...data.map(d => d.margin)) || 1;

  return (
    <div className="c" style={{ padding: 16 }}>
      <div className="fl" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🏆 Top 10 por margen</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((item, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{item.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS[i % COLORS.length] }}>
                ${formatInt(item.margin)}
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--b2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(item.margin / maxMargin) * 100}%`,
                background: COLORS[i % COLORS.length],
                borderRadius: 4,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
              {item.qty} uds · ${formatInt(item.revenue)} ingreso · ${formatInt(item.cost)} costo
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
