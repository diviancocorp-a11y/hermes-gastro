// src/components/admin/analytics/SalesChart.jsx
// Line chart: sales over time with day/week/month grouping. Pure SVG, no deps.
import { useMemo, useState } from 'react';
import { formatInt } from '../../../lib/utils';

const PERIOD_OPTIONS = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
];

function groupByDay(sales) {
  const map = {};
  sales.forEach(s => {
    const d = (s.date || '').slice(0, 10);
    if (!d) return;
    map[d] = (map[d] || 0) + (s.total || 0);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));
}

function groupByWeek(sales) {
  const map = {};
  sales.forEach(s => {
    const d = new Date(s.date);
    if (isNaN(d)) return;
    const day = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + 1);
    const key = monday.toISOString().slice(0, 10);
    map[key] = (map[key] || 0) + (s.total || 0);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date: `Sem ${date.slice(5)}`, total }));
}

function groupByMonth(sales) {
  const map = {};
  sales.forEach(s => {
    const key = (s.date || '').slice(0, 7);
    if (!key) return;
    map[key] = (map[key] || 0) + (s.total || 0);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));
}

// Simple SVG line chart
function MiniLineChart({ data, width = 320, height = 180 }) {
  if (data.length < 2) return <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: 13, padding: 24 }}>Sin datos suficientes</div>;

  const pad = { top: 20, right: 10, bottom: 30, left: 55 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const maxVal = Math.max(...data.map(d => d.total)) || 1;
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * w,
    y: pad.top + h - ((d.total - minVal) / range) * h,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = pathD + ` L${points[points.length - 1].x.toFixed(1)},${pad.top + h} L${points[0].x.toFixed(1)},${pad.top + h} Z`;

  // Y axis ticks (4 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => minVal + (range * i) / 4);
  // X axis labels (max 6)
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxHeight: 220 }}>
      {/* Grid lines */}
      {yTicks.map((v, i) => {
        const y = pad.top + h - ((v - minVal) / range) * h;
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--b2)" strokeWidth="1" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--t3)">${formatInt(Math.round(v))}</text>
          </g>
        );
      })}
      {/* Area fill */}
      <path d={areaD} fill="var(--ac)" opacity="0.1" />
      {/* Line */}
      <path d={pathD} fill="none" stroke="var(--ac)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.length <= 31 && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--ac)" stroke="#fff" strokeWidth="1.5">
          <title>{p.date}: ${formatInt(p.total)}</title>
        </circle>
      ))}
      {/* X axis labels */}
      {xLabels.map((d, i) => {
        const idx = data.indexOf(d);
        const x = pad.left + (idx / (data.length - 1)) * w;
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="9" fill="var(--t3)">
            {d.date.length > 7 ? d.date.slice(5) : d.date}
          </text>
        );
      })}
    </svg>
  );
}

export default function SalesChart({ sales }) {
  const [period, setPeriod] = useState('day');

  const data = useMemo(() => {
    if (period === 'week') return groupByWeek(sales);
    if (period === 'month') return groupByMonth(sales);
    return groupByDay(sales).slice(-30);
  }, [sales, period]);

  return (
    <div className="c" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="fl" style={{ fontSize: 14, fontWeight: 700, marginBottom: 0 }}>📈 Ventas</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIOD_OPTIONS.map(o => (
            <button
              key={o.key}
              onClick={() => setPeriod(o.key)}
              style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
                background: period === o.key ? 'var(--ac)' : 'var(--b2)',
                color: period === o.key ? '#fff' : 'var(--t2)', cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: 13, padding: 24 }}>Sin datos</div>
      ) : (
        <MiniLineChart data={data} />
      )}
    </div>
  );
}
