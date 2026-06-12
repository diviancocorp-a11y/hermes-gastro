/**
 * AdminProfileMenu — burbuja de perfil del topbar con dropdown (jun 2026).
 * Diseno adaptado del patron "profile dropdown" (kokonut) al stack propio:
 * CSS plano con tokens del admin, sin radix/Tailwind/next.
 *
 * Muestra: email del operador + su rol real (admin_users: owner/staff),
 * accesos a Personalizacion y a las paginas de configuracion
 * (Operacion · Finanzas · Zona de riesgo) y el logout.
 *
 * Props:
 *   email           — email del operador logueado
 *   userId          — auth.uid() para buscar el rol en admin_users
 *   avatarImage     — logo del negocio (opcional)
 *   avatarText      — inicial fallback
 *   onPersonalizacion, onOpenSection(key), onLogout
 */
import { memo, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const ROLE_LABEL = { owner: 'Dueño', staff: 'Staff' }

// Cache de rol por sesion (evita re-consultar al re-montar el topbar)
let _roleCache = { userId: null, role: null }

const ITEMS = [
  {
    key: 'personalizacion',
    label: 'Personalización',
    hint: 'Marca y catálogo',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" /><circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
      </svg>
    ),
  },
  {
    key: 'cfg-operacion',
    label: 'Operación',
    hint: 'Horarios y datos',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
  {
    key: 'cfg-finanzas',
    label: 'Finanzas',
    hint: 'Canales, targets, pasarelas',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    key: 'cfg-riesgo',
    label: 'Zona de riesgo',
    hint: 'Cierre de emergencia, reset',
    danger: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
]

function AdminProfileMenu({ email = '', userId = null, avatarImage = null, avatarText = 'A', onPersonalizacion, onOpenSection, onLogout }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState(_roleCache.userId === userId ? _roleCache.role : null)
  const rootRef = useRef(null)

  // Rol real del operador (admin_users es legible por cualquier admin)
  useEffect(() => {
    if (!userId || (_roleCache.userId === userId && _roleCache.role)) return
    let cancelled = false
    supabase.from('admin_users').select('role').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const r = data?.role || null
        _roleCache = { userId, role: r }
        setRole(r)
      })
    return () => { cancelled = true }
  }, [userId])

  // Cerrar al tocar fuera o con Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial = (avatarText || 'A').charAt(0).toUpperCase()
  const pick = (key) => {
    setOpen(false)
    if (key === 'personalizacion') onPersonalizacion?.()
    else onOpenSection?.(key)
  }

  return (
    <div ref={rootRef} className="ag-pm-root">
      <button
        type="button"
        className={`ag-pm-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Cuenta"
      >
        <span className="ag-pm-avatar">
          {avatarImage ? <img src={avatarImage} alt="" /> : initial}
        </span>
      </button>

      {open && (
        <div className="ag-pm-panel" role="menu">
          {/* Header: quien esta operando + su rol */}
          <div className="ag-pm-head">
            <span className="ag-pm-avatar lg">
              {avatarImage ? <img src={avatarImage} alt="" /> : initial}
            </span>
            <div className="ag-pm-id">
              <div className="ag-pm-email" title={email}>{email}</div>
              <div className="ag-pm-rolewrap">
                <span className="ag-pm-role">{ROLE_LABEL[role] || 'Operador'}</span>
              </div>
            </div>
          </div>

          <div className="ag-pm-items">
            {ITEMS.map(it => (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                className={`ag-pm-item ${it.danger ? 'danger' : ''}`}
                onClick={() => pick(it.key)}
              >
                <span className="ag-pm-item-icon">{it.icon}</span>
                <span className="ag-pm-item-text">
                  <span className="ag-pm-item-label">{it.label}</span>
                  <span className="ag-pm-item-hint">{it.hint}</span>
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ag-pm-item-chev">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>

          <div className="ag-pm-sep" />

          <button
            type="button"
            role="menuitem"
            className="ag-pm-logout"
            onClick={() => { setOpen(false); onLogout?.() }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export default memo(AdminProfileMenu)
