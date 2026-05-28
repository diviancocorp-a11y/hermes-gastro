/**
 * TopProductsList — lista ranked con barra de progreso normalizada al máximo.
 *
 * Props:
 *   items: [{ name: string, value: number }]
 *   max:   number opcional · default = max(values)
 */
import { memo, useMemo } from 'react'

function TopProductsList({ items = [], max }) {
  const computedMax = useMemo(
    () => max ?? Math.max(...items.map(i => i.value || 0), 1),
    [items, max]
  )

  return (
    <div>
      {items.map((it, i) => {
        const pct = Math.min(100, Math.round((it.value / computedMax) * 100))
        return (
          <div key={i} className="ag-top-row">
            <div className="ag-top-rank">{i + 1}</div>
            <div className="ag-top-pname">{it.name}</div>
            <div className="ag-top-bar">
              <div className="ag-top-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="ag-top-pval">{it.value}</div>
          </div>
        )
      })}
    </div>
  )
}

export default memo(TopProductsList)
