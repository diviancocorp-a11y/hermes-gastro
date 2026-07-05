// src/components/admin/recipes/BatchCalculator.jsx
//
// Calculadora por tanda — herramienta opcional para recetas que rinden varias
// unidades (ej: una tanda de 24 galletas).
//
// UX:
//   - Cuando esta CERRADA (batch_yield = null) se ve solo un boton "Abrir
//     calculadora por tanda" + una breve descripcion debajo del bloque de
//     ingredientes natural.
//   - Cuando esta ABIERTA (batch_yield != null) toma el lugar del bloque
//     natural: input rendimiento + ingredientes para la tanda (qty × yield)
//     + boton "+ Ingrediente" propio + boton "Quitar calculadora" al pie
//     que vuelve al modo natural.
//
// Persistencia:
//   batch_yield se guarda en DB. Al re-editar la receta, si tiene yield,
//   la calculadora ya viene abierta. No hay confusion sobre como se ingresaron
//   los datos.
//
// Internamente: el admin ingresa qty PARA LA TANDA. Dividimos por yield y
// persistimos en f.ingredients POR UNIDAD. El sistema de costo/stock sigue
// siendo por unidad — cero breaking change.

import { useState } from "react";
import DecimalInput from "../../ui/DecimalInput";

export default function BatchCalculator({ ingredients, recipeIngredients = [], onChange, batchYield, setBatchYield }) {
  const open = batchYield != null && batchYield > 0;
  const yieldN = open ? batchYield : 24;

  const [ad, setAd] = useState(false);
  const [si, setSi] = useState("");
  const [sq, setSq] = useState(""); // qty PARA LA TANDA

  const openCalculator = () => setBatchYield(24);
  const closeCalculator = () => setBatchYield(null);

  const handleYieldChange = (n) => {
    const next = Math.max(1, Math.round(Number(n) || 1));
    setBatchYield(next);
  };

  // Redondea a 6 decimales para matar el ruido de float (0.29/40 =>
  // 0.0072499999999999995). 6 decimales alcanza para gramos/ml por unidad.
  const cleanPerUnit = (batchQty, safeYield) =>
    Math.round(((Number(batchQty) || 0) / safeYield) * 1e6) / 1e6;

  const updateBatchQty = (i, batchQty) => {
    const safeYield = yieldN > 0 ? yieldN : 1;
    const perUnit = cleanPerUnit(batchQty, safeYield);
    onChange(recipeIngredients.map((ri, j) =>
      j === i ? { ...ri, qty: perUnit, quantity: perUnit } : ri
    ));
  };

  const addIngredient = () => {
    if (!si || !sq) return;
    const safeYield = yieldN > 0 ? yieldN : 1;
    const perUnit = cleanPerUnit(sq, safeYield);
    onChange([...recipeIngredients, { ingredient_id: si, qty: perUnit, quantity: perUnit }]);
    setSi(""); setSq(""); setAd(false);
  };

  const removeIngredient = (i) => {
    onChange(recipeIngredients.filter((_, j) => j !== i));
  };

  if (!open) {
    // Estado cerrado: solo boton + descripcion
    return (
      <div className="ag-card" style={{ padding: 14, marginBottom: 14, background: "var(--ag-bg-soft)", border: "1px dashed var(--ag-line)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink)", marginBottom: 4 }}>
              ¿Tu receta rinde varias unidades?
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 11.5, color: "var(--ag-ink-3)", lineHeight: 1.5 }}>
              Si una preparación rinde varias unidades (ej: tanda de 24 galletas, masa para 12 empanadas, mezcla para 6 panqueques), usá la calculadora por tanda. Ingresá los ingredientes para la <strong>tanda completa</strong> y el sistema divide automáticamente por el rendimiento, guardando los valores por unidad para que el costo y el stock queden exactos.
            </p>
          </div>
        </div>
        <button
          type="button" onClick={openCalculator}
          className="ag-btn-ghost"
          style={{ width: "100%", marginTop: 10, padding: "10px", fontSize: 13, fontWeight: 700, color: "var(--ag-c-terra)", border: "1.5px solid var(--ag-c-terra)" }}
        >
          🧮 Abrir calculadora por tanda
        </button>
      </div>
    );
  }

  // Estado abierto: la calculadora reemplaza al bloque natural
  return (
    <div className="ag-card" style={{ padding: "4px 12px", marginBottom: 14, border: "1.5px solid var(--ag-c-terra)" }}>
      <div style={{ padding: "12px 4px 8px", borderBottom: "1px solid var(--ag-line)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink)", marginBottom: 2 }}>
          🧮 Calculadora por tanda
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--ag-ink-3)", lineHeight: 1.5 }}>
          Ingresá los ingredientes <strong>para la tanda completa</strong>. El sistema divide por {yieldN} y guarda por unidad.
        </p>
      </div>

      <div style={{ padding: "10px 4px" }}>
        <label className="ag-field-lbl">Rendimiento por tanda</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DecimalInput
            className="ag-field-input" style={{ width: 100 }}
            min={1} step="1" value={yieldN}
            onChange={handleYieldChange} placeholder="24"
          />
          <span style={{ fontSize: 12, color: "var(--ag-ink-3)" }}>unidades por tanda</span>
        </div>
      </div>

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
        <div style={{ padding: "0 4px 8px" }}>
          {recipeIngredients.map((ri, i) => {
            const ig = ingredients.find((x) => x.id === ri.ingredient_id);
            const batchQty = (Number(ri.quantity) || 0) * yieldN;
            const roundedPerUnit = (Number(ri.quantity) || 0).toFixed(3);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--ag-line)" }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--ag-ink)", fontWeight: 600 }}>{ig?.name || "?"}</div>
                <DecimalInput
                  className="ag-field-input" style={{ width: 80, padding: "6px 8px", fontSize: 13 }}
                  min={0} step="0.01" value={batchQty}
                  onChange={(n) => updateBatchQty(i, n)} placeholder="0"
                />
                <span style={{ fontSize: 11, color: "var(--ag-ink-3)", minWidth: 36 }}>{ig?.unit || ""}</span>
                <span style={{ fontSize: 10.5, color: "var(--ag-ink-3)", minWidth: 64, textAlign: "right" }}>= {roundedPerUnit}/u</span>
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

      <button
        type="button" onClick={closeCalculator}
        className="ag-btn-ghost"
        style={{ width: "100%", margin: "8px 0 12px", padding: "9px", fontSize: 12, color: "var(--ag-ink-3)" }}
      >
        Quitar calculadora por tanda
      </button>
    </div>
  );
}
