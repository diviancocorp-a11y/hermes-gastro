// src/components/admin/analytics/SalesHeatmap.jsx
// Heatmap de pedidos por día × hora. Visual v2.
import { useMemo } from 'react';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8am → 9pm

const HEAT_COLORS = ['var(--ag-bg-soft)', '#FDDCCC', '#F4B89A', '#E07A5C', 'var(--ag-c-terra)'];

function getHeat(val, max) {
  if (!max || !val) return HEAT_COLORS[0];
  const ratio = val / max;
  if (ratio > 0.75) return HEAT_COLORS[4];
  if (ratio > 0.5)  return HEAT_COLORS[3];
  if (ratio > 0.25) return HEAT_COLORS[2];
  return HEAT_COLORS[1];
}

// Card por defecto a nivel módulo (evita recrear componente en cada render)
function DefaultCard({ children }) {
  return <div className="ag-card">{children}</div>;
}

export default function SalesHeatmap({ orders, Wrapper }) {
  const { grid, maxVal, totalOrders } = useMemo(() => {
    const g = DAYS.map(() => HOURS.map(() => 0));
    let max = 0;
    let total = 0;

    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const d = new Date(o.created_at || o.date);
      if (isNaN(d)) return;
      const dayIdx = (d.getDay() + 6) % 7; // Mon=0
      const hour = d.getHours();
      const hourIdx = HOURS.indexOf(hour);
      if (hourIdx < 0) return;
      g[dayIdx][hourIdx]++;
      total++;
      if (g[dayIdx][hourIdx] > max) max = g[dayIdx][hourIdx];
    });

    return { grid: g, maxVal: max, totalOrders: total };
  }, [orders]);

  const Card = Wrapper || DefaultCard;

  return (
    <Card title="Mapa de calor" state="orders" meta={`${totalOrders} pedidos`}>
      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 2, fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ width: 32 }} />
              {HOURS.map(h => (
                <th key={h} style={{ fontWeight: 600, color: 'var(--ag-ink-3)', padding: '2px 0' }}>{h}h</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, di) => (
              <tr key={day}>
                <td style={{ fontWeight: 600, color: 'var(--ag-ink-2)', paddingRight: 4 }}>{day}</td>
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
                        color: val > maxVal * 0.5 ? '#fff' : 'var(--ag-ink-3)',
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 10, color: 'var(--ag-ink-3)' }}>
        <span>Menos</span>
        {HEAT_COLORS.map((c, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />
        ))}
        <span>Más</span>
      </div>
    </Card>
  );
}
