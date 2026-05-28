/**
 * SearchBar — input de búsqueda con icono de lupa.
 *
 * Props:
 *   value, onChange, placeholder
 */
import { memo } from 'react'

function SearchBar({ value = '', onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="ag-search">
      <span className="ag-search-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

export default memo(SearchBar)
