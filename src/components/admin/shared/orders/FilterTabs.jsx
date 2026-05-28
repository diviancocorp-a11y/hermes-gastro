/**
 * FilterTabs — pills scrollables que actúan como nav de columnas.
 *
 * Props:
 *   tabs:     [{ key, label, count }]
 *   activeKey:string
 *   onChange: (key) => void
 */
import { memo } from 'react'

function FilterTabs({ tabs = [], activeKey, onChange }) {
  return (
    <div className="ag-filter-tabs" role="tablist" aria-label="Filtros de pedidos">
      {tabs.map(t => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={activeKey === t.key}
          className={`ag-f-tab ${activeKey === t.key ? 'active' : ''}`}
          onClick={() => onChange?.(t.key)}
        >
          {t.label}
          {typeof t.count === 'number' && <span className="ag-f-cnt">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export default memo(FilterTabs)
