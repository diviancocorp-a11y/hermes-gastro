/**
 * AnaCard — contenedor analítico con header (título + meta) y children.
 * La franja superior toma el color del estado pasado.
 *
 * Si recibe onClick, se convierte en botón con chevron derecho y cursor pointer
 * (drill-down a vista de detalle).
 *
 * Props:
 *   title:    string (ej "Estado de pedidos")
 *   meta:     string o nodo (ej "Hoy" · tabs · chips)
 *   state:    'sales' | 'orders' | 'stock' | 'crm' | 'prep' | 'recipes'
 *   onClick:  opcional · habilita drill-down con chevron
 *   children: contenido
 */
import { memo } from 'react'

function AnaCard({ title, meta, state = 'crm', onClick, children }) {
  const Tag = onClick ? 'button' : 'div'
  const extraProps = onClick
    ? {
        type: 'button',
        onClick,
        style: { cursor: 'pointer', border: 0, font: 'inherit', textAlign: 'left', width: '100%' },
      }
    : {}

  return (
    <Tag className={`ag-card ag-st-${state}${onClick ? ' is-clickable' : ''}`} {...extraProps}>
      <div className="ag-ana-head">
        <h4>{title}</h4>
        {meta && <span className="ag-ana-meta">{meta}</span>}
        {onClick && (
          <span className="ag-ana-arrow" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        )}
      </div>
      {children}
    </Tag>
  )
}

export default memo(AnaCard)
