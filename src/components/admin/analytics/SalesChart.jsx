// src/components/admin/analytics/SalesChart.jsx
// Line chart: sales over time. Pure SVG, no deps. Visual v2.
import { useMemo, useState } from 'react';
import { formatInt } from '../../../lib/utils';

const PERIOD_OPTIONS = [
  { key: 'day',   label: 'Día' },
  { key: 'week',  label: 'Semana' },
  { key: 'month', label: 'Mes' },
];

function groupByDay(sales) {
  const map = {};
  sales.forEach(s => {
    const d = (s.date || '').slice(0, 10);
    if (!d) return;
    map[d] = (map[d] || 0) + (s.total || 0);
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));
}
function groupByWeek(sales) {
  const map = {};
  sales.forEach(s => {
    const d = new Date(s.date);
    if (isNaN(d)) return;
    const day = d.getDay() || 7;
    const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
    const key = monday.toISOString().slice(0, 10);
    map[key] = (map[key] || 0) + (s.total || 0);
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date: `Sem ${date.slice(5)}`, total }));
}
function groupByMonth(sales) {
  const map = {};
  sales.forEach(s => {
    const key = (s.date || '').slice(0, 7);
    if (!key) return;
    map[key] = (map[key] || 0) + (s.total || 0);
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));
}

function MiniLineChart({ data, width = 320, height = 180 }) {
  if (data.length < 2) return <div style={{ textAlign: 'center', color: 'var(--ag-ink-3)', fontSize: 13, padding: 24 }}>Sin datos suficientes</div>;

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

  const yTicks = Array.from({ length: 5 }, (_, i) => minVal + (range * i) / 4);
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxHeight: 220, display: 'block' }}>
      {yTicks.map((v, i) => {
        const y = pad.top + h - ((v - minVal) / range) * h;
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--ag-line)" strokeWidth="1" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--ag-ink-3)">${formatInt(Math.round(v))}</text>
          </g>
        );
      })}
      <path d={areaD} fill="var(--ag-c-sales)" opacity="0.12" />
      <path d={pathD} fill="none" stroke="var(--ag-c-sales)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.length <= 31 && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--ag-c-sales)" stroke="var(--ag-bg)" strokeWidth="1.5">
          <title>{p.date}: ${formatInt(p.total)}</title>
        </circle>
      ))}
      {xLabels.map((d, i) => {
        const idx = data.indexOf(d);
        const x = pad.left + (idx / (data.length - 1)) * w;
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="9" fill="var(--ag-ink-3)">
            {d.date.length > 7 ? d.date.slice(5) : d.date}
          </text>
        );
      })}
    </svg>
  );
}

// Card por defecto a nivel módulo (evita recrear componente en cada render)
function DefaultCard({ children }) {
  return <div className="ag-card">{children}</div>;
}

export default function SalesChart({ sales, Wrapper }) {
  const [period, setPeriod] = useState('day');
  const data = useMemo(() => {
    if (period === 'week')  return groupByWeek(sales);
    if (period === 'month') return groupByMonth(sales);
    return groupByDay(sales).slice(-30);
  }, [sales, period]);

  const Card = Wrapper || DefaultCard;

  const periodTabs = (
    <div style={{ display: 'flex', gap: 4 }}>
      {PERIOD_OPTIONS.map(o => (
        <button
          key={o.key}
          type="button"
          onClick={() => setPeriod(o.key)}
          style={{
            padding: '3px 9px', borderRadius: 7, border: 0,
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            background: period === o.key ? 'var(--ag-c-sales)' : 'var(--ag-bg-soft)',
            color: period === o.key ? '#fff' : 'var(--ag-ink-2)',
            cursor: 'pointer',
          }}
        >{o.label}</button>
      ))}
    </div>
  );

  return (
    <Card title="Ventas en el tiempo" state="sales" meta={periodTabs}>
      {data.length === 0
        ? <div style={{ textAlign: 'center', color: 'var(--ag-ink-3)', fontSize: 13, padding: 24 }}>Sin datos</div>
        : <MiniLineChart data={data} />
      }
    </Card>
  );
}
