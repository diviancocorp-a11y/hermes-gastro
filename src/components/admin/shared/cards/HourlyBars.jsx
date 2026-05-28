/**
 * HourlyBars — mini bar chart con peaks resaltados.
 *
 * Props:
 *   data:        number[] (0-100 normalizado)
 *   peakIndices: number[] opcional · barras a marcar como peak (opacidad full)
 *   xLabels:     string[] opcional (mostrados debajo en posiciones equidistantes)
 */
import { memo } from 'react'

function HourlyBars({ data = [], peakIndices = [], xLabels = [] }) {
  const peakSet = new Set(peakIndices)

  return (
    <>
      <div className="ag-hourly">
        {data.map((v, i) => (
          <div
            key={i}
            className={`ag-hbar ${peakSet.has(i) ? 'peak' : ''}`}
            style={{ height: `${Math.min(100, Math.max(2, v))}%` }}
          />
        ))}
      </div>
      {xLabels.length > 0 && (
        <div className="ag-hourly-labels">
          {xLabels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </>
  )
}

export default memo(HourlyBars)
