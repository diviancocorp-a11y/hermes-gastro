/**
 * BottomNav — navegación inferior fija con 5 secciones (jun 2026).
 * Cada item activo dispara una micro-animación distintiva.
 *
 * Secciones (reorganizadas: Compras/Gastos/Más se mudaron al menú
 * hamburguesa; el nav queda con lo de uso diario):
 *   home     · Inicio
 *   orders   · Pedidos (con badge de pedidos NEW)
 *   recipes  · Recetas
 *   stock    · Stock
 *   sales    · Ventas
 *
 * Props:
 *   active:   'home' | 'orders' | 'recipes' | 'stock' | 'sales' | null
 *   onChange: (sectionId) => void
 *   badges:   { [id]: number }  ─ contadores opcionales (ej. orders: 3)
 */
import { memo } from 'react'

const SECTIONS = [
  { id: 'home',    label: 'Inicio',  Icon: HomeIcon },
  { id: 'orders',  label: 'Pedidos', Icon: OrdersIcon },
  { id: 'recipes', label: 'Recetas', Icon: RecipesIcon },
  { id: 'stock',   label: 'Stock',   Icon: StockIcon },
  { id: 'sales',   label: 'Ventas',  Icon: SalesIcon },
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
function RecipesIcon() {
  /* Ficha de receta: las líneas de texto se "escriben" (dash draw)
     en secuencia cuando active=recipes. */
  return (
    <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line className="ag-nav-rl r1" x1="8" y1="13" x2="16" y2="13" />
      <line className="ag-nav-rl r2" x1="8" y1="17" x2="14" y2="17" />
    </svg>
  )
}
function StockIcon() {
  /* Caja 3D: la tapa (diagonales superiores) "respira" y la caja
     da un saltito cuando active=stock. */
  return (
    <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="ag-nav-box">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline className="ag-nav-boxlid" points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </g>
    </svg>
  )
}
function SalesIcon() {
  /* Gráfico de barras: las 3 barras crecen en ola cuando active=sales. */
  return (
    <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line className="ag-nav-bar b1" x1="6"  y1="20" x2="6"  y2="14" />
      <line className="ag-nav-bar b2" x1="12" y1="20" x2="12" y2="9" />
      <line className="ag-nav-bar b3" x1="18" y1="20" x2="18" y2="4" />
    </svg>
  )
}

export default memo(BottomNav)
