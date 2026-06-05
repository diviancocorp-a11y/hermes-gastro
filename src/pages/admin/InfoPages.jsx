// src/pages/admin/InfoPages.jsx
// Admin CRUD basico para info_pages. Editor JSON crudo MVP.
// Acceso: /admin/paginas (proteger en App.jsx con auth admin).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function InfoPages() {
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ slug: "", title: "", blocksText: "[]", requires_age_gate: false, visible: true });
  const [jsonError, setJsonError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("info_pages").select("*").order("created_at", { ascending: false });
    setPages(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing("new");
    setDraft({ slug: "", title: "", blocksText: "[]", requires_age_gate: false, visible: true });
    setJsonError("");
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setDraft({
      slug: p.slug,
      title: p.title,
      blocksText: JSON.stringify(p.blocks || [], null, 2),
      requires_age_gate: p.requires_age_gate,
      visible: p.visible,
    });
    setJsonError("");
  };

  const save = async () => {
    let blocks;
    try {
      blocks = JSON.parse(draft.blocksText);
      if (!Array.isArray(blocks)) throw new Error("blocks debe ser array");
    } catch (e) {
      setJsonError(e.message);
      return;
    }
    setSaving(true);
    const payload = {
      slug: draft.slug.trim(),
      title: draft.title.trim(),
      blocks,
      requires_age_gate: draft.requires_age_gate,
      visible: draft.visible,
      updated_at: new Date().toISOString(),
    };
    if (editing === "new") {
      await supabase.from("info_pages").insert(payload);
    } else {
      await supabase.from("info_pages").update(payload).eq("id", editing);
    }
    setSaving(false);
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Borrar esta pagina?")) return;
    await supabase.from("info_pages").delete().eq("id", id);
    load();
  };

  if (loading) return <div style={{ padding: 32 }}>Cargando...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Paginas informativas</h2>
        <button onClick={() => navigate("/admin")} style={btnGhost}>Volver</button>
      </div>

      <button onClick={openNew} style={{ ...btnPrimary, marginBottom: 16 }}>+ Nueva pagina</button>

      {pages.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "#888", border: "1px dashed #ddd", borderRadius: 12 }}>
          No hay paginas todavia.
        </div>
      )}

      {pages.map(p => (
        <div key={p.id} style={card}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
              <strong style={{ fontSize: 15 }}>{p.title}</strong>
              {!p.visible && <span style={badgeOff}>oculta</span>}
              {p.requires_age_gate && <span style={badge18}>+18</span>}
            </div>
            <div style={{ fontSize: 12, color: "#777", fontFamily: "monospace" }}>/info/{p.slug}</div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>{(p.blocks || []).length} bloques</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => openEdit(p)} style={btnGhost}>Editar</button>
            <button onClick={() => remove(p.id)} style={btnDanger}>Borrar</button>
          </div>
        </div>
      ))}

      {editing && (
        <div style={overlay} onClick={() => setEditing(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px" }}>{editing === "new" ? "Nueva pagina" : "Editar"}</h3>
            <label style={lbl}>Slug (URL)</label>
            <input value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} placeholder="crazy-cookie" style={input} />
            <label style={lbl}>Titulo</label>
            <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} style={input} />
            <label style={lbl}>Bloques (JSON)</label>
            <textarea
              value={draft.blocksText}
              onChange={e => { setDraft({ ...draft, blocksText: e.target.value }); setJsonError(""); }}
              rows={12}
              style={{ ...input, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
            />
            {jsonError && <div style={{ color: "#C62828", fontSize: 12, marginTop: 4 }}>JSON invalido: {jsonError}</div>}
            <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={draft.requires_age_gate} onChange={e => setDraft({ ...draft, requires_age_gate: e.target.checked })} />
                Requiere +18
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={draft.visible} onChange={e => setDraft({ ...draft, visible: e.target.checked })} />
                Visible
              </label>
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditing(null)} style={btnGhost}>Cancelar</button>
              <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const card = { display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", marginBottom: 8, background: "#fafafa", border: "1px solid #eee", borderRadius: 12 };
const btnGhost = { padding: "8px 12px", fontSize: 13, background: "transparent", color: "#555", border: "1px solid #ccc", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" };
const btnPrimary = { padding: "8px 14px", fontSize: 13, fontWeight: 700, background: "#D97706", color: "#fff", border: 0, borderRadius: 8, cursor: "pointer", fontFamily: "inherit" };
const btnDanger = { padding: "8px 12px", fontSize: 13, background: "transparent", color: "#C62828", border: "1px solid #C62828", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" };
const badgeOff = { fontSize: 10, padding: "2px 6px", background: "#eee", color: "#666", borderRadius: 999 };
const badge18 = { fontSize: 10, padding: "2px 6px", background: "#FFF8E1", color: "#8D6E00", borderRadius: 999 };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 100 };
const modal = { background: "#fff", padding: 20, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" };
const lbl = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#666", marginTop: 12, marginBottom: 4 };
const input = { width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" };
