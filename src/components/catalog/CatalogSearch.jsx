// src/components/catalog/CatalogSearch.jsx
// Input sticky para buscar productos. Solo aparece si hay >= MIN_PRODUCTS.
// Sistema visual v2.

const MIN_PRODUCTS = 15;

export default function CatalogSearch({ value, onChange, totalProducts, placeholder = "Buscar producto..." }) {
  if (totalProducts < MIN_PRODUCTS) return null;

  return (
    <div
      style={{
        padding: "10px 16px 12px",
        background: "var(--ag-bg, #fafaf7)",
        position: "sticky",
        top: 0,
        zIndex: 8,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ position: "relative" }}>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Buscar producto"
          style={{
            width: "100%",
            padding: "12px 14px 12px 42px",
            borderRadius: 12,
            border: "1px solid var(--ag-line, rgba(0,0,0,0.08))",
            background: "var(--ag-bg-soft, #fff)",
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            color: "var(--ag-ink, #2D1B0E)",
            outline: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--ag-c-terra, #C45D3E)";
            e.target.style.boxShadow = "0 0 0 3px rgba(196,93,62,0.12)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--ag-line, rgba(0,0,0,0.08))";
            e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 16,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        >
          🔍
        </div>
        {value && (
          <button
            onClick={() => onChange("")}
            aria-label="Limpiar búsqueda"
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "var(--ag-bg, transparent)",
              border: "none",
              fontSize: 16,
              color: "var(--ag-ink-3, #9C8B7A)",
              cursor: "pointer",
              padding: 6,
              lineHeight: 1,
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
