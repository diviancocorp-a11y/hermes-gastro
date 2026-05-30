/**
 * KpiCard — métrica con franja de color de estado arriba.
 *
 * Props:
 *   label:    string (caps · "Ventas hoy")
 *   value:    string ("$142.580")  ─ pre-formateado
 *   delta:    string opcional ("↗ +12% vs ayer")
 *   trend:    'up' | 'down' (default 'up' si hay delta)
 *   state:    'sales' | 'orders' | 'stock' | 'crm' | 'prep' | 'recipes'
 *   onClick:  opcional (la card se vuelve clickeable)
 */
import { memo } from 'react'

function KpiCard({ label, value, delta, deltaNode, trend = 'up', state = 'sales', onClick }) {
  const Component = onClick ? 'button' : 'div'
  const stateClass = `ag-st-${state}`

  return (
    <Component
      className={`ag-card ag-kpi ${stateClass}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer', border: 0, font: 'inherit', textAlign: 'left', width: '100%' } : undefined}
      type={onClick ? 'button' : undefined}
    >
      <div className="ag-kpi-lbl">{label}</div>
      <div className="ag-kpi-val">{value}</div>
      {deltaNode ? (
        <div className="ag-kpi-delta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {deltaNode}
          {delta && <span style={{ color: 'var(--ag-ink-3)', fontSize: 11 }}>{delta}</span>}
        </div>
      ) : delta && (
        <div className={`ag-kpi-delta ${trend}`}>{delta}</div>
      )}
    </Component>
  )
}

export default memo(KpiCard)
