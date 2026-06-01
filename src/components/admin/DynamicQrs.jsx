/**
 * DynamicQrs.jsx — Editor de QRs dinámicos (short URLs editables).
 *
 * Cada QR tiene un slug fijo (lo que va impreso en la tarjeta) y un
 * target_url editable. Si el admin cambia target_url, los QR ya impresos
 * siguen funcionando — solo cambia a dónde redirigen.
 *
 * Operaciones:
 *   - Crear (genera slug random por default, editable)
 *   - Editar nombre / target_url / descripción
 *   - Activar / desactivar (los inactivos muestran 404 al escanear)
 *   - Eliminar (con slide-confirm — destructivo, los QR impresos quedan rotos)
 *   - Descargar PNG (para imprimir)
 *   - Copiar URL pública al clipboard
 *
 * Entry point: botón "QRs dinámicos" en BrandModal (sección Personalización).
 */
import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useConfirm } from "../ConfirmSlideProvider";
import {
  fetchAllQrs, upsertQr, deleteQr, generateRandomSlug,
} from "../../services/qrs";

export default function DynamicQrs({ onClose, showToast }) {
  const confirmSlide = useConfirm();
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | qr object

  const load = async () => {
    setLoading(true);
    const data = await fetchAllQrs();
    setQrs(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onSave = async (qr) => {
    const saved = await upsertQr(qr);
    if (saved?.__error === "duplicate") {
      showToast?.("⚠ Ese slug ya está en uso");
      return false;
    }
    if (saved?.__error === "validation") {
      showToast?.("⚠ " + (saved.message || "Datos inválidos"));
      return false;
    }
    if (!saved) {
      showToast?.("Error al guardar");
      return false;
    }
    showToast?.(qr.id ? "Actualizado ✓" : "Creado ✓");
    setEditing(null);
    await load();
    return true;
  };

  const onDelete = async (qr) => {
    const ok = await confirmSlide({
      title: `Eliminar "${qr.name}"`,
      body: `El QR físico con slug "${qr.slug}" va a quedar roto. Si ya lo imprimiste, mejor desactivalo en vez de eliminarlo.`,
      label: "Deslizá para eliminar",
    });
    if (!ok) return;
    const success = await deleteQr(qr.id);
    if (success) { showToast?.("Eliminado ✓"); await load(); }
    else showToast?.("Error al eliminar");
  };

  return (
    <div className="ag-page-over">
      <div className="ag-page-over-head">
        <button type="button" className="ag-subpage-back" onClick={onClose} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Atrás</span>
        </button>
        <h2 className="ag-page-over-title">QRs dinámicos</h2>
      </div>

      <div className="ag-page-over-body">
        <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "var(--ag-ink-3)", lineHeight: 1.5 }}>
          Creá un QR con un slug fijo que vas a imprimir. Cuando quieras, cambiás a dónde redirige sin tener que reimprimir nada.
        </p>

        <button type="button" onClick={() => setEditing("new")}
          className="ag-btn-primary"
          style={{ width: "100%", padding: "12px", fontSize: 14, marginBottom: 18 }}>
          + Crear nuevo QR
        </button>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ag-ink-3)", fontSize: 13 }}>Cargando…</div>
        ) : qrs.length === 0 ? (
          <div className="ag-card" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔗</div>
            <div style={{ fontSize: 13, color: "var(--ag-ink-2)", fontWeight: 600, marginBottom: 4 }}>Sin QRs todavía</div>
            <div style={{ fontSize: 12, color: "var(--ag-ink-3)" }}>Creá tu primer QR dinámico arriba.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {qrs.map(qr => (
              <QrRow key={qr.id} qr={qr} onEdit={() => setEditing(qr)} onDelete={() => onDelete(qr)} showToast={showToast} />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <QrForm
          data={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={onSave}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function QrRow({ qr, onEdit, onDelete, showToast }) {
  const publicUrl = `${window.location.origin}/q/${qr.slug}`;
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, publicUrl, { width: 64, margin: 1 }, () => {});
  }, [publicUrl]);

  const onCopy = () => {
    navigator.clipboard?.writeText(publicUrl);
    showToast?.("URL copiada");
  };

  const onDownload = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(publicUrl, { width: 800, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-${qr.slug}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      showToast?.("Error al generar PNG");
    }
  };

  return (
    <div className="ag-card" style={{
      padding: "12px 14px", display: "flex", gap: 12, alignItems: "center",
      opacity: qr.is_active ? 1 : 0.55,
    }}>
      <canvas ref={canvasRef} style={{ width: 64, height: 64, borderRadius: 6, background: "#fff", flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ag-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{qr.name}</span>
          {!qr.is_active && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: "var(--ag-c-orders-soft)", color: "var(--ag-c-orders)", fontWeight: 700 }}>Inactivo</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ag-ink-3)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          /q/{qr.slug}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ag-ink-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={qr.target_url}>
          → {qr.target_url}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--ag-ink-3)", marginTop: 4 }}>
          {qr.visits || 0} {qr.visits === 1 ? "visita" : "visitas"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <button type="button" onClick={onCopy} className="ag-btn-ghost" style={{ padding: "5px 8px", fontSize: 11 }}>Copiar</button>
        <button type="button" onClick={onDownload} className="ag-btn-ghost" style={{ padding: "5px 8px", fontSize: 11 }}>PNG</button>
        <button type="button" onClick={onEdit} className="ag-btn-ghost" style={{ padding: "5px 8px", fontSize: 11 }}>Editar</button>
        <button type="button" onClick={onDelete} style={{ padding: "5px 8px", fontSize: 11, background: "transparent", border: "1px solid var(--ag-c-orders)", color: "var(--ag-c-orders)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>×</button>
      </div>
    </div>
  );
}

function QrForm({ data, onClose, onSave }) {
  const [f, setF] = useState(data || {
    name: "", slug: generateRandomSlug(), target_url: "", description: "", is_active: true,
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const isExisting = !!f.id;

  const canSave = f.name.trim().length >= 2 && f.slug.trim().length >= 3 && /^[a-zA-Z0-9_-]+$/.test(f.slug) && /^https?:\/\/.+/.test(f.target_url);

  return (
    <div className="ag-page-over" style={{ zIndex: 1100 }}>
      <div className="ag-page-over-head">
        <button type="button" className="ag-subpage-back" onClick={onClose} aria-label="Cancelar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Atrás</span>
        </button>
        <h2 className="ag-page-over-title">{isExisting ? "Editar QR" : "Nuevo QR"}</h2>
      </div>

      <div className="ag-page-over-body">
        <label className="ag-field-lbl">Nombre identificativo *</label>
        <input className="ag-field-input" value={f.name} onChange={e => set("name", e.target.value.slice(0, 120))} placeholder="Ej: Sticker mesa, Tarjeta promo verano" style={{ marginBottom: 14 }} />

        <label className="ag-field-lbl">Slug (lo que va impreso en el QR) *</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "var(--ag-ink-3)", fontFamily: "monospace" }}>/q/</span>
          <input
            className="ag-field-input"
            value={f.slug}
            onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50))}
            placeholder="ej: menu, mesa-5, promo2026"
            style={{ flex: 1, fontFamily: "monospace" }}
            disabled={isExisting}
          />
          {!isExisting && (
            <button type="button" onClick={() => set("slug", generateRandomSlug())}
              className="ag-btn-ghost" style={{ padding: "8px 10px", fontSize: 12 }}>🎲</button>
          )}
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 11, color: "var(--ag-ink-3)", lineHeight: 1.5 }}>
          {isExisting
            ? "El slug no se puede cambiar después de imprimir el QR."
            : "Solo letras, números, guión y guión bajo. Una vez creado no podés cambiarlo (los QR físicos ya impresos romperían)."}
        </p>

        <label className="ag-field-lbl">A dónde redirige (URL) *</label>
        <input className="ag-field-input" value={f.target_url} onChange={e => set("target_url", e.target.value.slice(0, 2000))} placeholder="https://..." style={{ marginBottom: 14 }} />

        <label className="ag-field-lbl">Notas (opcional)</label>
        <textarea className="ag-field-input" value={f.description || ""} onChange={e => set("description", e.target.value.slice(0, 500))} rows={2}
          style={{ resize: "vertical", marginBottom: 14, fontFamily: "inherit" }}
          placeholder="Para qué lo estás usando, dónde lo pusiste, etc." />

        <div className="ag-card" style={{ padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink)" }}>QR activo</div>
            <div style={{ fontSize: 11, color: "var(--ag-ink-3)", marginTop: 2 }}>Si lo apagás, el QR físico muestra 404.</div>
          </div>
          <button type="button" onClick={() => set("is_active", !f.is_active)} aria-pressed={f.is_active}
            style={{
              width: 44, height: 26, borderRadius: 999,
              background: f.is_active ? "var(--ag-c-terra)" : "var(--ag-bg-soft)",
              border: "1px solid " + (f.is_active ? "var(--ag-c-terra)" : "var(--ag-line)"),
              cursor: "pointer", position: "relative", padding: 0, transition: "background 0.15s",
            }}>
            <span style={{
              display: "block", width: 20, height: 20, borderRadius: 999, background: "#fff",
              position: "absolute", top: 2, left: f.is_active ? 21 : 2,
              transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </button>
        </div>

        <button type="button" className="ag-btn-primary" disabled={!canSave}
          onClick={() => canSave && onSave(f)}
          style={{ width: "100%", padding: "14px", fontSize: 15, opacity: canSave ? 1 : 0.5 }}>
          ✓ {isExisting ? "Guardar cambios" : "Crear QR"}
        </button>

        {!canSave && (
          <div style={{ fontSize: 11.5, color: "var(--ag-ink-3)", margin: "8px 0 0", textAlign: "center" }}>
            {!f.name.trim() ? "Ingresá un nombre" :
             !f.slug.trim() ? "Ingresá un slug" :
             !/^[a-zA-Z0-9_-]+$/.test(f.slug) ? "Slug solo letras/números/guión" :
             !/^https?:\/\/.+/.test(f.target_url) ? "URL debe empezar con http:// o https://" : ""}
          </div>
        )}

        <button type="button" className="ag-btn-ghost" onClick={onClose}
          style={{ marginTop: 10, width: "100%", padding: "12px", fontSize: 13 }}>← Volver</button>
      </div>
    </div>
  );
}
