/**
 * Fab — botón flotante circular (Material-style).
 *
 * Props:
 *   onClick, label (aria), children (default: +)
 */
import { memo } from 'react'

function Fab({ onClick, label = 'Agregar', children }) {
  return (
    <button
      type="button"
      className="ag-fab"
      onClick={onClick}
      aria-label={label}
    >
      {children || (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      )}
    </button>
  )
}

export default memo(Fab)
