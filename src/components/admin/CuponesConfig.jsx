// src/components/admin/CuponesConfig.jsx
// Cupones del negocio desde el CRM: lista y alta/edicion (migracion 0144).
// Tipo porcentaje o monto fijo, minimo de compra, usos totales y por
// telefono, vigencia y email personal. Guarda guardarCupon (valida el Zod).
import { useState, useEffect } from "react";
import { listarCupones, guardarCupon, monedaDelNegocio } from "../../services/coupons";
import { formatearMonto } from "../../lib/moneda";
import { etiquetaCupon } from "../../lib/cupones";
import DecimalInput from "../ui/DecimalInput";
import "../../styles/admin-cupones.css";

const VACIO = {
  id: null, code: "", discount_type: "pct", discount_pct: 10, discount_amount: 0,
  min_subtotal: "", max_uses: "1", max_uses_per_phone: "", starts_at: "", expires_at: "", email: "",
};

// ISO -> valor de <input type="datetime-local"> en hora local
function aLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// datetime-local -> ISO con offset (toISOString da Z, que el Zod acepta)
function aISO(local) {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const entero = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

function estadoCupon(c, ahora = new Date()) {
  const usos = Number(c.uses_count ?? (c.used ? 1 : 0));
  if (c.expires_at && new Date(c.expires_at) < ahora) return ["vencido", "Vencido"];
  if (c.max_uses != null && usos >= c.max_uses) return ["agotado", "Agotado"];
  if (c.starts_at && new Date(c.starts_at) > ahora) return ["programado", "Programado"];
  return ["activo", "Activo"];
}

const fechaCorta = (iso) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

function vigenciaCorta(c) {
  if (c.starts_at && c.expires_at) return `${fechaCorta(c.starts_at)} – ${fechaCorta(c.expires_at)}`;
  if (c.expires_at) return `hasta ${fechaCorta(c.expires_at)}`;
  if (c.starts_at) return `desde ${fechaCorta(c.starts_at)}`;
  return "sin vencimiento";
}

export default function CuponesConfig({ showToast }) {
  const [abierto, setAbierto] = useState(false);
  const [cupones, setCupones] = useState(null); // null = cargando
  const [moneda, setMoneda] = useState("ARS");
  const [form, setForm] = useState(null); // null = sin formulario
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto || cupones !== null) return;
    listarCupones().then(setCupones).catch(() => { setCupones([]); setError("No pudimos cargar los cupones."); });
    monedaDelNegocio().then(setMoneda).catch(() => {});
  }, [abierto, cupones]);

  const texto = (n) => formatearMonto(n, moneda);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const nuevo = () => { setError(""); setForm({ ...VACIO }); };
  const editar = (c) => {
    setError("");
    setForm({
      id: c.id, code: c.code || "", discount_type: c.discount_type || "pct",
      discount_pct: Number(c.discount_pct || 0), discount_amount: Number(c.discount_amount || 0),
      min_subtotal: c.min_subtotal ?? "", max_uses: c.max_uses == null ? "" : String(c.max_uses),
      max_uses_per_phone: c.max_uses_per_phone == null ? "" : String(c.max_uses_per_phone),
      starts_at: aLocal(c.starts_at), expires_at: aLocal(c.expires_at), email: c.email || "",
    });
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError("");
    const minimo = Number(form.min_subtotal);
    const input = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_pct: form.discount_type === "pct" ? Math.round(Number(form.discount_pct) || 0) : 0,
      discount_amount: form.discount_type === "fixed" ? Number(form.discount_amount) || 0 : 0,
      min_subtotal: Number.isFinite(minimo) && minimo > 0 ? minimo : null,
      max_uses: entero(form.max_uses),
      max_uses_per_phone: entero(form.max_uses_per_phone),
      starts_at: aISO(form.starts_at),
      expires_at: aISO(form.expires_at),
      email: form.email.trim() || null,
    };
    if (form.id) input.id = form.id;
    let r;
    try {
      r = await guardarCupon(input);
    } catch {
      r = { ok: false, error: "No pudimos guardar el cupón. Probá de nuevo." };
    } finally {
      setGuardando(false);
    }
    if (!r.ok) { setError(r.error); return; }
    setCupones(lista => {
      const resto = (lista || []).filter(c => c.id !== r.cupon.id);
      return [r.cupon, ...resto];
    });
    setForm(null);
    showToast?.(form.id ? `Cupón ${r.cupon.code} actualizado` : `Cupón ${r.cupon.code} creado`);
  };

  const activos = (cupones || []).filter(c => estadoCupon(c)[0] === "activo").length;

  return (
    <section className="ag-card ag-cupones">
      <button type="button" className="ag-cupones-head" aria-expanded={abierto} onClick={() => setAbierto(o => !o)}>
        <span className="ag-cupones-icono" aria-hidden="true">%</span>
        <span className="ag-cupones-titulos">
          <span className="ag-cupones-titulo">Cupones</span>
          <span className="ag-cupones-sub">
            {cupones === null ? "Descuentos por código para el catálogo" : `${activos} activo${activos === 1 ? "" : "s"} de ${cupones.length}`}
          </span>
        </span>
        <span className="ag-cupones-flecha" aria-hidden="true">▼</span>
      </button>

      {abierto && (
        <div className="ag-cupones-cuerpo">
          {form ? (
            <form className="ag-cupones-form" onSubmit={guardar} noValidate>
              <p className="ag-cupones-form-titulo">{form.id ? "Editar cupón" : "Nuevo cupón"}</p>

              <label className="ag-cupones-campo">
                <span className="ag-field-lbl">Código</span>
                <input className="ag-field-input ag-cupones-codigo-input" value={form.code} maxLength={30}
                  autoCapitalize="characters" autoComplete="off" spellCheck={false}
                  onChange={e => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="VERANO10" />
              </label>

              <div className="ag-cupones-campo">
                <span className="ag-field-lbl" id="cupon-tipo">Tipo</span>
                <div className="ag-cupones-segmento" role="group" aria-labelledby="cupon-tipo">
                  <button type="button" aria-pressed={form.discount_type === "pct"} onClick={() => set("discount_type", "pct")}>Porcentaje</button>
                  <button type="button" aria-pressed={form.discount_type === "fixed"} onClick={() => set("discount_type", "fixed")}>Monto fijo</button>
                </div>
              </div>

              <label className="ag-cupones-campo">
                <span className="ag-field-lbl">{form.discount_type === "pct" ? "Descuento" : "Monto de descuento"}</span>
                <span className="ag-cupones-sufijo">
                  {form.discount_type === "pct" ? (
                    <input className="ag-field-input" inputMode="numeric" value={form.discount_pct} placeholder="10"
                      onChange={e => set("discount_pct", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                  ) : (
                    <DecimalInput className="ag-field-input" value={form.discount_amount} placeholder="5"
                      onChange={v => set("discount_amount", v)} />
                  )}
                  <span>{form.discount_type === "pct" ? "%" : moneda}</span>
                </span>
              </label>

              <div className="ag-cupones-dos">
                <label className="ag-cupones-campo">
                  <span className="ag-field-lbl">Compra mínima (opcional)</span>
                  <span className="ag-cupones-sufijo">
                    <DecimalInput className="ag-field-input" value={form.min_subtotal === "" ? null : form.min_subtotal}
                      placeholder="Sin mínimo" onChange={v => set("min_subtotal", v > 0 ? v : "")} />
                    <span>{moneda}</span>
                  </span>
                  <span className="ag-cupones-ayuda">Sobre el total en productos, sin envío.</span>
                </label>
                <label className="ag-cupones-campo">
                  <span className="ag-field-lbl">Usos totales</span>
                  <input className="ag-field-input" inputMode="numeric" value={form.max_uses} placeholder="Sin límite"
                    onChange={e => set("max_uses", e.target.value.replace(/\D/g, ""))} />
                  <span className="ag-cupones-ayuda">Arranca en 1 (un solo uso). Vacío = sin límite.</span>
                </label>
              </div>

              <label className="ag-cupones-campo">
                <span className="ag-field-lbl">Usos por cliente (opcional)</span>
                <input className="ag-field-input" inputMode="numeric" value={form.max_uses_per_phone} placeholder="Sin límite"
                  onChange={e => set("max_uses_per_phone", e.target.value.replace(/\D/g, ""))} />
                <span className="ag-cupones-ayuda">Se cuenta por teléfono.</span>
              </label>

              <div className="ag-cupones-dos">
                <label className="ag-cupones-campo">
                  <span className="ag-field-lbl">Vigente desde (opcional)</span>
                  <input className="ag-field-input" type="datetime-local" value={form.starts_at}
                    onChange={e => set("starts_at", e.target.value)} />
                </label>
                <label className="ag-cupones-campo">
                  <span className="ag-field-lbl">Vence (opcional)</span>
                  <input className="ag-field-input" type="datetime-local" value={form.expires_at}
                    onChange={e => set("expires_at", e.target.value)} />
                </label>
              </div>

              <label className="ag-cupones-campo">
                <span className="ag-field-lbl">Email (opcional)</span>
                <input className="ag-field-input" type="email" inputMode="email" autoComplete="off" value={form.email}
                  placeholder="cliente@correo.com" onChange={e => set("email", e.target.value)} />
                <span className="ag-cupones-ayuda">Solo para este cliente.</span>
              </label>

              {error && <p className="ag-cupones-error" role="alert">{error}</p>}

              <div className="ag-cupones-acciones">
                <button type="button" className="ag-btn-ghost" onClick={() => { setForm(null); setError(""); }} disabled={guardando}>Cancelar</button>
                <button type="submit" className="ag-btn-primary" disabled={guardando || !form.code.trim()}>
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          ) : (
            <>
              {cupones === null ? (
                <p className="ag-cupones-vacio">Cargando cupones…</p>
              ) : cupones.length === 0 ? (
                <p className="ag-cupones-vacio">Todavía no hay cupones. Creá uno para compartir un descuento por código.</p>
              ) : (
                <ul className="ag-cupones-lista">
                  {cupones.map(c => {
                    const [estado, rotulo] = estadoCupon(c);
                    const usos = Number(c.uses_count ?? (c.used ? 1 : 0));
                    return (
                      <li key={c.id} className="ag-cupones-fila">
                        <div>
                          <div className="ag-cupones-fila-linea">
                            <span className="ag-cupones-codigo">{c.code}</span>
                            <span className="ag-cupones-etiqueta">{etiquetaCupon(c, texto)}</span>
                            <span className="ag-cupones-estado" data-estado={estado}>{rotulo}</span>
                          </div>
                          <div className="ag-cupones-meta">
                            {c.max_uses == null ? `${usos} uso${usos === 1 ? "" : "s"}` : `${usos}/${c.max_uses} usos`}
                            {" · "}{vigenciaCorta(c)}
                            {Number(c.min_subtotal) > 0 && ` · mín. ${texto(c.min_subtotal)}`}
                            {c.email && ` · ${c.email}`}
                          </div>
                        </div>
                        <button type="button" className="ag-btn-ghost ag-cupones-btn" onClick={() => editar(c)}
                          aria-label={`Editar cupón ${c.code}`}>Editar</button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="ag-cupones-acciones">
                <button type="button" className="ag-btn-primary" onClick={nuevo}>Nuevo cupón</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
