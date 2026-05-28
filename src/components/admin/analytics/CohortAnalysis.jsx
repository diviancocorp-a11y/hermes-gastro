// src/components/admin/analytics/CohortAnalysis.jsx
// Retención de clientes a 30/60/90 días. Visual v2.
import { useMemo } from 'react';

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000);
}

// Card por defecto a nivel módulo (evita recrear componente en cada render)
function DefaultCard({ children }) {
  return <div className="ag-card">{children}</div>;
}

export default function CohortAnalysis({ orders, Wrapper }) {
  const stats = useMemo(() => {
    const byCustomer = {};
    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const key = o.phone || o.customer || '';
      if (!key) return;
      if (!byCustomer[key]) byCustomer[key] = [];
      byCustomer[key].push(o.created_at || o.date);
    });

    const totalCustomers = Object.keys(byCustomer).length;
    let repeat30 = 0, repeat60 = 0, repeat90 = 0;

    Object.values(byCustomer).forEach(dates => {
      if (dates.length < 2) return;
      const sorted = dates.sort();
      const first = sorted[0];
      const hasWithin = (days) => sorted.some((d, i) => i > 0 && daysBetween(first, d) <= days);
      if (hasWithin(30)) repeat30++;
      if (hasWithin(60)) repeat60++;
      if (hasWithin(90)) repeat90++;
    });

    return {
      totalCustomers, repeat30, repeat60, repeat90,
      pct30: totalCustomers ? ((repeat30 / totalCustomers) * 100).toFixed(1) : '0',
      pct60: totalCustomers ? ((repeat60 / totalCustomers) * 100).toFixed(1) : '0',
      pct90: totalCustomers ? ((repeat90 / totalCustomers) * 100).toFixed(1) : '0',
    };
  }, [orders]);

  const Card = Wrapper || DefaultCard;

  return (
    <Card title="Retención de clientes" state="crm" meta={`${stats.totalCustomers} únicos`}>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {[
          { label: '30 días', count: stats.repeat30, pct: stats.pct30, color: 'var(--ag-c-sales)',   bg: 'var(--ag-c-sales-soft)' },
          { label: '60 días', count: stats.repeat60, pct: stats.pct60, color: 'var(--ag-c-stock)',   bg: 'var(--ag-c-stock-soft)' },
          { label: '90 días', count: stats.repeat90, pct: stats.pct90, color: 'var(--ag-c-crm)',     bg: 'var(--ag-c-crm-soft)' },
        ].map(c => (
          <div key={c.label} style={{
            flex: 1, textAlign: 'center', padding: '14px 8px',
            background: c.bg, borderRadius: 12,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.pct}%</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ag-ink-2)', marginTop: 3 }}>{c.label}</div>
            <div style={{ fontSize: 10, color: 'var(--ag-ink-3)', marginTop: 2 }}>{c.count} repitieron</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
