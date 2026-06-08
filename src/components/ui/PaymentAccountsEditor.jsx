// src/components/ui/PaymentAccountsEditor.jsx
// CRUD de CUENTAS de pago (settings.payment_accounts).
// A diferencia de PaymentMethodsEditor (que togglea KEYS para Gastos/Compras),
// esto guarda los DATOS de cada cuenta (titular, alias, CBU/CVU, banco) que se
// muestran en el checkout y quedan en snapshot en cada pedido.
//
// Efectivo es IMPLICITO: siempre disponible, no se carga aca.
// El resto (transferencia, MP, tarjeta, otro) el dueno lo crea para que exista
// como opcion en el catalogo. Se permiten varias cuentas del mismo tipo.
import { useConfirm } from "../ConfirmSlideProvider";
import { useState } from "react";
import { updateSettings } from "../../services/settings";

const TYPES = [
  { key: "transferencia", label: "Transferencia", icon: "🏦" },
  { key: "mercadopago",   label: "MercadoPago",   icon: "💳" },
  { key: "tarjeta",       label: "Tarjeta (POS al recibir)", icon: "💳" },
  { key: "otro",          label: "Otro",          icon: "🏷️" },
];
const typeMeta = (k) => TYPES.find(t => t.key === k) || { label: k, icon: "🏷️" };
const needsAccountData = (t) => t === "transferencia" || t === "mercadopago" || t === "otro";

function emptyAccount() {
  return {
    id: "", type: "transferencia", label: "",
    titular: "", alias: "", cbu: "", banco: "", instrucciones: "",
    active: true, show_in_catalog: true, sort: 0,
  };
}

