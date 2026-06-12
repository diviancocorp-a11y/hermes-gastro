/**
 * AdminDrawer — menú lateral (hamburguesa), jun 2026.
 *
 * Ya no aloja la Configuración (eso vive en el dropdown de perfil del
 * topbar: Operación · Finanzas · Zona de riesgo). Ahora es el menú de
 * navegación con todo lo que salió del bottom nav: Compras, Gastos,
 * CRM, Merma, Proveedores, Usuarios, Facturación, Exportar.
 *
 * Props:
 *   open:          bool
 *   onClose:       () => void
 *   businessName:  string · header
 *   userEmail:     string · subtítulo header
 *   items:         [{ key, label, hint, icon, badge?, onClick }]
 *   onLogout:      () => void
 */
import { memo } from 'react'

function AdminDrawer({
  open,
  onClose,
  businessName = '',
  userEmail = '',
  items = [],
  onLogout,
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
        aria-label="Menú de navegación"
        aria-hidden={!open}
      >
        <header className="ag-drawer-header">
          <h3>{businessName}</h3>
          {userEmail && <p>{userEmail}</p>}
        </header>

        <div className="ag-drawer-body">
          <nav className="ag-drawer-menu" aria-label="Secciones">
            {items.map((item, i) => (
              <button
                key={item.key}
                type="button"
                className={`ag-drawer-mi${item.state ? ` ag-st-${item.state}` : ''}`}
                style={{ animationDelay: open ? `${i * 35}ms` : '0ms' }}
                onClick={() => { item.onClick?.(); onClose?.() }}
              >
                <span className="ag-drawer-mi-icon">{item.icon}</span>
                <span className="ag-drawer-mi-text">
                  <span className="ag-drawer-mi-label">{item.label}</span>
                  {item.hint && <span className="ag-drawer-mi-hint">{item.hint}</span>}
                </span>
                {item.badge ? <span className="ag-drawer-mi-badge">{item.badge}</span> : null}
              </button>
            ))}
          </nav>
        </div>

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
