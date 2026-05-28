/**
 * Kanban — columnas con scroll-snap horizontal sincronizadas con tabs externas.
 *
 * Props:
 *   columns:   [{ key, title, count, items }]   ─ items son nodos React (cards)
 *   activeKey: string                            ─ key actualmente visible
 *   onActiveKeyChange: (key) => void             ─ disparado al scrollear
 *
 * Uso típico:
 *   const [active, setActive] = useState('new')
 *   <FilterTabs tabs={cols.map(c => ({key:c.key,label:c.title,count:c.count}))}
 *               activeKey={active} onChange={setActive}/>
 *   <Kanban columns={cols} activeKey={active} onActiveKeyChange={setActive}/>
 */
import { memo, useEffect, useRef } from 'react'

function Kanban({ columns = [], activeKey, onActiveKeyChange }) {
  const containerRef = useRef(null)
  const lastEmittedRef = useRef(activeKey)
  const isAutoScrollingRef = useRef(false)

  // 1) Cuando activeKey cambia desde afuera (click en tab) → scroll a esa col
  useEffect(() => {
    if (!activeKey || !containerRef.current) return
    if (lastEmittedRef.current === activeKey) return
    const idx = columns.findIndex(c => c.key === activeKey)
    if (idx < 0) return
    const target = idx * containerRef.current.clientWidth
    isAutoScrollingRef.current = true
    containerRef.current.scrollTo({ left: target, behavior: 'smooth' })
    setTimeout(() => { isAutoScrollingRef.current = false }, 500)
  }, [activeKey, columns])

  // 2) Detectar scroll del usuario → emitir nuevo activeKey
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (isAutoScrollingRef.current) return
        const idx = Math.round(el.scrollLeft / el.clientWidth)
        const newKey = columns[idx]?.key
        if (newKey && newKey !== lastEmittedRef.current) {
          lastEmittedRef.current = newKey
          onActiveKeyChange?.(newKey)
        }
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [columns, onActiveKeyChange])

  return (
    <div className="ag-kanban" ref={containerRef}>
      {columns.map(col => (
        <section key={col.key} className="ag-kb-col" data-col={col.key}>
          <header className="ag-kb-head">
            <h3>{col.title}</h3>
            {typeof col.count === 'number' && <span className="ag-kb-count">{col.count}</span>}
          </header>
          {col.items?.length
            ? col.items
            : <div className="ag-kb-empty">Sin pedidos en este estado.</div>}
        </section>
      ))}
    </div>
  )
}

export default memo(Kanban)
