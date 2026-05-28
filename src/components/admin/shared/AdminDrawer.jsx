/**
 * AdminDrawer — menú lateral (hamburguesa).
 *
 * Header con negocio/email, body con children (típicamente <Settings>),
 * footer fijo con logout. El toggle de tema vive ahora dentro del body
 * (en el grupo "Operación" de Settings), no en el footer.
 *
 * Props:
 *   open:          bool
 *   onClose:       () => void
 *   businessName:  string · header
 *   userEmail:     string · subtítulo header
 *   onLogout:      () => void
 *   children:      contenido del body del drawer
 */
import { memo } from 'react'

function AdminDrawer({
  open,
  onClose,
  businessName = '',
  userEmail = '',
  onLogout,
  children,
}) {
  return (
    <>
      <div
        className={`ag-drawer-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`ag-drawer ${open ? 'open' : ''}`}
        role="dialog"
        aria-label="Menú de configuración"
        aria-hidden={!open}
      >
        <header className="ag-drawer-header">
          <h3>{businessName}</h3>
          {userEmail && <p>{userEmail}</p>}
        </header>

        {children}

        <footer className="ag-drawer-footer">
          <button
            type="button"
            className="ag-drawer-action danger"
            onClick={onLogout}
          >
            <span className="ag-drawer-action-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span className="ag-drawer-action-label">Cerrar sesión</span>
          </button>
        </footer>
      </aside>
    </>
  )
}

export default memo(AdminDrawer)
