// src/components/admin/analytics/TicketByChannel.jsx
// Average ticket by delivery channel (delivery vs pickup).
import { useMemo } from 'react';
import { formatInt } from '../../../lib/utils';

export default function TicketByChannel({ orders }) {
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

  return (
    <div className="c" style={{ padding: 16 }}>
      <div className="fl" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🎫 Ticket promedio por canal</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { key: 'delivery', icon: '🛵', label: 'Delivery', data: stats.delivery, color: 'var(--bl)' },
          { key: 'retiro', icon: '🏪', label: 'Retiro en local', data: stats.retiro, color: 'var(--gn)' },
        ].map(ch => (
          <div key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{ch.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                <span style={{ color: 'var(--tx)' }}>{ch.label}</span>
                <span style={{ color: ch.color, fontWeight: 800 }}>${formatInt(ch.data.avg)}</span>
              </div>
              <div style={{ height: 8, background: 'var(--b2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(ch.data.avg / maxAvg) * 100}%`, background: ch.color, borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>{ch.data.count} pedidos · ${formatInt(ch.data.total)} total</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