export default function PaymentAccountsEditor({ settings, setSettings, showToast }) {
  const confirmSlide = useConfirm();
  const accounts = Array.isArray(settings?.payment_accounts) ? settings.payment_accounts : [];
  const [editing, setEditing] = useState(null); // null | objeto cuenta
  const [saving, setSaving] = useState(false);

  const persist = async (next) => {
    setSaving(true);
    const saved = await updateSettings({ ...settings, payment_accounts: next });
    setSaving(false);
    if (saved) {
      setSettings(saved);
      showToast?.("Cuentas de pago actualizadas ✓");
      return true;
    }
    showToast?.("Error al guardar");
    return false;
  };

  const setField = (k, v) => setEditing(p => ({ ...p, [k]: v }));

  const save = async () => {
    const e = editing;
    if (!e.label.trim()) { showToast?.("Poné un nombre para la cuenta"); return; }
    if (needsAccountData(e.type) && !e.alias.trim() && !e.cbu.trim()) {
      showToast?.("Cargá alias o CBU/CVU"); return;
    }
    const acc = {
      ...e,
      label: e.label.trim(),
      titular: e.titular.trim(),
      alias: e.alias.trim(),
      cbu: e.cbu.trim(),
      banco: e.banco.trim(),
      instrucciones: e.instrucciones.trim(),
    };
    let next;
    if (e.id) {
      next = accounts.map(a => (a.id === e.id ? acc : a));
    } else {
      acc.id = `${e.type}_${Date.now().toString(36)}`;
      acc.sort = accounts.length;
      next = [...accounts, acc];
    }
    if (await persist(next)) setEditing(null);
  };

  const remove = async (acc) => {
    const ok = await confirmSlide({
      title: `Eliminar "${acc.label}"`,
      body: "Deja de aparecer en el checkout. Los pedidos viejos conservan la copia de la cuenta.",
      label: "Deslizá para eliminar",
    });
    if (!ok) return;
    persist(accounts.filter(a => a.id !== acc.id));
  };

  const toggleActive = (acc) =>
    persist(accounts.map(a => (a.id === acc.id ? { ...a, active: !a.active } : a)));

  // ─── Form de alta/edicion ───
  if (editing) {
    const e = editing;
    const showData = needsAccountData(e.type);
    return (
      <div>
        <label className="ag-field-lbl">Tipo</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
          {TYPES.map(t => {
            const on = e.type === t.key;
            return (
              <button
                key={t.key} type="button"
                onClick={() => setField("type", t.key)}
                disabled={saving}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10,
                  border: on ? "2px solid var(--ag-c-terra)" : "1px solid var(--ag-line)",
                  background: on ? "rgba(196,93,62,0.08)" : "var(--ag-bg)",
                  color: on ? "var(--ag-c-terra)" : "var(--ag-ink-2)",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  cursor: saving ? "wait" : "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                {on && <span>✓</span>}
              </button>
            );
          })}
        </div>

        <label className="ag-field-lbl">Nombre visible *</label>
        <input className="ag-field-input" value={e.label}
          onChange={ev => setField("label", ev.target.value.slice(0, 60))}
          placeholder={e.type === "transferencia" ? "Ej: Galicia" : e.type === "mercadopago" ? "Ej: Mercado Pago" : "Ej: Tarjeta en el local"}
          disabled={saving} style={{ marginBottom: 12, width: "100%" }} />

        {showData && (
          <>
            <label className="ag-field-lbl">Titular</label>
            <input className="ag-field-input" value={e.titular}
              onChange={ev => setField("titular", ev.target.value.slice(0, 120))}
              placeholder="Nombre del titular de la cuenta"
              disabled={saving} style={{ marginBottom: 12, width: "100%" }} />

            <label className="ag-field-lbl">Alias</label>
            <input className="ag-field-input" value={e.alias}
              onChange={ev => setField("alias", ev.target.value.slice(0, 120))}
              placeholder="Ej: mi.alias.mp"
              disabled={saving} style={{ marginBottom: 12, width: "100%" }} />

            <label className="ag-field-lbl">CBU / CVU</label>
            <input className="ag-field-input" value={e.cbu} inputMode="numeric"
              onChange={ev => setField("cbu", ev.target.value.replace(/\D/g, "").slice(0, 22))}
              placeholder="22 dígitos"
              disabled={saving} style={{ marginBottom: 12, width: "100%" }} />

            <label className="ag-field-lbl">Banco / billetera</label>
            <input className="ag-field-input" value={e.banco}
              onChange={ev => setField("banco", ev.target.value.slice(0, 80))}
              placeholder="Ej: Banco Galicia, Mercado Pago, Ualá"
              disabled={saving} style={{ marginBottom: 12, width: "100%" }} />
          </>
        )}

        <label className="ag-field-lbl">Instrucciones para el cliente</label>
        <textarea className="ag-field-input" value={e.instrucciones}
          onChange={ev => setField("instrucciones", ev.target.value.slice(0, 500))}
          placeholder="Ej: Poné tu nombre en el concepto y mandanos el comprobante."
          disabled={saving} rows={2} style={{ marginBottom: 12, width: "100%", resize: "vertical", fontFamily: "inherit" }} />

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, cursor: "pointer" }}>
          <input type="checkbox" checked={e.show_in_catalog}
            onChange={ev => setField("show_in_catalog", ev.target.checked)} disabled={saving} />
          <span style={{ fontSize: 13, color: "var(--ag-ink-2)" }}>Mostrar en el catálogo público</span>
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="ag-btn-primary" onClick={save} disabled={saving} style={{ flex: 1 }}>
            {saving ? "Guardando..." : (e.id ? "Guardar cambios" : "Crear cuenta")}
          </button>
          <button type="button" onClick={() => setEditing(null)} disabled={saving}
            style={{ padding: "0 16px", borderRadius: 10, border: "1px solid var(--ag-line)", background: "var(--ag-bg)", color: "var(--ag-ink-2)", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ─── Lista ───
  return (
    <div>
      <div className="ag-card" style={{ padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, background: "var(--ag-bg-soft)" }}>
        <span style={{ fontSize: 18 }}>💵</span>
        <div style={{ fontSize: 12.5, color: "var(--ag-ink-2)", lineHeight: 1.45 }}>
          <strong>Efectivo</strong> siempre está disponible, no hace falta cargarlo. Creá acá las demás cuentas (transferencia, MP, etc.) para que aparezcan en el checkout.
        </div>
      </div>

      {accounts.length > 0 ? (
        <div className="ag-card" style={{ padding: 4, marginBottom: 14 }}>
          {accounts.map((acc, i) => {
            const meta = typeMeta(acc.type);
            const detail = acc.alias || (acc.cbu ? `CBU ···${acc.cbu.slice(-4)}` : "");
            return (
              <div key={acc.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderTop: i === 0 ? "none" : "1px solid var(--ag-line)",
                opacity: acc.active ? 1 : 0.5,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--ag-bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {acc.label} <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ag-ink-3)" }}>· {meta.label}</span>
                  </div>
                  {detail && <div style={{ fontSize: 11.5, color: "var(--ag-ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</div>}
                </div>
                <button type="button" onClick={() => toggleActive(acc)} disabled={saving}
                  title={acc.active ? "Activa" : "Inactiva"}
                  style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, border: "1px solid var(--ag-line)", background: acc.active ? "rgba(42,157,110,0.12)" : "var(--ag-bg)", color: acc.active ? "var(--ag-c-ok, #2A9D6E)" : "var(--ag-ink-3)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  {acc.active ? "Activa" : "Off"}
                </button>
                <button type="button" onClick={() => setEditing({ ...acc })} disabled={saving}
                  aria-label="Editar" style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: 8, background: "var(--ag-bg-soft)", color: "var(--ag-ink-2)", cursor: "pointer", flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
                <button type="button" onClick={() => remove(acc)} disabled={saving}
                  aria-label="Eliminar" style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: 8, background: "rgba(232,90,74,0.10)", color: "var(--ag-c-orders)", cursor: "pointer", flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ag-card" style={{ padding: 18, textAlign: "center", color: "var(--ag-ink-3)", fontSize: 12, marginBottom: 14 }}>
          Sin cuentas cargadas. Solo se ofrece efectivo. Agregá una abajo.
        </div>
      )}

      <button type="button" className="ag-btn-primary" onClick={() => setEditing(emptyAccount())} disabled={saving} style={{ width: "100%" }}>
        + Agregar cuenta de pago
      </button>
    </div>
  );
}
