/**
 * AdminTopbar — header sticky del admin (jun 2026).
 *
 * Izquierda: boton de menu animado (morph hamburguesa→flecha, adaptado del
 *            patron "menu-toggle" con stroke-dasharray a CSS plano).
 * Centro:    nombre del negocio.
 * Derecha:   toggle claro/oscuro (sol/luna) + burbuja de perfil con dropdown
 *            (email, rol, Personalizacion, paginas de configuracion, logout).
 *
 * Props:
 *   title         · string mostrado al centro
 *   menuOpen      · estado del drawer (anima el boton de menu)
 *   onMenu        · handler del boton hamburguesa
 *   theme         · 'light' | 'dark'
 *   onToggleTheme · () => void
 *   email, name, userId · operador logueado (dropdown de perfil)
 *   onPersonalizacion, onOpenSection, onLogout · acciones del dropdown
 */
import { memo } from 'react'
import AdminProfileMenu from './AdminProfileMenu'

function AdminTopbar({
  title = '',
  menuOpen = false,
  onMenu,
  theme = 'light',
  onToggleTheme,
  email = '',
  name = '',
  userId = null,
  onPersonalizacion,
  onOpenSection,
  onLogout,
}) {
  const isDark = theme === 'dark'

  return (
    <header className="ag-topbar">
      {/* Boton de menu con morph (hamburguesa → flecha girada) */}
      <button
        type="button"
        className={`ag-topbar-menu ${menuOpen ? 'open' : ''}`}
        onClick={onMenu}
        aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menuOpen}
      >
        <svg className="ag-mt" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path className="ag-mt-top" d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22" />
          <path d="M7 16 27 16" />
        </svg>
      </button>

      <div className="ag-topbar-title">{title}</div>

      <div className="ag-topbar-right">
        {/* Toggle claro/oscuro: sol ↔ luna con giro */}
        <button
          type="button"
          className="ag-theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          <span className="ag-theme-toggle-inner" data-mode={isDark ? 'dark' : 'light'}>
            {isDark ? (
              /* Luna */
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.11-1.36A6 6 0 0 1 12 3z" />
              </svg>
            ) : (
              /* Sol */
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4.5" />
                <line x1="12" y1="1.5" x2="12" y2="3.5" /><line x1="12" y1="20.5" x2="12" y2="22.5" />
                <line x1="4.6" y1="4.6" x2="6" y2="6" /><line x1="18" y1="18" x2="19.4" y2="19.4" />
                <line x1="1.5" y1="12" x2="3.5" y2="12" /><line x1="20.5" y1="12" x2="22.5" y2="12" />
                <line x1="4.6" y1="19.4" x2="6" y2="18" /><line x1="18" y1="6" x2="19.4" y2="4.6" />
              </svg>
            )}
          </span>
        </button>

        <AdminProfileMenu
          email={email}
          name={name}
          userId={userId}
          onPersonalizacion={onPersonalizacion}
          onOpenSection={onOpenSection}
          onLogout={onLogout}
        />
      </div>
    </header>
  )
}

export default memo(AdminTopbar)
