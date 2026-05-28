// src/components/admin/analytics/TicketByChannel.jsx
// Ticket promedio por canal (delivery vs retiro). Visual v2.
import { useMemo } from 'react';
import { formatInt } from '../../../lib/utils';

// Card por defecto a nivel módulo (evita recrear componente en cada render)
function DefaultCard({ children }) {
  return <div className="ag-card">{children}</div>;
}

export default function TicketByChannel({ orders, Wrapper }) {
  const stats = useMemo(() => {
    const channels = { delivery: { total: 0, count: 0 }, retiro: { total: 0, count: 0 } };
    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const ch = o.delivery === 'envio' ? 'delivery' : 'retiro';
      channels[ch].total += (o.total || 0);
      channels[ch].count += 1;
    });
    return {
      delivery: {
        avg: channels.delivery.count ? Math.round(channels.delivery.total / channels.delivery.count) : 0,
        count: channels.delivery.count,
        total: channels.delivery.total,
      },
      retiro: {
        avg: channels.retiro.count ? Math.round(channels.retiro.total / channels.retiro.count) : 0,
        count: channels.retiro.count,
        total: channels.retiro.total,
      },
    };
  }, [orders]);

  const maxAvg = Math.max(stats.delivery.avg, stats.retiro.avg) || 1;
  const Card = Wrapper || DefaultCard;

  return (
    <Card title="Ticket promedio por canal" state="prep" meta={`${stats.delivery.count + stats.retiro.count} pedidos`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
        {[
          { key: 'delivery', icon: '🛵', label: 'Delivery',        data: stats.delivery, color: 'var(--ag-c-prep)' },
          { key: 'retiro',   icon: '🏪', label: 'Retiro en local', data: stats.retiro,   color: 'var(--ag-c-sales)' },
        ].map(ch => (
          <div key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{ch.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                <span style={{ color: 'var(--ag-ink)' }}>{ch.label}</span>
                <span style={{ color: ch.color, fontWeight: 800 }}>${formatInt(ch.data.avg)}</span>
              </div>
              <div style={{ height: 8, background: 'var(--ag-bg-soft)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(ch.data.avg / maxAvg) * 100}%`, background: ch.color, borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--ag-ink-3)', marginTop: 3 }}>{ch.data.count} pedidos · ${formatInt(ch.data.total)} total</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
