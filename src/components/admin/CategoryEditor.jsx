// src/components/admin/CategoryEditor.jsx
// Admin panel for managing category groups (create, edit, reorder, delete).
import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../lib/utils';
import {
  fetchAllCategoryGroups, upsertCategoryGroup,
  deleteCategoryGroup, reorderCategoryGroups,
} from '../../services/categories';

export default function CategoryEditor({ msg, onClose }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | group object
  const [form, setForm] = useState({ name: '', icon: '📦', subcategories: '', visible: true });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllCategoryGroups();
    setGroups(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (g) => {
    setEditing(g);
    setForm({
      name: g.name,
      icon: g.icon,
      subcategories: (g.subcategories || []).join(', '),
      visible: g.visible,
    });
  };

  const startNew = () => {
    setEditing({});
    setForm({ name: '', icon: '📦', subcategories: '', visible: true });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { msg?.('El nombre es obligatorio'); return; }
    const subs = form.subcategories.split(',').map(s => s.trim()).filter(Boolean);
    try {
      const payload = {
        ...(editing?.id ? { id: editing.id } : {}),
        name: form.name.trim(),
        icon: form.icon.trim() || '📦',
        subcategories: subs,
        visible: form.visible,
        sort_order: editing?.sort_order ?? groups.length,
      };
      await upsertCategoryGroup(payload);
      msg?.('Categoría guardada ✓');
      setEditing(null);
      await load();
    } catch (err) {
      msg?.(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
      await deleteCategoryGroup(id);
      msg?.('Categoría eliminada');
      await load();
    } catch (err) {
      msg?.(`Error: ${err.message}`);
    }
  };

  const moveUp = async (idx) => {
    if (idx === 0) return;
    const newGroups = [...groups];
    [newGroups[idx - 1], newGroups[idx]] = [newGroups[idx], newGroups[idx - 1]];
    setGroups(newGroups);
    await reorderCategoryGroups(newGroups.map(g => g.id));
  };

  const moveDown = async (idx) => {
    if (idx >= groups.length - 1) return;
    const newGroups = [...groups];
    [newGroups[idx], newGroups[idx + 1]] = [newGroups[idx + 1], newGroups[idx]];
    setGroups(newGroups);
    await reorderCategoryGroups(newGroups.map(g => g.id));
  };

  return (
    <div className="ov">
      <div className="op">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="st" style={{ marginBottom: 0 }}>📂 Categorías</div>
          <button className="hb" onClick={onClose}>{Icon.x({ size: 20 })}</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>Cargando...</div>
        ) : editing !== null ? (
          /* ── Edit form ── */
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              {editing.id ? 'Editar categoría' : 'Nueva categoría'}
            </div>

            <label style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Nombre</label>
            <input
              className="cki" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: La Mesa Principal"
              style={{ width: '100%', marginBottom: 10 }}
            />

            <label style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Icono (emoji)</label>
            <input
              className="cki" value={form.icon}
              onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              placeholder="🍕"
              style={{ width: 80, marginBottom: 10 }}
            />

            <label style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Subcategorías (separadas por coma)</label>
            <input
              className="cki" value={form.subcategories}
              onChange={e => setForm(f => ({ ...f, subcategories: e.target.value }))}
              placeholder="Rotisería, Pizzas"
              style={{ width: '100%', marginBottom: 10 }}
            />

            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <input
                type="checkbox" checked={form.visible}
                onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))}
              />
              Visible en el catálogo
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn bp" onClick={handleSave} style={{ flex: 1 }}>Guardar</button>
              <button className="btn" onClick={() => setEditing(null)} style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        ) : (
          /* ── List ── */
          <div>
            {groups.map((g, i) => (
              <div key={g.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: g.visible ? 'var(--b2)' : 'var(--b3,#eee)',
                marginBottom: 6, opacity: g.visible ? 1 : 0.6,
              }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{g.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                    {(g.subcategories || []).join(', ') || 'Sin subcategorías'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="hb" onClick={() => moveUp(i)} disabled={i === 0} title="Subir">▲</button>
                  <button className="hb" onClick={() => moveDown(i)} disabled={i === groups.length - 1} title="Bajar">▼</button>
                  <button className="hb" onClick={() => startEdit(g)} title="Editar">{Icon.edit({ size: 14 })}</button>
                  <button className="hb" onClick={() => handleDelete(g.id)} title="Eliminar">{Icon.trash({ size: 14 })}</button>
                </div>
              </div>
            ))}

            <button
              className="btn bp"
              onClick={startNew}
              style={{ width: '100%', marginTop: 12, padding: '12px 0', fontSize: 14 }}
            >
              + Nueva categoría
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
