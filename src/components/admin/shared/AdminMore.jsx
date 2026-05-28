/**
 * AdminMore — hub del tab "Más" (pantalla completa).
 *
 * Grid 2-col con accesos a las secciones que no entran en el bottom
 * nav principal.
 *
 * Props:
 *   onOpen:     (key) => void · 'stock' | 'recipes' | 'sales' | 'crm'
 *                              | 'waste' | 'invoicing' | 'exports'
 *   ffInvoice:  bool · feature flag E_INVOICE (oculta Facturación si false)
 *   badges:     { [key]: string } · etiqueta opcional sobre la card
 */
import { memo, useMemo } from 'react'

const BASE_ITEMS = [
  {
    key: 'stock',
    state: 'stock',
    label: 'Stock',
    hint: 'Ingredientes y críticos',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    key: 'recipes',
    state: 'recipes',
    label: 'Recetas',
    hint: 'Productos del menú',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    key: 'sales',
    state: 'sales',
    label: 'Ventas',
    hint: 'Ingresos, ticket promedio',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="20" x2="12" y2="10"/>
        <line x1="18" y1="20" x2="18" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="16"/>
      </svg>
    ),
  },
  {
    key: 'crm',
    state: 'crm',
    label: 'CRM',
    hint: 'Clientes y fidelización',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'waste',
    state: 'orders',
    label: 'Merma',
    hint: 'Pérdidas y ajustes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6"/>
        <path d="M14 11v6"/>
      </svg>
    ),
  },
  {
    key: 'suppliers',
    state: 'prep',
    label: 'Proveedores',
    hint: 'Carniceros, verdulería, etc.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    key: 'invoicing',
    state: 'prep',
    label: 'Facturación',
    hint: 'AFIP · electrónica',
    requires: 'ffInvoice',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="11" x2="12" y2="17"/>
        <line x1="9" y1="14" x2="15" y2="14"/>
      </svg>
    ),
  },
  {
    key: 'exports',
    state: 'crm',
    label: 'Exportes',
    hint: 'Descargas CSV/PDF',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
  {
    key: 'settings',
    state: 'recipes',
    label: 'Configuración',
    hint: 'Categorías, medios de pago, horarios',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

function AdminMore({ onOpen, ffInvoice = false, badges = {} }) {
  const items = useMemo(
    () => BASE_ITEMS.filter(it => {
      if (it.requires === 'ffInvoice') return !!ffInvoice
      return true
    }),
    [ffInvoice]
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="ag-p-head">
        <h1>Más</h1>
        <p className="ag-p-sub">Operación, ventas, clientes y más</p>
      </div>

      <div style={{ padding: '0 18px', overflowY: 'auto', flex: 1 }}>
        <div className="ag-hub-grid">
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              className={`ag-hub-card ag-st-${item.state}`}
              onClick={() => onOpen?.(item.key)}
            >
              {badges[item.key] && <span className="ag-hub-badge">{badges[item.key]}</span>}
              <div className="ag-hub-icon">{item.icon}</div>
              <div>
                <div className="ag-hub-label">{item.label}</div>
                <div className="ag-hub-hint">{item.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default memo(AdminMore)
