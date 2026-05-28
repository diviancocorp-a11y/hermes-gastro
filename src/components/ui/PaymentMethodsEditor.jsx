// src/components/ui/PaymentMethodsEditor.jsx
// CRUD de medios de pago habilitados (settings.payment_methods).
// Toggle de presets (efectivo, transferencia, MP, tarjeta) + agregar/eliminar custom.
// Afecta TODO el sistema (Compras, Gastos, Catálogo público).
import { useState } from "react";
import { updateSettings } from "../../services/settings";

const PRESETS = [
  { key: "efectivo",      label: "Efectivo",     icon: "💵" },
  { key: "transferencia", label: "Transferencia",icon: "🏦" },
  { key: "mercadopago",   label: "MercadoPago",  icon: "💳" },
  { key: "tarjeta",       label: "Tarjeta",      icon: "💳" },
];
const PRESET_KEYS = PRESETS.map(p => p.key);

export default function PaymentMethodsEditor({ settings, setSettings, showToast }) {
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const list = settings?.payment_methods || ["efectivo", "transferencia", "mercadopago"];
  const isOn = (k) => list.includes(k);

  const persist = async (next) => {
    setSaving(true);
    const saved = await updateSettings({ ...settings, payment_methods: next });
    setSaving(false);
    if (saved) {
      setSettings(saved);
      showToast?.("Medios de pago actualizados ✓");
    } else {
      showToast?.("Error al guardar");
    }
  };

  const togglePreset = (k) => {
    persist(isOn(k) ? list.filter(x => x !== k) : [...list, k]);
  };
  const addCustom = () => {
    const cleaned = val.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");
    if (!cleaned) return;
    if (list.includes(cleaned)) { showToast?.(`"${cleaned}" ya existe`); return; }
    persist([...list, cleaned]);
    setVal("");
  };
  const removeCustom = (k) => {
    if (!confirm(`¿Eliminar "${k}"? Los gastos viejos con este medio se preservan.`)) return;
    persist(list.filter(x => x !== k));
  };

  const customs = list.filter(k => !PRESET_KEYS.includes(k));

  return (
    <div>
      {/* Presets — toggleables */}
      <label className="ag-field-lbl">Medios habilitados</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
        {PRESETS.map(pm => {
          const on = isOn(pm.key);
          return (
            <button
              key={pm.key}
              type="button"
              onClick={() => togglePreset(pm.key)}
              disabled={saving}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 12px", borderRadius: 10,
                border: on ? "2px solid var(--ag-c-terra)" : "1px solid var(--ag-line)",
                background: on ? "rgba(196,93,62,0.08)" : "var(--ag-bg)",
                color: on ? "var(--ag-c-terra)" : "var(--ag-ink-2)",
                fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                cursor: saving ? "wait" : "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 16 }}>{pm.icon}</span>
              <span style={{ flex: 1 }}>{pm.label}</span>
              {on && <span style={{ fontSize: 14 }}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Custom — agregar */}
      <label className="ag-field-lbl">Agregar medio personalizado</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          className="ag-field-input"
          value={val}
          onChange={(e) => setVal(e.target.value.slice(0, 30))}
          placeholder="Ej: Naranja, USD, Cuenta DNI..."
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          disabled={saving}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="ag-btn-primary"
          onClick={addCustom}
          disabled={saving || !val.trim()}
          style={{ opacity: !val.trim() ? 0.5 : 1 }}
        >+ Agregar</button>
      </div>

      {/* Lista de custom */}
      {customs.length > 0 ? (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ag-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Personalizados ({customs.length})
          </div>
          <div className="ag-card" style={{ padding: 4 }}>
            {customs.map((k, i) => (
              <div
                key={k}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px",
                  borderTop: i === 0 ? "none" : "1px solid var(--ag-line)",
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: "var(--ag-bg-soft)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}>🏷️</div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ag-ink)", textTransform: "capitalize" }}>
                  {k.replace(/_/g, " ")}
                </span>
                <button
                  type="button"
                  onClick={() => removeCustom(k)}
                  disabled={saving}
                  aria-label={`Eliminar ${k}`}
                  style={{
                    width: 28, height: 28,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: 0, borderRadius: 8,
                    background: "rgba(232,90,74,0.10)",
                    color: "var(--ag-c-orders)",
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.5 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="ag-card" style={{ padding: 18, textAlign: "center", color: "var(--ag-ink-3)", fontSize: 12 }}>
          Sin medios personalizados. Agregá uno arriba.
        </div>
      )}
    </div>
  );
}
