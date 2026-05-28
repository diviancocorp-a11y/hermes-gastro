// src/components/admin/analytics/TopProducts.jsx
// Top 10 products by profit margin. Pure CSS bars, no deps.
// Visual v2: usa AnaCard como wrapper (recibido por prop).
import { useMemo } from 'react';
import { formatInt } from '../../../lib/utils';

const COLORS = [
  'var(--ag-c-terra)',  'var(--ag-c-recipes)', 'var(--ag-c-stock)',
  'var(--ag-c-sales)',  'var(--ag-c-prep)',    'var(--ag-c-crm)',
  '#7A2E4A', '#9C8B7A', '#6B5744', '#42A5F5',
];

// Card por defecto a nivel módulo (evita recrear componente en cada render)
function DefaultCard({ children }) {
  return <div className="ag-card">{children}</div>;
}

export default function TopProducts({ sales, recipes, calculateRecipeCost, Wrapper }) {
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
        return { name: rec.name?.slice(0, 22) || 'N/A', margin, revenue: agg.revenue, cost, qty: agg.qty };
      })
      .filter(Boolean)
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 10);
  }, [sales, recipes, calculateRecipeCost]);

  if (data.length === 0) return null;

  const maxMargin = Math.max(...data.map(d => d.margin)) || 1;
  const Card = Wrapper || DefaultCard;

  return (
    <Card title="Top 10 por margen" state="recipes" meta={`${data.length} productos`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {data.map((item, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ag-ink)' }}>{item.name}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS[i % COLORS.length] }}>
                ${formatInt(item.margin)}
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--ag-bg-soft)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(item.margin / maxMargin) * 100}%`,
                background: COLORS[i % COLORS.length],
                borderRadius: 4,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ag-ink-3)', marginTop: 3 }}>
              {item.qty} uds · ${formatInt(item.revenue)} ingreso · ${formatInt(item.cost)} costo
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
