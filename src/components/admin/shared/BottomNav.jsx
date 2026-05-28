/**
 * BottomNav — navegación inferior fija con 5 secciones.
 * Cada item activo dispara una micro-animación distintiva.
 *
 * Secciones (producción real):
 *   home     · Inicio
 *   orders   · Pedidos (con badge de pedidos NEW)
 *   purchase · Compras (abre overlay de compras)
 *   expenses · Gastos (abre overlay de gastos)
 *   more     · Más (hub a pantalla completa)
 *
 * Props:
 *   active:   'home' | 'orders' | 'purchase' | 'expenses' | 'more'
 *   onChange: (sectionId) => void
 *   badges:   { [id]: number }  ─ contadores opcionales (ej. orders: 3)
 */
import { memo } from 'react'

const SECTIONS = [
  { id: 'home',     label: 'Inicio',  Icon: HomeIcon },
  { id: 'orders',   label: 'Pedidos', Icon: OrdersIcon },
  { id: 'purchase', label: 'Compras', Icon: PurchaseIcon },
  { id: 'expenses', label: 'Gastos',  Icon: ExpensesIcon },
  { id: 'more',     label: 'Más',     Icon: MoreIcon },
]

function BottomNav({ active = 'home', onChange, badges = {} }) {
  return (
    <nav className="ag-bottom-nav" aria-label="Navegación principal">
      {SECTIONS.map(({ id, label, Icon }) => {
        const isActive = active === id
        const badge = badges[id] || 0
        return (
          <button
            key={id}
            type="button"
            className={`ag-nav-item ${isActive ? 'active' : ''}`}
            data-section={id}
            onClick={() => onChange?.(id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={`${label}${badge ? ` (${badge} nuevos)` : ''}`}
          >
            {badge > 0 && <span className="ag-nav-badge">{badge > 99 ? '99+' : badge}</span>}
            {/* Steam decorativo (sólo visible cuando active=orders) */}
            {id === 'orders' && (
              <svg className="ag-nav-steam" viewBox="0 0 16 12" aria-hidden="true">
                <path d="M4 12 Q5 6 4 2" />
                <path d="M8 12 Q9 4 8 0" />
                <path d="M12 12 Q11 6 12 2" />
              </svg>
            )}
            <Icon />
            <span className="ag-nav-label">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

/* ─── Iconos ─── */
function HomeIcon() {
  return (
    <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  )
}
function OrdersIcon() {
  return (
    <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10h16" />
      <path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" />
    </svg>
  )
}
function PurchaseIcon() {
  /* Camión con estela de humo saliendo del escape detrás
     Las líneas .ag-nav-smoke se animan cuando active=purchase. */
  return (
    <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* Estela de escape (3 segmentos de línea detrás del camión) */}
      <line className="ag-nav-smoke s1" x1="-4"  y1="11"   x2="2"   y2="11" />
      <line className="ag-nav-smoke s2" x1="-5"  y1="13.5" x2="1.5" y2="13.5" />
      <line className="ag-nav-smoke s3" x1="-5.5" y1="9"   x2="0.5" y2="9" />
      {/* Cuerpo del camión */}
      <rect x="2" y="7" width="11" height="9" rx="1" />
      <path d="M13 10h4l3 3v3h-7" />
      <circle className="ag-nav-wheel" cx="7"  cy="18" r="2" />
      <circle className="ag-nav-wheel" cx="17" cy="18" r="2" />
    </svg>
  )
}
function ExpensesIcon() {
  /* Moneda con símbolo $ que gira sobre su eje vertical (efecto flip de moneda)
     cuando active=expenses. */
  return (
    <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g className="ag-nav-coin">
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <text
          x="12" y="15.4"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="var(--ag-bg, #fff)"
        >$</text>
      </g>
    </svg>
  )
}
function MoreIcon() {
  return (
    <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle className="ag-nav-ddot" cx="5"  cy="12" r="2" />
      <circle className="ag-nav-ddot" cx="12" cy="12" r="2" />
      <circle className="ag-nav-ddot" cx="19" cy="12" r="2" />
    </svg>
  )
}

export default memo(BottomNav)
