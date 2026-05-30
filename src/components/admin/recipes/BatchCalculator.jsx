// src/components/admin/recipes/BatchCalculator.jsx
//
// Calculadora de tanda para recetas que rinden múltiples unidades.
// Se ACTIVA persistiendo recipes.batch_yield (int) — al re-abrir la receta,
// si tiene yield != null, este bloque queda activo y oculta el flujo natural
// de ingredientes.
//
// Modo de uso:
//   - Toggle ON  -> el padre setea f.batch_yield = 24 (default) y OCULTA el
//                   bloque natural de "Ingredientes". Toda la edicion de
//                   ingredientes pasa por este componente.
//   - Toggle OFF -> el padre setea f.batch_yield = null y muestra el bloque
//                   natural de nuevo. Si habia ingredientes, se conservan
//                   tal como estaban (por unidad).
//
// Internamente: lo que el admin ingresa SIEMPRE es "para la tanda". Al
// actualizar, dividimos por yield y guardamos en f.ingredients por unidad.
// El sistema de costo/stock sigue siendo por unidad — cero breaking change.
//
// Props:
//   ingredients:        catálogo completo de insumos
//   recipeIngredients:  array del state.f.ingredients (qty POR UNIDAD)
//   onChange(items):    callback con los ingredientes actualizados (por unidad)
//   batchYield:         number | null
//   setBatchYield(n):   setter (n = null para desactivar)

import { useState } from "react";
import DecimalInput from "../../ui/DecimalInput";

export default function BatchCalculator({ ingredients, recipeIngredients = [], onChange, batchYield, setBatchYield }) {
  const enabled = batchYield != null && batchYield > 0;
  const yieldN = enabled ? batchYield : 24; // 24 = default al activar

  // Popover "Agregar ingrediente" (modo tanda)
  const [ad, setAd] = useState(false);
  const [si, setSi] = useState("");
  const [sq, setSq] = useState(""); // qty PARA LA TANDA

  const handleToggle = (v) => {
    if (v) setBatchYield(24);
    else setBatchYield(null);
  };

  // Cuando cambia yield, NO modificamos f.ingredients (los valores por unidad
  // no se reescriben automaticamente). El admin re-corrige si hace falta.
  const handleYieldChange = (n) => {
    const next = Math.max(1, Math.round(Number(n) || 1));
    setBatchYield(next);
  };

  const updateBatchQty = (i, batchQty) => {
    const safeYield = yieldN > 0 ? yieldN : 1;
    const perUnit = (Number(batchQty) || 0) / safeYield;
    const next = recipeIngredients.map((ri, j) =>
      j === i ? { ...ri, qty: perUnit, quantity: perUnit } : ri
    );
    onChange(next);
  };

  const addIngredient = () => {
    if (!si || !sq) return;
    const safeYield = yieldN > 0 ? yieldN : 1;
    const batchQty = Number(sq) || 0;
    const perUnit = batchQty / safeYield;
    onChange([...recipeIngredients, { ingredient_id: si, qty: perUnit, quantity: perUnit }]);
    setSi(""); setSq(""); setAd(false);
  };

  const removeIngredient = (i) => {
    onChange(recipeIngredients.filter((_, j) => j !== i));
  };

  return (
    <div className="ag-card" style={{ padding: "4px 12px", marginBottom: 14 }}>
      <ToggleRow
        label="Receta por tanda"
        hint="Activá esto si la preparación rinde varias unidades (ej: 24 galletas)"
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
                onChange={handleYieldChange}
                placeholder="24"
              />
              <span style={{ fontSize: 12, color: "var(--ag-ink-3)" }}>unidades por tanda</span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--ag-ink-3)", lineHeight: 1.5 }}>
              Ingresá los ingredientes <strong>para la tanda completa</strong>.
              El sistema divide por {yieldN} y guarda por unidad.
            </p>
          </div>

          {/* Header de Ingredientes + boton + Ingrediente */}
          <div style={{ borderTop: "1px solid var(--ag-line)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px 6px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ag-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Ingredientes para la tanda ({recipeIngredients.length})
            </div>
            <button type="button" onClick={() => setAd(true)} className="ag-btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}>+ Ingrediente</button>
          </div>

          {ad && (
            <div className="ag-card" style={{ padding: 12, margin: "0 0 10px", background: "var(--ag-bg-card)", border: "1.5px solid var(--ag-c-prep)" }}>
              <label className="ag-field-lbl">Insumo</label>
              <select className="ag-field-input" value={si} onChange={e => setSi(e.target.value)} style={{ marginBottom: 8 }}>
                <option value="">Seleccionar insumo...</option>
                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              </select>
              <label className="ag-field-lbl">Cantidad para la tanda ({yieldN} unidades)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <DecimalInput className="ag-field-input" min={0} step="0.01" value={sq || 0} onChange={(n) => setSq(String(n))} placeholder="0" style={{ flex: 1 }} />
                <button type="button" onClick={addIngredient} className="ag-btn-primary" style={{ padding: "10px 16px", fontSize: 13 }} disabled={!si || !sq}>✓</button>
                <button type="button" onClick={() => { setAd(false); setSi(""); setSq(""); }} className="ag-btn-ghost" style={{ padding: "10px 14px", fontSize: 13 }}>×</button>
              </div>
            </div>
          )}

          {recipeIngredients.length === 0 ? (
            <div style={{ padding: "14px 4px", textAlign: "center", color: "var(--ag-ink-3)", fontSize: 12 }}>
              Aún no hay ingredientes. Tocá &quot;+ Ingrediente&quot; para empezar.
            </div>
          ) : (
            <div style={{ padding: "0 4px 12px" }}>
              {recipeIngredients.map((ri, i) => {
                const ig = ingredients.find((x) => x.id === ri.ingredient_id);
                const batchQty = (Number(ri.quantity) || 0) * yieldN;
                const roundedPerUnit = (Number(ri.quantity) || 0).toFixed(3);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--ag-line)" }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--ag-ink)", fontWeight: 600 }}>
                      {ig?.name || "?"}
                    </div>
                    <DecimalInput
                      className="ag-field-input"
                      style={{ width: 80, padding: "6px 8px", fontSize: 13 }}
                      min={0}
                      step="0.01"
                      value={batchQty}
                      onChange={(n) => updateBatchQty(i, n)}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 11, color: "var(--ag-ink-3)", minWidth: 36 }}>{ig?.unit || ""}</span>
                    <span style={{ fontSize: 10.5, color: "var(--ag-ink-3)", minWidth: 64, textAlign: "right" }}>
                      = {roundedPerUnit}/u
                    </span>
                    <button type="button" onClick={() => removeIngredient(i)} aria-label="Quitar"
                      style={{ width: 26, height: 26, borderRadius: 8, background: "var(--ag-c-orders-soft)", color: "var(--ag-c-orders)", border: 0, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
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
