/**
 * Suppliers.jsx — gestión de proveedores (lista + crear/editar/eliminar).
 *
 * Accesible desde el hub "Más" → Proveedores.
 * Migración asociada: supabase/migrations/20260525_suppliers_and_receipts.sql
 */
import { useState, useEffect, useCallback } from "react";
import { fetchSuppliers, upsertSupplier, deleteSupplier } from "../../services/suppliers";

const DEFAULT_CATEGORIES = [
  "Carnicería", "Verdulería", "Almacén", "Lácteos",
  "Panadería", "Bebidas", "Limpieza", "Packaging",
  "Servicios", "Equipamiento", "Otros",
];

export default function Suppliers({ onBack, showToast }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchSuppliers();
    setList(data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = list.filter(s =>
    !search.trim() ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.category || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ag-page-over">
      <div className="ag-page-over-head">
        <button type="button" className="ag-subpage-back" onClick={onBack} aria-label="Volver">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Atrás</span>
        </button>
        <h2 className="ag-page-over-title">Proveedores</h2>
      </div>

      <div className="ag-page-over-body">

        {/* Búsqueda */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 14px", marginBottom: 14,
          background: "var(--ag-bg-card)",
          border: "1px solid var(--ag-line)",
          borderRadius: 12,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ag-ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proveedor..."
            style={{
              flex: 1, border: 0, outline: "none", background: "transparent",
              color: "var(--ag-ink)", fontFamily: "inherit", fontSize: 13,
            }}
          />
        </div>

        {/* CTA agregar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <button
            type="button"
            className="ag-cta"
            onClick={() => setEditing({ name: "", phone: "", email: "", category: "", notes: "" })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Nuevo proveedor</span>
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="ag-card" style={{ padding: 28, textAlign: "center", color: "var(--ag-ink-3)", fontSize: 13 }}>
            Cargando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="ag-card" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🚚</div>
            <div style={{ color: "var(--ag-ink-3)", fontSize: 13 }}>
              {search ? "Sin resultados" : "Sin proveedores. Creá el primero."}
            </div>
          </div>
        ) : (
          <div className="ag-card" style={{ padding: 4 }}>
            {filtered.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setEditing(s)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 12px",
                  border: 0, background: "transparent",
                  borderTop: i === 0 ? "none" : "1px solid var(--ag-line)",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "var(--ag-c-prep-soft)",
                  color: "var(--ag-c-prep)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 14,
                  flexShrink: 0,
                }}>
                  {(s.name || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ag-ink)" }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ag-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.category || "Sin categoría"}{s.phone ? ` · 📞 ${s.phone}` : ""}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ag-ink-3)", flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <SupplierForm
          supplier={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            const saved = await upsertSupplier(data);
            if (saved?.__error) { showToast?.("Error: " + saved.__error); return; }
            showToast?.(data.id ? "Proveedor actualizado ✓" : "Proveedor creado ✓");
            setEditing(null);
            await load();
          }}
          onDelete={async () => {
            if (!confirm(`¿Eliminar a ${editing.name}? Sus gastos históricos se preservan.`)) return;
            const r = await deleteSupplier(editing.id);
            if (r?.__error) { showToast?.("Error: " + r.__error); return; }
            showToast?.("Proveedor eliminado");
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function SupplierForm({ supplier, onClose, onSave, onDelete }) {
  const [f, setF] = useState({ ...supplier });
  const isNew = !supplier.id;
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const canSave = (f.name || "").trim().length >= 2;

  return (
    <div className="ag-page-over" style={{ zIndex: 910 }}>
      <div className="ag-page-over-head">
        <button type="button" className="ag-subpage-back" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          <span>Cancelar</span>
        </button>
        <h2 className="ag-page-over-title">{isNew ? "Nuevo proveedor" : "Editar proveedor"}</h2>
      </div>

      <div className="ag-page-over-body">
        <label className="ag-field-lbl">Nombre *</label>
        <input
          className="ag-field-input"
          value={f.name || ""}
          onChange={e => s("name", e.target.value)}
          placeholder="Ej: Carnicería La Esquina"
          style={{ marginBottom: 12 }}
          autoFocus
        />

        <label className="ag-field-lbl">Categoría</label>
        <select
          className="ag-field-input"
          value={f.category || ""}
          onChange={e => s("category", e.target.value)}
          style={{ marginBottom: 12 }}
        >
          <option value="">Sin categoría</option>
          {DEFAULT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label className="ag-field-lbl">Teléfono</label>
            <input
              className="ag-field-input"
              value={f.phone || ""}
              onChange={e => s("phone", e.target.value)}
              placeholder="549..."
              inputMode="tel"
            />
          </div>
          <div>
            <label className="ag-field-lbl">Email</label>
            <input
              className="ag-field-input"
              type="email"
              value={f.email || ""}
              onChange={e => s("email", e.target.value)}
              placeholder="proveedor@..."
            />
          </div>
        </div>

        <label className="ag-field-lbl">Notas</label>
        <textarea
          className="ag-field-input"
          value={f.notes || ""}
          onChange={e => s("notes", e.target.value)}
          placeholder="Días de entrega, mínimos, etc."
          rows={3}
          style={{ resize: "vertical", minHeight: 70, fontFamily: "inherit" }}
        />

        <button
          type="button"
          className="ag-btn-primary"
          style={{ marginTop: 18, width: "100%", padding: "14px", fontSize: 15, opacity: canSave ? 1 : 0.5 }}
          disabled={!canSave}
          onClick={() => canSave && onSave(f)}
        >✓ {isNew ? "Crear proveedor" : "Guardar cambios"}</button>

        {!isNew && (
          <button
            type="button"
            onClick={onDelete}
            style={{
              marginTop: 10, width: "100%", padding: "12px",
              background: "transparent",
              color: "var(--ag-c-orders)",
              border: "1px solid var(--ag-c-orders)",
              borderRadius: 999,
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              cursor: "pointer",
            }}
          >🗑 Eliminar proveedor</button>
        )}
      </div>
    </div>
  );
}
