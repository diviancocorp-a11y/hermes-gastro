// src/components/admin/recipes/SizesEditor.jsx
//
// Editor de tamaños/presentaciones de venta para una receta.
// Persiste en recipes.sizes (jsonb). Si NULL, el producto vende solo por unidad
// (comportamiento actual del sistema). Si tiene items, en el catálogo se muestra
// un selector obligatorio (radio) y el cliente elige uno antes de agregar al
// carrito.
//
// Cada tamaño es: { label, qty, price, hint? }
//   label: nombre visible ("½ docena", "Familiar", "Chica")
//   qty:   unidades reales que entrega esa presentación (6, 12, 24) — se usa
//          para descontar stock y para calcular costo automático
//   price: precio de venta (lo decide el admin; puede dar descuento por volumen)
//   hint:  texto auxiliar opcional ("Para 2 personas")
//
// Props:
//   sizes:          array | null
//   onChange(arr):  callback con el nuevo array (o null si se desactiva)
//   costPerUnit:    para mostrar costo y margen estimado de cada tamaño

import { useState, useEffect } from "react";
import DecimalInput from "../../ui/DecimalInput";
import { formatInt } from "../../../lib/utils";

export default function SizesEditor({ sizes, onChange, costPerUnit = 0, basePrice = 0 }) {
  const [enabled, setEnabled] = useState(Array.isArray(sizes) && sizes.length > 0);

  // Si llega sizes desde DB con items, marcar como enabled
  useEffect(() => {
    if (Array.isArray(sizes) && sizes.length > 0 && !enabled) setEnabled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizes?.length]);

  const handleToggle = (v) => {
    setEnabled(v);
    if (!v) onChange(null);
    else if (!Array.isArray(sizes) || sizes.length === 0) {
      // Al activar, sembrar con 1 tamaño en blanco
      onChange([{ label: "", qty: 1, price: 0, hint: "" }]);
    }
  };

  const items = Array.isArray(sizes) ? sizes : [];

  const updRow = (i, k, v) => {
    const next = items.map((row, j) => (j === i ? { ...row, [k]: v } : row));
    onChange(next);
  };
  const addRow = () => onChange([...items, { label: "", qty: 1, price: 0, hint: "" }]);
  const delRow = (i) => {
    const next = items.filter((_, j) => j !== i);
    onChange(next.length === 0 ? null : next);
    if (next.length === 0) setEnabled(false);
  };

  return (
    <div className="ag-card" style={{ padding: "4px 12px", marginBottom: 14 }}>
      <ToggleRow
        label="Vender por tamaños / presentaciones"
        hint='Ej: galleta unidad / ½ docena / docena. Si está OFF, vende por unidad con el "precio venta" de arriba.'
        checked={enabled}
        onChange={handleToggle}
      />

      {enabled && (
        <>
          <div style={{ borderTop: "1px solid var(--ag-line)" }} />
          <div style={{ padding: "10px 4px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--ag-ink-3)", lineHeight: 1.5 }}>
              Cada presentación tiene una <strong>cantidad</strong> (unidades reales que entrega)
              y un <strong>precio</strong> independiente. El cliente elige una al agregar al carrito.
            </p>

            {items.length === 0 ? (
              <div style={{ padding: 14, textAlign: "center", color: "var(--ag-ink-3)", fontSize: 12, background: "var(--ag-bg-soft)", borderRadius: 10 }}>
                Sin tamaños. Tocá &quot;+ Tamaño&quot; para empezar.
              </div>
            ) : (
              items.map((row, i) => {
                const costForSize = (Number(row.qty) || 0) * (Number(costPerUnit) || 0);
                const price = Number(row.price) || 0;
                const margin = price > 0 ? Math.round(((price - costForSize) / price) * 100) : null;
                const marginColor = margin === null ? "var(--ag-ink-3)" :
                  margin >= 50 ? "var(--ag-c-sales)" :
                  margin >= 30 ? "var(--ag-c-stock)" :
                  "var(--ag-c-orders)";
                // Ahorro vs comprar (qty) unidades sueltas al precio unitario base
                const fullPrice = (Number(row.qty) || 0) * (Number(basePrice) || 0);
                const saving = fullPrice > 0 && price > 0 ? fullPrice - price : 0;
                const savingPct = saving > 0 && fullPrice > 0 ? Math.round((saving / fullPrice) * 100) : 0;
                return (
                  <div key={i} style={{ marginBottom: 10, padding: 10, background: "var(--ag-bg-soft)", borderRadius: 10 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                      <input
                        className="ag-field-input"
                        style={{ flex: 2, padding: "8px 10px", fontSize: 13 }}
                        value={row.label || ""}
                        onChange={(e) => updRow(i, "label", e.target.value.slice(0, 50))}
                        placeholder="Ej: ½ docena"
                      />
                      <DecimalInput
                        className="ag-field-input"
                        style={{ width: 70, padding: "8px 10px", fontSize: 13, textAlign: "center" }}
                        min={1}
                        step="1"
                        value={row.qty || 1}
                        onChange={(n) => updRow(i, "qty", Math.max(1, Math.round(n)))}
                        placeholder="6"
                      />
                      <button
                        type="button" onClick={() => delRow(i)} aria-label="Quitar tamaño"
                        style={{ width: 32, height: 32, borderRadius: 8, background: "var(--ag-c-orders-soft)", color: "var(--ag-c-orders)", border: 0, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--ag-ink-3)", minWidth: 38 }}>Precio</span>
                      <DecimalInput
                        className="ag-field-input"
                        style={{ flex: 1, padding: "8px 10px", fontSize: 13 }}
                        min={0}
                        step="1"
                        value={row.price || 0}
                        onChange={(n) => updRow(i, "price", n)}
                        placeholder="0"
                      />
                      {costPerUnit > 0 && (
                        <span style={{ fontSize: 10.5, color: "var(--ag-ink-3)", minWidth: 90, textAlign: "right" }}>
                          costo ${formatInt(Math.round(costForSize))}
                          {margin !== null && <span style={{ color: marginColor, fontWeight: 700 }}> · {margin}%</span>}
                        </span>
                      )}
                    </div>

                    <input
                      className="ag-field-input"
                      style={{ width: "100%", padding: "8px 10px", fontSize: 12 }}
                      value={row.hint || ""}
                      onChange={(e) => updRow(i, "hint", e.target.value.slice(0, 100))}
                      placeholder="Hint opcional (ej: Para 2 personas)"
                    />

                    {saving > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "var(--ag-c-sales)", fontWeight: 600 }}>
                        El cliente ve: ahorra ${formatInt(saving)} ({savingPct}%) vs comprar {row.qty} unidades sueltas a ${formatInt(basePrice)}.
                      </div>
                    )}
                    {price > 0 && basePrice > 0 && saving < 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "var(--ag-ink-3)" }}>
                        Sin ahorro (este tamaño cuesta lo mismo o mas que comprar sueltas).
                      </div>
                    )}
                  </div>
                );
              })
            )}

            <button
              type="button" onClick={addRow}
              className="ag-btn-ghost"
              style={{ width: "100%", padding: "10px", fontSize: 13, marginTop: 4 }}
            >+ Tamaño</button>
          </div>
        </>
      )}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--ag-ink)", fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--ag-ink-3)", marginTop: 1 }}>{hint}</div>}
      </div>
      <button type="button" onClick={() => onChange(!checked)} aria-label={label} aria-pressed={checked}
        style={{
          width: 44, height: 26, borderRadius: 999,
          background: checked ? "var(--ag-c-terra)" : "var(--ag-bg-soft)",
          border: "1px solid " + (checked ? "var(--ag-c-terra)" : "var(--ag-line)"),
          cursor: "pointer", position: "relative", padding: 0, transition: "background 0.15s", flexShrink: 0,
        }}>
        <span style={{
          display: "block", width: 20, height: 20, borderRadius: 999, background: "#fff",
          position: "absolute", top: 2, left: checked ? 21 : 2,
          transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}
