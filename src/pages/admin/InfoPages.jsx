// src/pages/admin/InfoPages.jsx
// Gestion de paginas informativas (12/jun 2026).
//
// Antes: CRUD con textarea de JSON crudo (solo apto desarrolladores).
// Ahora: editor de BLOQUES amigable — el operador arma la pagina con
// "Encabezado", "Seccion" y "Nota legal" llenando campos simples.
// El resultado se guarda en el mismo formato blocks[] que ya renderiza
// InfoPage.jsx (hero / rule / footer_legal) — cero migracion.
//
// Se usa de dos formas:
//   · Tab del admin (menu hamburguesa → Paginas informativas): embedded
//   · Ruta /admin/paginas (compat con links viejos): standalone
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// ── Helpers ──────────────────────────────────────────────
function slugify(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // saca tildes
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

const BLOCK_LABELS = {
  hero: "Encabezado",
  rule: "Sección",
  footer_legal: "Nota legal (al pie)",
};

function emptyBlock(type) {
  if (type === "hero") return { type, emoji: "", title: "", body: "" };
  if (type === "rule") return { type, emoji: "", tag: "", title: "", body: "", items: [], callout: "" };
  return { type, body: "" }; // footer_legal
}

// Limpia campos vacios antes de guardar (el render ya tolera ausentes,
// pero asi el JSON en DB queda prolijo)
function cleanBlock(b) {
  const out = { type: b.type };
  for (const k of ["emoji", "tag", "title", "body", "callout"]) {
    if (b[k] && String(b[k]).trim()) out[k] = String(b[k]).trim();
  }
  if (Array.isArray(b.items)) {
    const items = b.items
      .map(it => ({ title: (it.title || "").trim(), body: (it.body || "").trim() }))
      .filter(it => it.title || it.body);
    if (items.length > 0) out.items = items;
  }
  return out;
}

// ── Campos compartidos del editor ────────────────────────
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label className="ag-field-lbl">{label}</label>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, maxLength, width }) {
  return (
    <input
      className="ag-field-input"
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={width ? { width } : undefined}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      className="ag-field-input"
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ resize: "vertical", lineHeight: 1.5 }}
    />
  );
}

// ── Editor de UN bloque ──────────────────────────────────
function BlockEditor({ block, index, total, onChange, onMove, onRemove }) {
  const set = (k, v) => onChange({ ...block, [k]: v });
  const setItem = (i, k, v) => {
    const items = (block.items || []).map((it, j) => j === i ? { ...it, [k]: v } : it);
    onChange({ ...block, items });
  };

  return (
    <div style={{
      border: "1px solid var(--ag-line)", borderRadius: 14,
      background: "var(--ag-bg-card)", padding: "12px 14px", marginBottom: 10,
    }}>
      {/* Cabecera del bloque: tipo + mover + borrar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
          padding: "3px 8px", borderRadius: 6,
          background: "rgba(245, 158, 11, 0.14)", color: "var(--ag-c-terra)",
        }}>{BLOCK_LABELS[block.type] || block.type}</span>
        <div style={{ flex: 1 }} />
        <button type="button" className="ag-btn-ghost" disabled={index === 0}
          onClick={() => onMove(-1)} aria-label="Subir bloque"
          style={{ padding: "4px 9px", opacity: index === 0 ? 0.35 : 1 }}>↑</button>
        <button type="button" className="ag-btn-ghost" disabled={index === total - 1}
          onClick={() => onMove(1)} aria-label="Bajar bloque"
          style={{ padding: "4px 9px", opacity: index === total - 1 ? 0.35 : 1 }}>↓</button>
        <button type="button" className="ag-btn-ghost" onClick={onRemove} aria-label="Quitar bloque"
          style={{ padding: "4px 9px", color: "var(--ag-c-orders)" }}>✕</button>
      </div>

      {block.type === "footer_legal" ? (
        <Field label="Texto legal" hint="Letra chica centrada al final de la página.">
          <TextArea value={block.body} onChange={v => set("body", v)} rows={2}
            placeholder="Ej: Producto para mayores de 18 años. Consumir con responsabilidad." />
        </Field>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10 }}>
            <Field label="Emoji">
              <TextInput value={block.emoji} onChange={v => set("emoji", v)} placeholder="🍪" maxLength={4} />
            </Field>
            <Field label="Título">
              <TextInput value={block.title} onChange={v => set("title", v)} maxLength={120}
                placeholder={block.type === "hero" ? "Ej: Bienvenido a Crazy Cookie" : "Ej: ¿Cómo se consume?"} />
            </Field>
          </div>
          {block.type === "rule" && (
            <Field label="Etiqueta (opcional)" hint="Pildorita arriba del título. Ej: PASO 1, IMPORTANTE.">
              <TextInput value={block.tag} onChange={v => set("tag", v)} placeholder="PASO 1" maxLength={24} width={160} />
            </Field>
          )}
          <Field label="Texto">
            <TextArea value={block.body} onChange={v => set("body", v)}
              placeholder="Contá en lenguaje simple lo que el cliente tiene que saber." />
          </Field>

          {block.type === "rule" && (
            <>
              {/* Lista de puntos (items) */}
              <label className="ag-field-lbl">Lista de puntos (opcional)</label>
              {(block.items || []).map((it, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr auto", gap: 8,
                  padding: "8px 10px", border: "1px dashed var(--ag-line)", borderRadius: 10, marginBottom: 6,
                }}>
                  <div>
                    <TextInput value={it.title} onChange={v => setItem(i, "title", v)} placeholder="Título del punto" maxLength={80} />
                    <div style={{ height: 6 }} />
                    <TextInput value={it.body} onChange={v => setItem(i, "body", v)} placeholder="Detalle del punto" maxLength={200} />
                  </div>
                  <button type="button" className="ag-btn-ghost" aria-label="Quitar punto"
                    onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                    style={{ color: "var(--ag-c-orders)", alignSelf: "start", padding: "4px 9px" }}>✕</button>
                </div>
              ))}
              <button type="button" className="ag-btn-ghost" style={{ marginBottom: 10 }}
                onClick={() => onChange({ ...block, items: [...(block.items || []), { title: "", body: "" }] })}>
                + Agregar punto
              </button>

              <Field label="Nota destacada (opcional)" hint="Recuadro amarillo de advertencia/consejo.">
                <TextInput value={block.callout} onChange={v => set("callout", v)} maxLength={200}
                  placeholder="Ej: Esperá 60-90 min el efecto antes de repetir." />
              </Field>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Pantalla principal ───────────────────────────────────
