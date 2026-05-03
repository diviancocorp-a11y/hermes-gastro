// src/components/ui/CatChipsEditor.jsx
// Reusable inline category editor used in Stock (ing_cats) and Expenses (exp_cats).
// Persists to settings via updateSettings; UI is a collapsable details/summary.
import { useState } from "react";
import { updateSettings } from "../../services/settings";

export default function CatChipsEditor({ settings, setSettings, field, label, icon, showToast }) {
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const cats = settings?.[field] || [];

  const persist = async (next) => {
    setSaving(true);
    const saved = await updateSettings({ ...settings, [field]: next });
    setSaving(false);
    if (saved) {
      setSettings(saved);
      showToast?.("Categorías actualizadas ✓");
    } else {
      showToast?.("Error al guardar categorías");
    }
  };

  const add = () => {
    const v = val.trim();
    if (!v || cats.includes(v)) return;
    persist([...cats, v]);
    setVal("");
  };

  const remove = (c) => persist(cats.filter((x) => x !== c));

  return (
    <details className="c" style={{ marginBottom: 8, padding: "8px 12px" }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--tx)", listStyle: "none" }}>
        {icon || "🏷️"} {label || "Categorías"}
      </summary>
      <div style={{ marginTop: 10 }}>
        <div className="clist">
          {cats.length === 0 && <span style={{ fontSize: 12, color: "var(--t3)" }}>Sin categorías. Agregá la primera.</span>}
          {cats.map((c) => (
            <div key={c} className="ctag">
              {c}
              <button onClick={() => remove(c)} disabled={saving} aria-label={`Eliminar ${c}`}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            className="fin"
            placeholder="Nueva categoría..."
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            disabled={saving}
            style={{ fontSize: 13 }}
          />
          <button className="btn bs bsm" onClick={add} disabled={saving || !val.trim()}>+</button>
        </div>
      </div>
    </details>
  );
}
