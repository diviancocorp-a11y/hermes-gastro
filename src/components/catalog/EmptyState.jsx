// src/components/catalog/EmptyState.jsx
// Componente genérico para empty states del catalog (sin productos en categoría,
// resultado de búsqueda sin matches, tienda cerrada, etc.).

export default function EmptyState({ icon = '🍽️', title, hint, action }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 20px',
      color: 'var(--t2, #6B5744)',
    }}>
      <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.6 }} aria-hidden="true">
        {icon}
      </div>
      <h3 style={{
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--tx, #2D1B0E)',
        margin: '0 0 6px',
        fontFamily: "'DM Serif Display', serif",
      }}>
        {title}
      </h3>
      {hint && (
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: '0 auto', maxWidth: 280 }}>
          {hint}
        </p>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
