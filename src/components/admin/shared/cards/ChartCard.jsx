/**
 * ChartCard — gráfico de línea estilo Fudo con tabs de rango.
 *
 * Props:
 *   leftLabel:  string ("Ventas — 7 días")
 *   leftValue:  string ("$5.256.608")
 *   rightLabel: string ("Ganancia")
 *   rightValue: string ("$684.170")
 *   ranges:     [{ key, label }]  (default: día/semana/mes)
 *   activeRange:string
 *   onRangeChange:(key) => void
 *   data:       number[]  — valores normalizados, mínimo 2
 *   highlightIndex: number opcional — punto resaltado
 *   highlightLabel: string opcional — tooltip sobre el highlight
 *   state:      default 'sales'
 */
import { memo, useMemo } from 'react'

const DEFAULT_RANGES = [
  { key: 'day',   label: 'Día' },
  { key: 'week',  label: 'Semana' },
  { key: 'month', label: 'Mes' },
]

function ChartCard({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  ranges = DEFAULT_RANGES,
  activeRange,
  onRangeChange,
  data = [],
  highlightIndex,
  highlightLabel,
  state = 'sales',
}) {
  const { linePath, areaPath, points } = useMemo(() => buildPath(data, 320, 120), [data])

  return (
    <div className={`ag-card ag-st-${state}`}>
      <div className="ag-chart-head">
        <div>
          {leftLabel && <div className="ag-chart-l-label">{leftLabel}</div>}
          {leftValue && <div className="ag-chart-l-amount">{leftValue}</div>}
        </div>
        {(rightLabel || rightValue) && (
          <div className="ag-chart-r">
            {rightLabel && <div className="ag-chart-r-label">{rightLabel}</div>}
            {rightValue && <div className="ag-chart-r-amount">{rightValue}</div>}
          </div>
        )}
      </div>

      {ranges?.length > 0 && (
        <div className="ag-range-tabs" role="tablist">
          {ranges.map(r => (
            <button
              key={r.key}
              type="button"
              className={`ag-range-tab ${activeRange === r.key ? 'active' : ''}`}
              role="tab"
              aria-selected={activeRange === r.key}
              onClick={() => onRangeChange?.(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <svg className="ag-chart-svg" viewBox="0 0 320 120" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="ag-chart-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="var(--ag-c-sales)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--ag-c-sales)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill="url(#ag-chart-grad)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--ag-c-sales)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {typeof highlightIndex === 'number' && points[highlightIndex] && (
          <>
            <circle
              cx={points[highlightIndex].x}
              cy={points[highlightIndex].y}
              r="4"
              fill="var(--ag-bg)"
              stroke="var(--ag-c-sales)"
              strokeWidth="2.5"
            />
            {highlightLabel && (
              <g transform={`translate(${Math.min(Math.max(points[highlightIndex].x - 32, 4), 320 - 68)}, 4)`}>
                <rect width="64" height="20" rx="6" fill="var(--ag-ink)" />
                <text x="32" y="14" textAnchor="middle" fill="var(--ag-bg)" fontSize="10" fontWeight="700" fontFamily="DM Sans">
                  {highlightLabel}
                </text>
              </g>
            )}
          </>
        )}
      </svg>
    </div>
  )
}

/* Build SVG path strings from numeric data (lower = "higher" on chart) */
function buildPath(data, width, height) {
  if (!data || data.length < 2) return { linePath: '', areaPath: '', points: [] }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const padTop = 8
  const padBot = 14

  const points = data.map((v, i) => {
    const x = i * stepX
    const norm = (v - min) / range            // 0..1
    const y = padTop + (1 - norm) * (height - padTop - padBot)
    return { x, y }
  })

  const linePath = 'M ' + points.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

  return { linePath, areaPath, points }
}

export default memo(ChartCard)
