// src/components/admin/analytics/CohortAnalysis.jsx
// Shows repeat-purchase cohort analysis at 30/60/90 days.
import { useMemo } from 'react';

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000);
}

export default function CohortAnalysis({ orders }) {
  const stats = useMemo(() => {
    // Group orders by customer phone (or name as fallback)
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
      totalCustomers,
      repeat30,
      repeat60,
      repeat90,
      pct30: totalCustomers ? ((repeat30 / totalCustomers) * 100).toFixed(1) : '0',
      pct60: totalCustomers ? ((repeat60 / totalCustomers) * 100).toFixed(1) : '0',
      pct90: totalCustomers ? ((repeat90 / totalCustomers) * 100).toFixed(1) : '0',
    };
  }, [orders]);

  return (
    <div className="c" style={{ padding: 16 }}>
      <div className="fl" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🔄 Retención de clientes</div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
        {stats.totalCustomers} clientes únicos
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: '30 días', count: stats.repeat30, pct: stats.pct30, color: 'var(--gn)' },
          { label: '60 días', count: stats.repeat60, pct: stats.pct60, color: 'var(--yw)' },
          { label: '90 días', count: stats.repeat90, pct: stats.pct90, color: 'var(--ac)' },
        ].map(c => (
          <div key={c.label} style={{
            flex: 1, textAlign: 'center', padding: '14px 8px', background: 'var(--b2)', borderRadius: 12,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.pct}%</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginTop: 2 }}>{c.label}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{c.count} repitieron</div>
          </div>
        ))}
      </div>
    </div>
  );
}
