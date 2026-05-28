/**
 * StatusGrid — 4 chips para mostrar conteos por estado de pedidos.
 * Diseñado para ir dentro de un AnaCard.
 *
 * Props:
 *   items: [{ dot: '#color', value: number, label: string }]
 */
import { memo } from 'react'

function StatusGrid({ items = [] }) {
  return (
    <div className="ag-status-grid">
      {items.map((it, i) => (
        <div key={i} className="ag-status-chip">
          <div className="ag-sc-dot" style={{ background: it.dot }} />
          <div className="ag-sc-val">{it.value}</div>
          <div className="ag-sc-lbl">{it.label}</div>
        </div>
      ))}
    </div>
  )
}

export default memo(StatusGrid)
