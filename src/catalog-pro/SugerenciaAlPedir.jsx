// src/catalog-pro/SugerenciaAlPedir.jsx
// "Agregale papas a tu shawarma": una casilla en la ficha con el producto
// sugerido y su precio especial (0135: product_suggestions). Solo muestra el
// ahorro si el precio especial es menor al normal. El precio lo confirma el
// servidor al pedir; esto es la vista previa.
export default function SugerenciaAlPedir({ regla, producto, precioNormal, precioEspecial, marcada, onChange, formato }) {
  const ahorro = Math.max(0, precioNormal - precioEspecial);
  return (
    <div style={{ padding: "24px 22px 0" }}>
      <label style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", minHeight: 56,
        border: `1.5px ${marcada ? "solid" : "dashed"} ${marcada ? "var(--ac)" : "var(--line)"}`,
        background: marcada ? "var(--ac-soft, var(--b2))" : "var(--bg)",
        borderRadius: 14, cursor: "pointer", transition: "border-color 150ms, background 150ms",
      }}>
        <input type="checkbox" checked={marcada} onChange={(e) => onChange(e.target.checked)}
          style={{ accentColor: "var(--ac)", width: 20, height: 20, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14.5, color: "var(--tx)" }}>{regla.title}</span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--t2)", marginTop: 2 }}>
            {regla.body || producto.name}
            {regla.body ? ` · ${producto.name}` : ""}
          </span>
        </span>
        <span style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14.5, color: "var(--tx)" }}>+{formato(precioEspecial)}</span>
          {ahorro > 0 && (
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--ok, #2A9D6E)" }}>Ahorrás {formato(ahorro)}</span>
          )}
        </span>
      </label>
    </div>
  );
}
