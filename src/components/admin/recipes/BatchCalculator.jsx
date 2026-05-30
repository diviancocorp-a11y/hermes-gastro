// src/components/admin/recipes/BatchCalculator.jsx
//
// Calculadora de tanda para recetas que rinden múltiples unidades.
// El admin piensa naturalmente "para 24 galletas necesito 500g de harina",
// pero el sistema guarda POR UNIDAD (qty / yield). Este componente hace el
// puente: cuando el toggle está ON, muestra qty × yield (para la tanda) y al
// editar divide por yield antes de actualizar el state.
//
// Importante: este componente NO persiste el yield en DB. Es solo UI input.
// El cálculo de costos del sistema sigue siendo por unidad — sin breaking
// change en cost/margin/stock.
//
// Props:
//   ingredients:        catálogo completo de insumos (para resolver nombres/unidades)
//   recipeIngredients:  array del state.f.ingredients (qty por unidad)
//   onChange(items):    callback con los ingredientes actualizados (qty por unidad)

import { useState } from "react";
import DecimalInput from "../../ui/DecimalInput";

export default function BatchCalculator({ ingredients, recipeIngredients = [], onChange }) {
  const [enabled, setEnabled] = useState(false);
  const [yieldN, setYieldN] = useState(24); // rendimiento default — caso galletas

  // Al apagar: nada que hacer, los valores se siguen viendo por unidad afuera.
  const handleToggle = (v) => {
    setEnabled(v);
  };

  // Actualizar la qty de un ingrediente PENSANDO EN LA TANDA.
  // Internamente, dividimos por yield para guardar por unidad.
  const updateBatchQty = (i, batchQty) => {
    const safeYield = yieldN > 0 ? yieldN : 1;
    const perUnit = (Number(batchQty) || 0) / safeYield;
    const next = recipeIngredients.map((ri, j) =>
      j === i ? { ...ri, qty: perUnit, quantity: perUnit } : ri
    );
    onChange(next);
  };

  // Si cambia el rendimiento mientras está activo, NO se reescriben los valores
  // por unidad (ya fueron divididos por el yield anterior). Solo cambia cómo se
  // visualizan los inputs (qty × nuevoYield). Es lo esperado: el admin acaba de
  // decidir "esta tanda rinde otra cantidad" y va a corregir los inputs.

  return (
    <div className="ag-card" style={{ padding: "4px 12px", marginBottom: 14 }}>
      <ToggleRow
        label="Receta por tanda"
        hint="Activa esto si una preparación rinde varias unidades (ej: 24 galletas, 12 empanadas)"
        checked={enabled}
        onChange={handleToggle}
      />

      {enabled && (
        <>
          <div style={{ borderTop: "1px solid var(--ag-line)" }} />
          <div style={{ padding: "10px 4px" }}>
            <label className="ag-field-lbl">Rendimiento por tanda</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <DecimalInput
                className="ag-field-input"
                style={{ width: 100 }}
                min={1}
                step="1"
                value={yieldN}
                onChange={(n) => setYieldN(Math.max(1, Math.round(n)))}
                placeholder="24"
              />
              <span style={{ fontSize: 12, color: "var(--ag-ink-3)" }}>unidades por tanda</span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--ag-ink-3)", lineHeight: 1.5 }}>
              Ingresá los ingredientes <strong>para la tanda completa</strong>.
              El sistema divide por {yieldN} y guarda por unidad. Si cambias el rendimiento,
              corregí los valores.
            </p>
          </div>

          {recipeIngredients.length === 0 ? (
            <div style={{ padding: "10px 4px 14px", fontSize: 12, color: "var(--ag-ink-3)" }}>
              Agregá ingredientes arriba para verlos acá.
            </div>
          ) : (
            <div style={{ padding: "6px 4px 12px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Para la tanda ({yieldN} unidades)
              </div>
              {recipeIngredients.map((ri, i) => {
                const ig = ingredients.find((x) => x.id === ri.ingredient_id);
                const batchQty = (Number(ri.quantity) || 0) * yieldN;
                const roundedPerUnit = (Number(ri.quantity) || 0).toFixed(3);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <div style={{ flex: 1, fontSize: 12.5, color: "var(--ag-ink)", fontWeight: 600 }}>
                      {ig?.name || "?"}
                    </div>
                    <DecimalInput
                      className="ag-field-input"
                      style={{ width: 90, padding: "6px 8px", fontSize: 13 }}
                      min={0}
                      step="0.01"
                      value={batchQty}
                      onChange={(n) => updateBatchQty(i, n)}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 11, color: "var(--ag-ink-3)", minWidth: 40 }}>{ig?.unit || ""}</span>
                    <span style={{ fontSize: 10.5, color: "var(--ag-ink-3)", minWidth: 78, textAlign: "right" }}>
                      = {roundedPerUnit} /u
                    </span>
                  </div>
                );
              })}
            </div>
          )}
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
