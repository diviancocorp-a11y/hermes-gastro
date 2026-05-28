/**
 * AdminTopbar — header sticky con franja terracota.
 *
 * Props:
 *   title:       string mostrado al centro
 *   avatarText:  inicial mostrada en el botón derecho (si no hay imagen)
 *   avatarImage: URL opcional para reemplazar el texto del avatar
 *   onMenu:      handler del botón hamburguesa (izquierda)
 *   onAvatar:    handler del botón avatar (derecha)
 */
import { memo } from 'react'

function AdminTopbar({ title = '', avatarText = 'A', avatarImage = null, onMenu, onAvatar }) {
  const initial = (avatarText || 'A').charAt(0).toUpperCase()

  return (
    <header className="ag-topbar">
      <button
        type="button"
        className="ag-topbar-menu"
        onClick={onMenu}
        aria-label="Abrir menú"
      >
        <span />
      </button>

      <div className="ag-topbar-title">{title}</div>

      <button
        type="button"
        className="ag-topbar-avatar"
        onClick={onAvatar}
        aria-label="Cuenta"
      >
        {avatarImage
          ? <img src={avatarImage} alt="" />
          : initial}
      </button>
    </header>
  )
}

export default memo(AdminTopbar)
