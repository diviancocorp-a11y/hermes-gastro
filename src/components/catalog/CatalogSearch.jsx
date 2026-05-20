// src/components/catalog/CatalogSearch.jsx
// Input de búsqueda sticky para filtrar productos por nombre o descripción.
// Aparece solo cuando hay > MIN_PRODUCTS productos en el catalog (para no
// abrumar catalogs chicos).

const MIN_PRODUCTS = 15;

export default function CatalogSearch({ value, onChange, totalProducts, placeholder = 'Buscar producto...' }) {
  if (totalProducts < MIN_PRODUCTS) return null;

  return (
    <div style={{
      padding: '8px 16px 12px',
      background: 'var(--bg, transparent)',
      position: 'sticky',
      top: 0,
      zIndex: 8,
    }}>
      <div style={{ position: 'relative' }}>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Buscar producto"
          style={{
            width: '100%',
            padding: '12px 14px 12px 42px',
            borderRadius: 12,
            border: '1px solid var(--b2, #F3EDE4)',
            background: 'var(--b3, #fff)',
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            color: 'var(--tx, #2D1B0E)',
            outline: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        />
        <div style={{
          position: 'absolute',
          left: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 16,
          pointerEvents: 'none',
        }} aria-hidden="true">
          🔍
        </div>
        {value && (
          <button
            onClick={() => onChange('')}
            aria-label="Limpiar búsqueda"
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              fontSize: 18,
              color: 'var(--t3, #9C8B7A)',
              cursor: 'pointer',
              padding: 6,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