export default function InfoPagesAdmin({ embedded = false, onBack }) {
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | id
  const [draft, setDraft] = useState(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const goBack = onBack || (() => navigate("/admin"));

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("info_pages").select("*").order("created_at", { ascending: false });
    setPages(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing("new");
    setSlugTouched(false);
    setError("");
    setDraft({ slug: "", title: "", blocks: [emptyBlock("hero")], requires_age_gate: false, visible: true });
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setSlugTouched(true);
    setError("");
    setDraft({
      slug: p.slug,
      title: p.title,
      blocks: (p.blocks || []).map(b => ({ items: [], ...b })),
      requires_age_gate: p.requires_age_gate,
      visible: p.visible,
    });
  };

  const save = async () => {
    const slug = slugify(draft.slug);
    if (!draft.title.trim()) { setError("Poné un título."); return; }
    if (!slug) { setError("Poné una dirección (slug) válida."); return; }
    const blocks = draft.blocks.map(cleanBlock).filter(b =>
      b.title || b.body || (b.items && b.items.length > 0)
    );
    setSaving(true);
    setError("");
    const payload = {
      slug,
      title: draft.title.trim(),
      blocks,
      requires_age_gate: draft.requires_age_gate,
      visible: draft.visible,
      updated_at: new Date().toISOString(),
    };
    const res = editing === "new"
      ? await supabase.from("info_pages").insert(payload)
      : await supabase.from("info_pages").update(payload).eq("id", editing);
    setSaving(false);
    if (res.error) {
      setError(res.error.code === "23505" ? "Ya existe una página con esa dirección." : "Error al guardar.");
      return;
    }
    setEditing(null);
    setDraft(null);
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`¿Borrar "${p.title}"? Los QRs que apunten a /info/${p.slug} van a quedar rotos.`)) return;
    await supabase.from("info_pages").delete().eq("id", p.id);
    load();
  };

  const setD = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const moveBlock = (i, dir) => {
    setDraft(d => {
      const blocks = [...d.blocks];
      const j = i + dir;
      if (j < 0 || j >= blocks.length) return d;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...d, blocks };
    });
  };

  const body = (
    <div style={{ padding: "12px 16px 28px", maxWidth: 640, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* Head */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0 14px" }}>
        <button type="button" onClick={goBack} aria-label="Volver" style={{
          width: 34, height: 34, borderRadius: 10, border: "1px solid var(--ag-line)",
          background: "var(--ag-bg-card)", color: "var(--ag-ink)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 22, margin: 0, color: "var(--ag-ink)", letterSpacing: "-0.01em" }}>
            Páginas informativas
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--ag-ink-3)" }}>
            Contenido al que pueden apuntar tus QRs y links · /info/...
          </p>
        </div>
        <button type="button" className="ag-cta" onClick={openNew} style={{ padding: "8px 14px", fontSize: 12, flexShrink: 0 }}>
          + Nueva
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--ag-ink-3)" }}>Cargando...</div>
      ) : pages.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--ag-ink-3)", border: "1px dashed var(--ag-line)", borderRadius: 14 }}>
          No hay páginas todavía. Creá la primera con "+ Nueva".
        </div>
      ) : pages.map(p => (
        <div key={p.id} style={{
          display: "flex", gap: 12, alignItems: "center", padding: "13px 14px", marginBottom: 8,
          background: "var(--ag-bg-card)", border: "1px solid var(--ag-line)", borderRadius: 14,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14, color: "var(--ag-ink)" }}>{p.title}</strong>
              {!p.visible && <span style={{ fontSize: 10, padding: "2px 7px", background: "var(--ag-bg-soft)", color: "var(--ag-ink-3)", borderRadius: 999, fontWeight: 700 }}>oculta</span>}
              {p.requires_age_gate && <span style={{ fontSize: 10, padding: "2px 7px", background: "rgba(245,158,11,0.14)", color: "var(--ag-c-terra)", borderRadius: 999, fontWeight: 800 }}>+18</span>}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ag-ink-3)", fontFamily: "monospace" }}>/info/{p.slug}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <a href={`/info/${p.slug}`} target="_blank" rel="noreferrer" className="ag-btn-ghost"
              style={{ textDecoration: "none", padding: "7px 11px", fontSize: 12.5 }}>Ver</a>
            <button type="button" className="ag-btn-ghost" onClick={() => openEdit(p)} style={{ padding: "7px 11px", fontSize: 12.5 }}>Editar</button>
            <button type="button" className="ag-btn-ghost" onClick={() => remove(p)}
              style={{ padding: "7px 11px", fontSize: 12.5, color: "var(--ag-c-orders)" }}>Borrar</button>
          </div>
        </div>
      ))}

      {/* ── Editor (overlay a pantalla completa, sin JSON) ── */}
      {editing && draft && (
        <div className="ag-page-over">
          <div className="ag-page-over-head">
            <button type="button" className="ag-subpage-back" onClick={() => setEditing(null)} aria-label="Cerrar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Atrás</span>
            </button>
            <h2 className="ag-page-over-title">{editing === "new" ? "Nueva página" : "Editar página"}</h2>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 100px", maxWidth: 640, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
            <Field label="Título de la página">
              <TextInput
                value={draft.title}
                onChange={v => {
                  setD("title", v);
                  if (!slugTouched) setD("slug", slugify(v));
                }}
                placeholder="Ej: Cómo consumir Crazy Cookie"
                maxLength={120}
              />
            </Field>
            <Field label="Dirección (link)" hint={`Tu página va a vivir en /info/${slugify(draft.slug) || "..."} — es lo que apunta el QR.`}>
              <TextInput
                value={draft.slug}
                onChange={v => { setSlugTouched(true); setD("slug", slugify(v)); }}
                placeholder="crazy-cookie"
                maxLength={60}
              />
            </Field>

            <div style={{ display: "flex", gap: 18, margin: "4px 0 16px" }}>
              <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13, color: "var(--ag-ink)", cursor: "pointer" }}>
                <input type="checkbox" checked={draft.visible} onChange={e => setD("visible", e.target.checked)} />
                Visible
              </label>
              <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13, color: "var(--ag-ink)", cursor: "pointer" }}>
                <input type="checkbox" checked={draft.requires_age_gate} onChange={e => setD("requires_age_gate", e.target.checked)} />
                Pedir +18 para entrar
              </label>
            </div>

            <div className="ag-settings-group-title" style={{ marginBottom: 8 }}>Contenido</div>
            {draft.blocks.length === 0 && (
              <div style={{ padding: 16, textAlign: "center", color: "var(--ag-ink-3)", border: "1px dashed var(--ag-line)", borderRadius: 12, marginBottom: 10, fontSize: 12.5 }}>
                Agregá bloques con los botones de abajo.
              </div>
            )}
            {draft.blocks.map((b, i) => (
              <BlockEditor
                key={i}
                block={b}
                index={i}
                total={draft.blocks.length}
                onChange={nb => setD("blocks", draft.blocks.map((x, j) => j === i ? nb : x))}
                onMove={dir => moveBlock(i, dir)}
                onRemove={() => setD("blocks", draft.blocks.filter((_, j) => j !== i))}
              />
            ))}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <button type="button" className="ag-btn-ghost" onClick={() => setD("blocks", [...draft.blocks, emptyBlock("hero")])}>+ Encabezado</button>
              <button type="button" className="ag-btn-ghost" onClick={() => setD("blocks", [...draft.blocks, emptyBlock("rule")])}>+ Sección</button>
              <button type="button" className="ag-btn-ghost" onClick={() => setD("blocks", [...draft.blocks, emptyBlock("footer_legal")])}>+ Nota legal</button>
            </div>

            {error && <div style={{ color: "var(--ag-c-orders)", fontSize: 12.5, fontWeight: 700, marginTop: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button type="button" className="ag-btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="button" className="ag-btn-primary" onClick={save} disabled={saving} style={{ minWidth: 120 }}>
                {saving ? "Guardando..." : "Guardar página"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Standalone (ruta /admin/paginas): envolver con el tema del admin para
  // que los tokens ag-* existan fuera del ag-root de Admin.jsx
  if (!embedded) {
    let theme = "light";
    try { theme = localStorage.getItem("ag-theme") || "light"; } catch { /* default */ }
    return (
      <div className={`ag-root ${theme === "dark" ? "ag-theme-dark" : "ag-theme-light"}`} style={{ minHeight: "100vh", background: "var(--ag-bg)" }}>
        {body}
      </div>
    );
  }
  return body;
}
