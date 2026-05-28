/**
 * SettingsRow — fila configurable para pantalla de Settings.
 *
 * Props:
 *   icon:    nodo opcional (SVG)
 *   label:   string principal
 *   hint:    string secundario opcional
 *   state:   'sales' | 'orders' | 'stock' | 'crm' | 'prep' | 'recipes'
 *   right:   nodo a la derecha (ToggleSwitch, valor, etc.)
 *   onClick: si se pasa, la fila se vuelve clickeable y aparece chevron
 *   danger:  bool · marca acción destructiva (ej. logout)
 */
import { memo } from 'react'

function SettingsRow({ icon, label, hint, state = 'crm', right, onClick, danger = false }) {
  const Wrap = onClick ? 'button' : 'div'

  return (
    <Wrap
      type={onClick ? 'button' : undefined}
      className={`ag-settings-row ag-st-${state} ${danger ? 'danger' : ''}`}
      onClick={onClick}
    >
      {icon && <span className="ag-sr-icon">{icon}</span>}
      <span className="ag-sr-main">
        <span className="ag-sr-label">{label}</span>
        {hint && <span className="ag-sr-hint">{hint}</span>}
      </span>
      {right
        ? <span style={{ flexShrink: 0 }}>{right}</span>
        : onClick && (
            <svg className="ag-sr-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
    </Wrap>
  )
}

export default memo(SettingsRow)
