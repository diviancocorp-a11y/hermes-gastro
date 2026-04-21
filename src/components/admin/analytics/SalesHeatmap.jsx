// src/components/admin/analytics/SalesHeatmap.jsx
// Heatmap of sales by day-of-week × hour.
import { useMemo } from 'react';
import { formatInt } from '../../../lib/utils';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8am → 9pm

function getHeat(val, max) {
  if (!max || !val) return 'var(--b2)';
  const ratio = val / max;
  if (ratio > 0.75) return '#C45D3E';
  if (ratio > 0.5) return '#E07A5C';
  if (ratio > 0.25) return '#F4B89A';
  if (ratio > 0) return '#FDDCCC';
  return 'var(--b2)';
}

export default function SalesHeatmap({ orders }) {
  const { grid, maxVal } = useMemo(() => {
    // grid[day][hour] = count
    const g = DAYS.map(() => HOURS.map(() => 0));
    let max = 0;

    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const d = new Date(o.created_at || o.date);
      if (isNaN(d)) return;
      const dayIdx = (d.getDay() + 6) % 7; // Mon=0
      const hour = d.getHours();
      const hourIdx = HOURS.indexOf(hour);
      if (hourIdx < 0) return;
      g[dayIdx][hourIdx]++;
      if (g[dayIdx][hourIdx] > max) max = g[dayIdx][hourIdx];
    });

    return { grid: g, maxVal: max };
  }, [orders]);

  return (
    <div className="c" style={{ padding: 16 }}>
      <div className="fl" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🔥 Mapa de calor</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 2, fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ width: 32 }} />
              {HOURS.map(h => (
                <th key={h} style={{ fontWeight: 600, color: 'var(--t3)', padding: '2px 0' }}>{h}h</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, di) => (
              <tr key={day}>
                <td style={{ fontWeight: 600, color: 'var(--t2)', paddingRight: 4 }}>{day}</td>
                {HOURS.map((_, hi) => {
                  const val = grid[di][hi];
                  return (
                    <td
                      key={hi}
                      title={`${day} ${HOURS[hi]}h: ${val} pedidos`}
                      style={{
                        background: getHeat(val, maxVal),
                        borderRadius: 3,
                        width: 22, height: 22,
                        textAlign: 'center',
                        color: val > maxVal * 0.5 ? '#fff' : 'var(--t3)',
                        fontWeight: val ? 700 : 400,
                        cursor: 'default',
                      }}
                    >
                      {val || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8, fontSize: 10, color: 'var(--t3)' }}>
        <span>Menos</span>
        {['var(--b2)', '#FDDCCC', '#F4B89A', '#E07A5C', '#C45D3E'].map((c, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}
