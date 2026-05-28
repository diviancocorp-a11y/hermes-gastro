/**
 * Chips — fila scrollable de chips para filtros (categorías, etc.).
 *
 * Props:
 *   items:    [{ key, label }]
 *   activeKey:string
 *   onChange: (key) => void
 */
import { memo } from 'react'

function Chips({ items = [], activeKey, onChange }) {
  return (
    <div className="ag-chips">
      {items.map(it => (
        <button
          key={it.key}
          type="button"
          className={`ag-chip ${activeKey === it.key ? 'active' : ''}`}
          onClick={() => onChange?.(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export default memo(Chips)
