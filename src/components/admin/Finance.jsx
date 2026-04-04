import { useState, useEffect } from "react";
import { I, fi, fm, td } from "../../lib/utils";
import {
  createExpense, deleteExpense,
  createSale,
  upsertIngredient, updateIngredientStock
} from "../../lib/adminService";

const DEF = {
  exp_cats: ["Materia Prima", "Servicios", "Packaging", "Transporte", "Alquiler", "Equipamiento", "Otros"],
  ing_cats: ["Secos", "Frescos", "Packaging", "Otros"]
};

// ═══════ EXPENSES ═══════
function Expenses({ exps, setExps, sett, msg, onClose }) {
  const mo = td().slice(0, 7) + "-01";
  const sorted = [...exps].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const tM = exps.filter(e => e.date >= mo).reduce((s, e) => s + (e.amount || 0), 0);
  const byC = exps.filter(e => e.date >= mo).reduce((a, e) => { a[e.category || "Otros"] = (a[e.category || "Otros"] || 0) + (e.amount || 0); return a; }, {});
  const [ae, setAe] = useState(false);

  return (
    <div className="po">
      <div className="ph">
        <button onClick={onClose}>{I.back({})}</button>
        <h2>Gastos</h2>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--rd)" }}>Mes: ${fi(tM)}</div>
      </div>
      <div className="pb">
        {Object.keys(byC).length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
            {Object.entries(byC).sort((a, b) => b[1] - a[1]).map(([c, a]) => (
              <div key={c} style={{ background: "var(--b3)", borderRadius: 10, padding: "8px 12px", minWidth: 100, boxShadow: "var(--sh)", flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>{c}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>${fi(a)}</div>
              </div>
            ))}
          </div>
        )}
        <button className="btn bp" style={{ marginBottom: 12 }} onClick={() => setAe(true)}>
          {I.plus({ size: 16, color: "#fff" })} Registrar gasto
        </button>
        <div className="c" style={{ padding: 0, overflow: "hidden" }}>
          {sorted.length === 0 ? (
            <div className="empty">
              <div className="eic">💰</div>
              <div>Sin gastos</div>
            </div>
          ) : (
            sorted.map(e => (
              <div key={e.id} className="li">
                <div className="lic" style={{ background: "var(--rl)", color: "var(--rd)" }}>{I.dollar({ size: 16 })}</div>
                <div className="lii">
                  <div className="lin">{e.description}</div>
                  <div className="lid">{e.date && new Date(e.date + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}{e.supplier && ` · ${e.supplier}`}</div>
                </div>
                <div className="lir">
                  <div className="lia" style={{ color: "var(--rd)" }}>-${fi(e.amount)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {ae && (
        <ExpForm
          sett={sett}
          onClose={() => setAe(false)}
          onSave={async (e) => {
            const saved = await createExpense(e);
            if (saved) {
              setExps(p => [saved, ...p]);
              setAe(false);
              msg("Registrado");
            } else {
              setAe(false);
              msg("Error al registrar");
            }
          }}
        />
      )}
    </div>
  );
}

function ExpForm({ onClose, onSave, sett }) {
  const [f, setF] = useState({ date: td(), description: "", amount: 0, category: "Materia Prima", supplier: "" });
  const [err, setErr] = useState("");
  const s = (k, v) => { setErr(""); setF(p => ({ ...p, [k]: v })); };
  const descOk = f.description.trim().length >= 4;
  const amtOk = (f.amount || 0) > 0;
  const canSave = descOk && amtOk;
  const handleSave = () => {
    if (!descOk) { setErr("La descripción debe tener al menos 4 caracteres."); return; }
    if (!amtOk) { setErr("El monto debe ser mayor a 0."); return; }
    onSave({ ...f, description: f.description.trim() });
  };
  return (
    <div className="po">
      <div className="ph">
        <button onClick={onClose}>{I.back({})}</button>
        <h2>Registrar Gasto</h2>
      </div>
      <div className="pb">
        <div className="fg">
          <label className="fl">Descripción</label>
          <input className="fin" value={f.description} onChange={e => s("description", e.target.value)} placeholder="Ej: Compra de harina" />
          {f.description && !descOk && <p style={{ fontSize: 11, color: "var(--rd)", margin: "3px 0 0 2px" }}>Mínimo 4 caracteres · ({f.description.trim().length}/4)</p>}
        </div>
        <div className="fr">
          <div className="fg">
            <label className="fl">Monto</label>
            <input className="fin" type="number" min="0.01" step="0.01" value={f.amount || ""} onChange={e => s("amount", Math.max(0, Number(e.target.value)))} />
            {f.amount !== 0 && !amtOk && <p style={{ fontSize: 11, color: "var(--rd)", margin: "3px 0 0 2px" }}>Debe ser mayor a 0</p>}
          </div>
          <div className="fg">
            <label className="fl">Fecha</label>
            <input className="fin" type="date" value={f.date} onChange={e => s("date", e.target.value)} />
          </div>
        </div>
        <div className="fg">
          <label className="fl">Categoría</label>
          <select className="fin" value={f.category} onChange={e => s("category", e.target.value)}>
            {(sett?.exp_cats || DEF.exp_cats).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="fg">
          <label className="fl">Proveedor</label>
          <input className="fin" value={f.supplier} onChange={e => s("supplier", e.target.value)} />
        </div>
        {err && <div style={{ background: "#FFEBEE", color: "var(--rd)", fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 8 }}>⚠️ {err}</div>}
        <button className="btn bp" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }} onClick={handleSave}>{I.check({ size: 18, color: "#fff" })} Registrar</button>
      </div>
    </div>
  );
}

// ═══════ PURCHASE ═══════
function Purchase({ ings, setIngs, exps, setExps, sett, onClose, msg, loadAll }) {
  const [sup, setSup] = useState("");
  const [date, setDate] = useState(td());
  const [items, setItems] = useState([]);
  const [sn, setSn] = useState(false);
  const [ni, setNi] = useState({ name: "", unit: "kg", category: "Secos", cost: 0, min_stock: 0 });

  const add = () => setItems(p => [...p, { ingredient_id: "", qty: 0, unitCost: 0 }]);
  const upd = (i, k, v) => setItems(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const rm = i => setItems(p => p.filter((_, j) => j !== i));
  const sel = (i, id) => {
    const ig = ings.find(x => x.id === id);
    upd(i, "ingredient_id", id);
    if (ig) upd(i, "unitCost", ig.cost || 0);
  };

  const cr = async () => {
    if (!ni.name) return;
    const saved = await upsertIngredient({ ...ni, stock: 0 });
    if (saved) {
      setIngs(p => [...p, saved]);
      setSn(false);
      setNi({ name: "", unit: "kg", category: "Secos", cost: 0, min_stock: 0 });
      msg("Insumo: " + saved.name);
    }
  };

  const tot = items.reduce((s, it) => s + (it.qty || 0) * (it.unitCost || 0), 0);

  const sub = async () => {
    const v = items.filter(it => it.ingredient_id && it.qty > 0);
    if (!v.length) return;
    // Update stock for each item
    for (const it of v) {
      await updateIngredientStock(it.ingredient_id, it.qty);
      if (it.unitCost > 0) {
        await upsertIngredient({ id: it.ingredient_id, cost: it.unitCost });
      }
    }
    // Register as expense if total > 0
    if (tot > 0) {
      const d = v.map(it => { const ig = ings.find(x => x.id === it.ingredient_id); return ig ? `${ig.name} x${it.qty}` : ""; }).filter(Boolean).join(", ");
      const saved = await createExpense({ date, description: `Compra: ${d.slice(0, 50)}`, amount: tot, category: "Materia Prima", supplier: sup });
      if (saved) setExps(p => [saved, ...p]);
    }
    await loadAll();
    msg("Compra registrada");
    onClose();
  };

  const ic = sett?.ing_cats || DEF.ing_cats;

  return (
    <div className="po">
      <div className="ph">
        <button onClick={onClose}>{I.back({})}</button>
        <h2>Registrar Compra</h2>
      </div>
      <div className="pb">
        <div className="fr">
          <div className="fg">
            <label className="fl">Proveedor</label>
            <input className="fin" value={sup} onChange={e => setSup(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Fecha</label>
            <input className="fin" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0 12px" }}>
          <label className="fl" style={{ margin: 0 }}>Items ({items.length})</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn bs bsm" onClick={() => setSn(true)}>{I.plus({ size: 14 })} Nuevo</button>
            <button className="btn bp bsm" onClick={add}>{I.plus({ size: 14 })} Item</button>
          </div>
        </div>
        {sn && (
          <div className="c" style={{ background: "var(--bll)", border: "2px solid var(--bl)", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--bl)", marginBottom: 8 }}>CREAR INSUMO</div>
            <div className="fg">
              <input className="fin" placeholder="Nombre" value={ni.name} onChange={e => setNi(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="fr">
              <div className="fg">
                <label className="fl">Unidad</label>
                <select className="fin" value={ni.unit} onChange={e => setNi(p => ({ ...p, unit: e.target.value }))}>
                  {["kg", "g", "lt", "ml", "uni"].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Cat.</label>
                <select className="fin" value={ni.category} onChange={e => setNi(p => ({ ...p, category: e.target.value }))}>
                  {ic.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="fr">
              <div className="fg">
                <label className="fl">$/u</label>
                <input className="fin" type="number" value={ni.cost || ""} onChange={e => setNi(p => ({ ...p, cost: Number(e.target.value) }))} />
              </div>
              <div className="fg">
                <label className="fl">Mín</label>
                <input className="fin" type="number" value={ni.min_stock || ""} onChange={e => setNi(p => ({ ...p, min_stock: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="fr">
              <button className="btn bs" onClick={() => setSn(false)}>Cancelar</button>
              <button className="btn bp" onClick={cr}>{I.check({ size: 16, color: "#fff" })} Crear</button>
            </div>
          </div>
        )}
        {items.map((it, i) => (
          <div key={i} className="c" style={{ padding: 12, marginBottom: 8, position: "relative" }}>
            <button onClick={() => rm(i)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--rd)" }}>
              {I.x({ size: 16 })}
            </button>
            <div className="fg" style={{ marginBottom: 8 }}>
              <select className="fin" value={it.ingredient_id} onChange={e => sel(i, e.target.value)}>
                <option value="">Seleccionar...</option>
                {ings.map(x => <option key={x.id} value={x.id}>{x.name} ({x.unit}) — {x.stock || 0}</option>)}
              </select>
            </div>
            <div className="fr">
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">Cant.</label>
                <input className="fin" type="number" value={it.qty || ""} onChange={e => upd(i, "qty", Number(e.target.value))} />
              </div>
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">$/u</label>
                <input className="fin" type="number" value={it.unitCost || ""} onChange={e => upd(i, "unitCost", Number(e.target.value))} />
              </div>
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">Sub</label>
                <div style={{ padding: "12px 0", fontWeight: 700 }}>${fi((it.qty || 0) * (it.unitCost || 0))}</div>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="c">
            <div className="empty" style={{ padding: 20 }}>
              <div className="eic">📦</div>
              <div>Tocá "+ Item"</div>
            </div>
          </div>
        )}
        {items.length > 0 && (
          <div className="c" style={{ background: "var(--al)", textAlign: "center", marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ac)" }}>TOTAL</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Serif Display',serif", color: "var(--ac)" }}>${fi(tot)}</div>
          </div>
        )}
        <button className="btn bp" style={{ marginTop: 16 }} onClick={sub}>
          {I.check({ size: 18, color: "#fff" })} Confirmar
        </button>
      </div>
    </div>
  );
}

// ═══════ SALES ═══════
function SalesView({ sales, setSales, recs, rc, ov, setOv, msg }) {
  const mo = td().slice(0, 7) + "-01";
  const sorted = [...sales].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const gr = sorted.reduce((a, s) => { if (!a[s.date]) a[s.date] = []; a[s.date].push(s); return a; }, {});
  const tM = sales.filter(s => s.date >= mo).reduce((a, x) => a + (x.total || 0), 0);

  return (
    <>
      <div className="s">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="st" style={{ margin: 0 }}>Ventas</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gn)" }}>Mes: ${fi(tM)}</div>
        </div>
      </div>
      <div className="s">
        {Object.entries(gr).map(([d, its]) => {
          const dt = its.reduce((a, i) => a + (i.total || 0), 0);
          return (
            <div key={d}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px 4px", fontSize: 12, fontWeight: 700, color: "var(--t3)" }}>
                <span>{new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}</span>
                <span>${fi(dt)}</span>
              </div>
              <div className="c" style={{ padding: 0, overflow: "hidden" }}>
                {its.map(s => {
                  const r = recs.find(x => x.id === s.recipe_id);
                  return (
                    <div key={s.id} className="li">
                      <div className="lic" style={{ background: "var(--gl)", color: "var(--gn)" }}>{I.cart({ size: 16 })}</div>
                      <div className="lii">
                        <div className="lin">{r?.name || "?"}</div>
                        <div className="lid">{s.qty || 1} × ${fi(s.unit_price || 0)}</div>
                      </div>
                      <div className="lir">
                        <div className="lia" style={{ color: "var(--gn)" }}>${fi(s.total)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {sales.length === 0 && (
          <div className="c">
            <div className="empty">
              <div className="eic">🛒</div>
              <div>Sin ventas</div>
            </div>
          </div>
        )}
      </div>
      <button className="fab" onClick={() => setOv({ type: "addSale" })}>
        {I.plus({ size: 24, color: "#fff" })}
      </button>
      {ov?.type === "addSale" && (
        <SaleForm
          recs={recs}
          onClose={() => setOv(null)}
          onSave={async (s) => {
            const saved = await createSale(s);
            if (saved) {
              setSales(p => [saved, ...p]);
              setOv(null);
              msg("Registrada");
            }
          }}
        />
      )}
    </>
  );
}

function SaleForm({ recs, onClose, onSave }) {
  const [ri, setRi] = useState("");
  const [q, setQ] = useState(1);
  const [p, setP] = useState(0);
  const [d, setD] = useState(td());
  const r = recs.find(x => x.id === ri);

  useEffect(() => {
    if (r) setP(r.sale_price || 0);
  }, [r]);

  return (
    <div className="po">
      <div className="ph">
        <button onClick={onClose}>{I.back({})}</button>
        <h2>Registrar Venta</h2>
      </div>
      <div className="pb">
        <div className="fg">
          <label className="fl">Producto</label>
          <select className="fin" value={ri} onChange={e => setRi(e.target.value)}>
            <option value="">Seleccionar...</option>
            {recs.map(r2 => <option key={r2.id} value={r2.id}>{r2.name} — ${fi(r2.sale_price)}</option>)}
          </select>
        </div>
        <div className="fg">
          <label className="fl">Fecha</label>
          <input className="fin" type="date" value={d} onChange={e => setD(e.target.value)} />
        </div>
        <div className="fr">
          <div className="fg">
            <label className="fl">Cant.</label>
            <input className="fin" type="number" min="1" value={q} onChange={e => setQ(Number(e.target.value))} />
          </div>
          <div className="fg">
            <label className="fl">$/u</label>
            <input className="fin" type="number" value={p || ""} onChange={e => setP(Number(e.target.value))} />
          </div>
        </div>
        {ri && q > 0 && p > 0 && (
          <div className="c" style={{ background: "var(--gl)", textAlign: "center", marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "var(--gn)", fontWeight: 600 }}>TOTAL</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gn)", fontFamily: "'DM Serif Display',serif" }}>${fi(q * p)}</div>
          </div>
        )}
        <button className="btn bp" style={{ marginTop: 12 }} onClick={() => ri && q > 0 && p > 0 && onSave({ date: d, recipe_id: ri, qty: q, unit_price: p, total: q * p })}>
          {I.check({ size: 18, color: "#fff" })} Registrar
        </button>
      </div>
    </div>
  );
}

export { Expenses, Purchase, SalesView };