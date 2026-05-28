/**
 * AlertRow — alerta horizontal con dot pulsante.
 *
 * Para usar en par (warn + urgent):
 *   <div className="ag-alerts">
 *     <AlertRow tone="urgent" title="2 pedidos nuevos" hint="esperando" />
 *     <AlertRow tone="warn"   title="3 ítems bajos"    hint="stock crítico" />
 *   </div>
 *
 * Props:
 *   tone:  'urgent' | 'warn'   ─ controla el color de la franja y el dot
 *   title: string en negrita
 *   hint:  string secundario
 *   onClick: opcional
 */
import { memo } from 'react'

function AlertRow({ tone = 'warn', title, hint, onClick }) {
  // urgent → orders (rojo) · warn → stock (amarillo) · ok → sales (verde)
  const state = tone === 'urgent' ? 'orders' : tone === 'ok' ? 'sales' : 'stock'
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      className={`ag-alert ag-st-${state}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      style={onClick ? { cursor: 'pointer', border: 0, font: 'inherit', textAlign: 'left' } : undefined}
    >
      <span className="ag-alert-dot" aria-hidden="true" />
      <span className="ag-alert-txt">
        <strong>{title}</strong>
        {hint && <span>{hint}</span>}
      </span>
    </Component>
  )
}

export default memo(AlertRow)
