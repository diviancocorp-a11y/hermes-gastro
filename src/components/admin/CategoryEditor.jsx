// src/components/admin/CategoryEditor.jsx
// Admin panel para gestionar grupos de categorías (crear, editar, reordenar, eliminar).
// Visual v2 — clases del sistema (.ag-*).
import { useConfirm } from "../ConfirmSlideProvider";
import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllCategoryGroups, upsertCategoryGroup,
  deleteCategoryGroup, reorderCategoryGroups,
} from '../../services/categories';
import { uploadCatImage } from '../../lib/adminService';

export default function CategoryEditor({ msg, onClose, embedded = false }) {
  const confirmSlide = useConfirm();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', image_url: '', subcategories: '', visible: true });
  const [uploadingImg, setUploadingImg] = useState(false);

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
      image_url: g.image_url || '',
      subcategories: (g.subcategories || []).join(', '),
      visible: g.visible,
    });
  };

  const startNew = () => {
    setEditing({});
    setForm({ name: '', image_url: '', subcategories: '', visible: true });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { msg?.('El nombre es obligatorio'); return; }
    const subs = form.subcategories.split(',').map(s => s.trim()).filter(Boolean);
    try {
      const payload = {
        ...(editing?.id ? { id: editing.id } : {}),
        name: form.name.trim(),
        image_url: form.image_url || '',
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

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingImg(true);
    const result = await uploadCatImage(file, form.name || 'category');
    setUploadingImg(false);
    if (result?.__error) { msg?.(result.__error); return; }
    if (result) {
      setForm(f => ({ ...f, image_url: result }));
      // Si ya estamos editando una categoria existente, persist automaticamente
      // para evitar el bug de "subi la imagen pero no le di guardar".
      if (editing?.id) {
        try {
          await upsertCategoryGroup({
            id: editing.id,
            name: form.name.trim(),
            image_url: result,
            subcategories: form.subcategories.split(',').map(s => s.trim()).filter(Boolean),
            visible: form.visible,
            sort_order: editing.sort_order ?? groups.length,
          });
          msg?.('Imagen guardada ✓');
          await load();
        } catch (e) {
          msg?.(`Imagen cargada pero NO guardada: ${e.message}`);
        }
      } else {
        msg?.('Imagen lista — apretá Guardar para confirmar la categoría');
      }
    } else {
      msg?.('Error al subir');
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirmSlide({ title: "Eliminar categoría", body: "Los productos en esta categoría no se borran, solo dejan de aparecer agrupados.", label: "Deslizá para eliminar" });
    if (!ok) return;
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
    const ng = [...groups];
    [ng[idx - 1], ng[idx]] = [ng[idx], ng[idx - 1]];
    setGroups(ng);
    await reorderCategoryGroups(ng.map(g => g.id));
  };
  const moveDown = async (idx) => {
    if (idx >= groups.length - 1) return;
    const ng = [...groups];
    [ng[idx], ng[idx + 1]] = [ng[idx + 1], ng[idx]];
    setGroups(ng);
    await reorderCategoryGroups(ng.map(g => g.id));
  };

  const content = (
    <>
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 18, margin: 0, color: 'var(--ag-ink)' }}>Categorías</h3>
          <button type="button" className="ag-modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 28, color: 'var(--ag-ink-3)', fontSize: 13 }}>Cargando...</div>
      ) : editing !== null ? (
        /* ── Formulario edit/new ── */
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ag-ink)', marginBottom: 14 }}>
            {editing.id ? 'Editar categoría' : 'Nueva categoría'}
          </div>

          <label className="ag-field-lbl">Nombre</label>
          <input
            className="ag-field-input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ej: Postres"
            style={{ marginBottom: 12 }}
          />

          <label className="ag-field-lbl">Imagen de la categoría</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 12,
              background: 'var(--ag-bg-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
              border: '1px solid var(--ag-line)',
            }}>
              {form.image_url
                ? <img src={form.image_url} alt="categoría" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                : <span style={{ fontSize: 11, color: 'var(--ag-ink-3)' }}>Sin img</span>}
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <label className="ag-btn-primary" style={{ flex: 1, minWidth: 0 }}>
                {uploadingImg ? 'Subiendo…' : '📷 Subir'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} disabled={uploadingImg} />
              </label>
              <label className="ag-btn-ghost" style={{ flex: 1, minWidth: 0 }}>
                📸 Cámara
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImageFile} disabled={uploadingImg} />
              </label>
              {form.image_url && (
                <button type="button" className="ag-btn-ghost" onClick={() => setForm(f => ({ ...f, image_url: '' }))} style={{ flex: 0 }}>Quitar</button>
              )}
            </div>
          </div>

          <label className="ag-field-lbl">Subcategorías (separadas por coma)</label>
          <input
            className="ag-field-input"
            value={form.subcategories}
            onChange={e => setForm(f => ({ ...f, subcategories: e.target.value }))}
            placeholder="Rotisería, Pizzas"
            style={{ marginBottom: 14 }}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 18, cursor: 'pointer', color: 'var(--ag-ink-2)' }}>
            <input
              type="checkbox"
              checked={form.visible}
              onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))}
              style={{ margin: 0, cursor: 'pointer' }}
            />
            Visible en el catálogo
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ag-btn-primary" onClick={handleSave} style={{ flex: 1 }}>Guardar</button>
            <button type="button" className="ag-btn-ghost" onClick={() => setEditing(null)} style={{ flex: 1 }}>Cancelar</button>
          </div>
        </div>
      ) : (
        /* ── Lista ── */
        <div>
          {groups.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--ag-ink-3)', fontSize: 13 }}>
              Sin categorías. Creá la primera.
            </div>
          )}

          {groups.map((g, i) => (
            <div
              key={g.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 12,
                background: 'var(--ag-bg-card)',
                boxShadow: 'var(--ag-sh-sm)',
                marginBottom: 8,
                opacity: g.visible ? 1 : 0.55,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'var(--ag-bg-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
                border: '1px solid var(--ag-line)',
              }}>
                {g.image_url
                  ? <img src={g.image_url} alt={g.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                  : <span style={{ fontSize: 10, color: 'var(--ag-ink-3)' }}>Sin img</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ag-ink)' }}>{g.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ag-ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(g.subcategories || []).join(', ') || 'Sin subcategorías'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <IconBtn onClick={() => moveUp(i)}   disabled={i === 0}                title="Subir"
                  svg={<polyline points="18 15 12 9 6 15" />} />
                <IconBtn onClick={() => moveDown(i)} disabled={i === groups.length - 1} title="Bajar"
                  svg={<polyline points="6 9 12 15 18 9" />} />
                <IconBtn onClick={() => startEdit(g)} title="Editar"
                  svg={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>} />
                <IconBtn danger onClick={() => handleDelete(g.id)} title="Eliminar"
                  svg={<><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>} />
              </div>
            </div>
          ))}

          <button
            type="button"
            className="ag-btn-primary"
            onClick={startNew}
            style={{ width: '100%', marginTop: 14, padding: '12px 0', fontSize: 14 }}
          >+ Nueva categoría</button>
        </div>
      )}
    </>
  );

  if (embedded) return <div style={{ padding: '4px 2px' }}>{content}</div>;
  return (
    <div className="ov">
      <div className="op">
        {content}
      </div>
    </div>
  );
}

/* Mini-botón cuadrado para acciones de lista (subir/bajar/editar/eliminar) */
function IconBtn({ onClick, title, disabled, svg, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 30, height: 30,
        borderRadius: 8, border: 0,
        background: 'var(--ag-bg-soft)',
        color: danger ? 'var(--ag-c-orders)' : 'var(--ag-ink-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 120ms',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {svg}
      </svg>
    </button>
  );
}
