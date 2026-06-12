/**
 * AdminDrawer — menú de navegación del botón hamburguesa (jun 2026, v2).
 *
 * Ya no es un drawer lateral que tapaba el botón: es un DESPLEGABLE que
 * nace del botón morph del topbar (scale desde la esquina superior
 * izquierda), así la animación hamburguesa→flecha queda siempre visible.
 *
 * Sin "Cerrar sesión" ni correo del operador: eso vive en la burbuja de
 * perfil. Solo el nombre del negocio como título chico + los items.
 *
 * Props:
 *   open:          bool
 *   onClose:       () => void
 *   businessName:  string · título del panel
 *   items:         [{ key, label, hint, icon, state?, badge?, onClick }]
 */
import { memo } from 'react'

function AdminDrawer({
  open,
  onClose,
  businessName = '',
  items = [],
}) {
  return (
    <>
      {/* Backdrop invisible: cierra al tocar fuera (incluye tocar el botón) */}
      <div
        className={`ag-menu-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`ag-menu-panel ${open ? 'open' : ''}`}
        role="menu"
        aria-label="Menú de navegación"
        aria-hidden={!open}
      >
        {businessName && <div className="ag-menu-title">{businessName}</div>}
        <nav className="ag-drawer-menu" aria-label="Secciones">
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`ag-drawer-mi${item.state ? ` ag-st-${item.state}` : ''}`}
              style={{ animationDelay: open ? `${i * 30}ms` : '0ms' }}
              onClick={() => { item.onClick?.(); onClose?.() }}
              tabIndex={open ? 0 : -1}
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
    </>
  )
}

export default memo(AdminDrawer)
