import { useState, useEffect } from "react";
import { Icon, formatInt, formatMoney, todayISO, formatOrderCode } from "../../lib/utils";
import {
  createExpense, deleteExpense,
  createSale,
  upsertIngredient, updateIngredientStock
} from "../../lib/adminService";
import CatChipsEditor from "../ui/CatChipsEditor";

const DEFAULT_SETTINGS = {
  exp_cats: ["Materia Prima", "Servicios", "Packaging", "Transporte", "Alquiler", "Equipamiento", "Otros"],
  ing_cats: ["Secos", "Frescos", "Packaging", "Otros"]
};

// ═══════ EXPENSES ═══════
function Expenses({ expenses, setExpenses, settings, setSettings, showToast, onClose }) {
  const monthStart = todayISO().slice(0, 7) + "-01";
  const sorted = [...expenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const tM = expenses.filter(e => e.date >= monthStart).reduce((s, e) => s + (e.amount || 0), 0);
  const byC = expenses.filter(e => e.date >= monthStart).reduce((a, e) => { a[e.category || "Otros"] = (a[e.category || "Otros"] || 0) + (e.amount || 0); return a; }, {});
  const [ae, setAe] = useState(false);

  return (
    <div className="po">
      <div className="ph">
        <button onClick={onClose}>{Icon.back({})}</button>
        <h2>Gastos</h2>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--rd)" }}>Mes: ${formatInt(tM)}</div>
      </div>
      <div className="pb">
        {settings && setSettings && (
          <CatChipsEditor settings={settings} setSettings={setSettings} field="exp_cats" label="Categorías de gastos" icon="💰" showToast={showToast}/>
        )}
        {Object.keys(byC).length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
            {Object.entries(byC).sort((a, b) => b[1] - a[1]).map(([c, a]) => (
              <div key={c} style={{ background: "var(--b3)", borderRadius: 10, padding: "8px 12px", minWidth: 100, boxShadow: "var(--sh)", flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>{c}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>${formatInt(a)}</div>
              </div>
            ))}
          </div>
        )}
        <button className="btn bp" style={{ marginBottom: 12 }} onClick={() => setAe(true)}>
          {Icon.plus({ size: 16, color: "#fff" })} Registrar gasto
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
                <div className="lic" style={{ background: "var(--rl)", color: "var(--rd)" }}>{Icon.dollar({ size: 16 })}</div>
                <div className="lii">
                  <div className="lin" style={{display:"flex",alignItems:"center",gap:6}}>
                    {e.description}
                    {e.expense_type === 'fixed' && <span style={{fontSize:10,fontWeight:700,color:"var(--ac)",background:"var(--al)",padding:"1px 6px",borderRadius:4}}>FIJO</span>}
                  </div>
                  <div className="lid">{e.date && new Date(e.date + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}{e.supplier && ` · ${e.supplier}`}</div>
                </div>
                <div className="lir">
                  <div className="lia" style={{ color: "var(--rd)" }}>-${formatInt(e.amount)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {ae && (
        <ExpForm
          settings={settings}
          onClose={() => setAe(false)}
          onSave={async (e) => {
            const saved = await createExpense(e);
            if (saved) {
              setExpenses(p => [saved, ...p]);
              setAe(false);
              showToast("Registrado");
            } else {
              setAe(false);
              showToast("Error al registrar");
            }
          }}
        />
      )}
    </div>
  );
}

// Categorías que típicamente son gastos fijos
const FIXED_CATS = ["Alquiler", "Servicios", "Sueldos", "Seguros", "Impuestos", "Equipamiento"];

function ExpForm({ onClose, onSave, settings }) {
  const [f, setF] = useState({ date: todayISO(), description: "", amount: 0, category: "Materia Prima", supplier: "", expense_type: "variable" });
  const [err, setErr] = useState("");
  const s = (k, v) => {
    setErr("");
    setF(p => {
      const next = { ...p, [k]: v };
      // Auto-clasificar expense_type según categoría (el user puede sobreescribir manualmente)
      if (k === "category") {
        next.expense_type = FIXED_CATS.includes(v) ? "fixed" : "variable";
      }
      return next;
    });
  };
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
        <button onClick={onClose}>{Icon.back({})}</button>
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
            {(settings?.exp_cats || DEFAULT_SETTINGS.exp_cats).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="fg">
          <label className="fl">Tipo de gasto</label>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>s("expense_type","variable")} style={{flex:1,padding:"10px 12px",borderRadius:10,border:f.expense_type==="variable"?"2px solid var(--pr)":"1px solid var(--b2)",background:f.expense_type==="variable"?"var(--al)":"var(--b3)",color:f.expense_type==="variable"?"var(--ac)":"var(--t2)",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              📦 Variable
            </button>
            <button type="button" onClick={()=>s("expense_type","fixed")} style={{flex:1,padding:"10px 12px",borderRadius:10,border:f.expense_type==="fixed"?"2px solid var(--pr)":"1px solid var(--b2)",background:f.expense_type==="fixed"?"var(--al)":"var(--b3)",color:f.expense_type==="fixed"?"var(--ac)":"var(--t2)",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              🏠 Fijo
            </button>
          </div>
          <p style={{fontSize:11,color:"var(--t3)",margin:"4px 0 0 2px"}}>Fijo = alquiler, sueldos, servicios. Variable = materia prima, packaging, etc.</p>
        </div>
        <div className="fg">
          <label className="fl">Proveedor</label>
          <input className="fin" value={f.supplier} onChange={e => s("supplier", e.target.value)} />
        </div>
        {err && <div style={{ background: "#FFEBEE", color: "var(--rd)", fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 8 }}>⚠️ {err}</div>}
        <button className="btn bp" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }} onClick={handleSave}>{Icon.check({ size: 18, color: "#fff" })} Registrar</button>
      </div>
    </div>
  );
}

// ═══════ PURCHASE ═══════
function Purchase({ ingredients, setIngredients, expenses, setExpenses, settings, onClose, showToast, loadAll }) {
  const [sup, setSup] = useState("");
  const [date, setDate] = useState(todayISO());
  const [items, setItems] = useState([]);
  const [sn, setSn] = useState(false);
  const [ni, setNi] = useState({ name: "", unit: "kg", category: "Secos", cost: 0, min_stock: 0 });

  const add = () => setItems(p => [...p, { ingredient_id: "", qty: 0, unitCost: 0 }]);
  const upd = (i, k, v) => setItems(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const rm = i => setItems(p => p.filter((_, j) => j !== i));
  const sel = (i, id) => {
    const ig = ingredients.find(x => x.id === id);
    upd(i, "ingredient_id", id);
    if (ig) upd(i, "unitCost", ig.cost || 0);
  };

  const cr = async () => {
    if (!ni.name) return;
    const saved = await upsertIngredient({ ...ni, stock: 0 });
    if (saved) {
      setIngredients(p => [...p, saved]);
      setSn(false);
      setNi({ name: "", unit: "kg", category: "Secos", cost: 0, min_stock: 0 });
      showToast("Insumo: " + saved.name);
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
      const d = v.map(it => { const ig = ingredients.find(x => x.id === it.ingredient_id); return ig ? `${ig.name} x${it.qty}` : ""; }).filter(Boolean).join(", ");
      const saved = await createExpense({ date, description: `Compra: ${d.slice(0, 50)}`, amount: tot, category: "Materia Prima", supplier: sup });
      if (saved) setExpenses(p => [saved, ...p]);
    }
    await loadAll();
    showToast("Compra registrada");
    onClose();
  };

  const ic = settings?.ing_cats || DEFAULT_SETTINGS.ing_cats;

  return (
    <div className="po">
      <div className="ph">
        <button onClick={onClose}>{Icon.back({})}</button>
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
            <button className="btn bs bsm" onClick={() => setSn(true)}>{Icon.plus({ size: 14 })} Nuevo</button>
            <button className="btn bp bsm" onClick={add}>{Icon.plus({ size: 14 })} Item</button>
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
              <button className="btn bp" onClick={cr}>{Icon.check({ size: 16, color: "#fff" })} Crear</button>
            </div>
          </div>
        )}
        {items.map((it, i) => (
          <div key={i} className="c" style={{ padding: 12, marginBottom: 8, position: "relative" }}>
            <button onClick={() => rm(i)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--rd)" }}>
              {Icon.x({ size: 16 })}
            </button>
            <div className="fg" style={{ marginBottom: 8 }}>
              <select className="fin" value={it.ingredient_id} onChange={e => sel(i, e.target.value)}>
                <option value="">Seleccionar...</option>
                {ingredients.map(x => <option key={x.id} value={x.id}>{x.name} ({x.unit}) — {x.stock || 0}</option>)}
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
                <div style={{ padding: "12px 0", fontWeight: 700 }}>${formatInt((it.qty || 0) * (it.unitCost || 0))}</div>
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
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Serif Display',serif", color: "var(--ac)" }}>${formatInt(tot)}</div>
          </div>
        )}
        <button className="btn bp" style={{ marginTop: 16 }} onClick={sub}>
          {Icon.check({ size: 18, color: "#fff" })} Confirmar
        </button>
      </div>
    </div>
  );
}

// ═══════ SALES ═══════
function SalesView({ sales, setSales, orders, recipes, calculateRecipeCost, overlay, setOverlay, showToast }) {
  const monthStart = todayISO().slice(0, 7) + "-01";
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  // Combinar: pedidos completados + ventas manuales, todo como "ventas"
  const ST_DONE = "completed";
  const completedOrders = (orders || []).filter(o => o.status === ST_DONE);

  // Todas las ventas (orders completados + ventas manuales) ordenadas por fecha
  const allSales = [
    ...completedOrders.map(o => ({
      id: o.id, type: "order", code: formatOrderCode(o.id),
      customer: o.customer || "Sin nombre", date: o.date || (o.created_at || "").split("T")[0],
      items: (o.order_items || o.items || []).map(it => {
        const r = recipes.find(x => x.id === it.recipe_id);
        return { name: r?.name || "?", qty: it.quantity || it.qty || 1, price: it.unit_price || 0 };
      }),
      itemCount: (o.order_items || o.items || []).reduce((s, it) => s + (it.quantity || it.qty || 1), 0),
      total: o.total || 0, payment: o.payment || "—", phone: o.phone || "",
      completedAt: o.completedAt || o.created_at || ""
    })),
    ...sales.map(s => {
      const r = recipes.find(x => x.id === s.recipe_id);
      return {
        id: s.id, type: "manual", code: formatOrderCode(s.id),
        customer: "Venta manual", date: s.date,
        items: [{ name: r?.name || "?", qty: s.qty || 1, price: s.unit_price || 0 }],
        itemCount: s.qty || 1,
        total: s.total || 0, payment: "—", phone: "",
        completedAt: s.created_at || s.date || ""
      };
    })
  ].sort((a, b) => (b.completedAt || b.date || "").localeCompare(a.completedAt || a.date || ""));

  // Filtro de búsqueda
  const filtered = search.trim()
    ? allSales.filter(s => s.customer.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()) || s.items.some(it => it.name.toLowerCase().includes(search.toLowerCase())))
    : allSales;

  // Agrupar por fecha
  const grouped = filtered.reduce((a, s) => { const d = s.date || "sin-fecha"; if (!a[d]) a[d] = []; a[d].push(s); return a; }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Totales del mes
  const tM = allSales.filter(s => s.date >= monthStart).reduce((a, x) => a + (x.total || 0), 0);
  const countM = allSales.filter(s => s.date >= monthStart).length;

  return (
    <>
      <div className="s">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="st" style={{ margin: 0 }}>Ventas</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gn)" }}>${formatInt(tM)}</div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>{countM} ventas este mes</div>
          </div>
        </div>
      </div>
      {/* Barra de búsqueda */}
      <div className="sb">{Icon.search({ size: 16 })}<input className="fin" placeholder="Buscar por cliente, código o producto..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="s">
        {sortedDates.length === 0 ? (
          <div className="c"><div className="empty"><div className="eic">🛒</div><div>{search ? "Sin resultados" : "Sin ventas"}</div></div></div>
        ) : sortedDates.map(d => {
          const daySales = grouped[d];
          const dayTotal = daySales.reduce((a, s) => a + s.total, 0);
          return (
            <div key={d}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px 6px", fontSize: 12, fontWeight: 700, color: "var(--t3)" }}>
                <span>{new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}</span>
                <span>{daySales.length} ventas · ${formatInt(dayTotal)}</span>
              </div>
              {daySales.map(s => {
                const isExp = expanded === s.id;
                return (
                  <div key={s.id} className="c" style={{ padding: 0, marginBottom: 8, overflow: "hidden", cursor: "pointer", transition: "all .2s" }} onClick={() => setExpanded(isExp ? null : s.id)}>
                    {/* Card header */}
                    <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--tx)" }}>{s.customer}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", background: "var(--b2)", padding: "1px 6px", borderRadius: 6 }}>{s.code}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--t3)" }}>
                          {s.itemCount} {s.itemCount === 1 ? "item" : "items"}{s.payment !== "—" ? ` · ${s.payment}` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--gn)" }}>${formatInt(s.total)}</div>
                        <div style={{ fontSize: 10, color: "var(--t3)" }}>{isExp ? "▲" : "▼"}</div>
                      </div>
                    </div>
                    {/* Expanded details */}
                    {isExp && (
                      <div style={{ borderTop: "1px solid var(--b2)", padding: "10px 14px", background: "var(--bg)" }}>
                        {s.items.map((it, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                            <span>{it.name} × {it.qty}</span>
                            <span style={{ fontWeight: 600 }}>${formatInt(it.qty * it.price)}</span>
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 2px", borderTop: "1px solid var(--b2)", marginTop: 4, fontWeight: 700, fontSize: 14 }}>
                          <span>Total</span><span>${formatInt(s.total)}</span>
                        </div>
                        {s.phone && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>📞 {s.phone}</div>}
                        {/* Print placeholders */}
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button className="btn bs bsm" style={{ flex: 1 }} onClick={e => { e.stopPropagation(); showToast("🖨️ Impresión de recibo próximamente"); }}>
                            🖨️ Recibo
                          </button>
                          <button className="btn bs bsm" style={{ flex: 1 }} onClick={e => { e.stopPropagation(); showToast("🖨️ Impresión de factura próximamente"); }}>
                            🧾 Factura
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <button className="fab" onClick={() => setOverlay({ type: "addSale" })}>
        {Icon.plus({ size: 24, color: "#fff" })}
      </button>
      {overlay?.type === "addSale" && (
        <SaleForm
          recipes={recipes}
          onClose={() => setOverlay(null)}
          onSave={async (s) => {
            const saved = await createSale(s);
            if (saved) {
              setSales(p => [saved, ...p]);
              setOverlay(null);
              showToast("Registrada");
            }
          }}
        />
      )}
    </>
  );
}

function SaleForm({ recipes, onClose, onSave }) {
  const [ri, setRi] = useState("");
  const [q, setQ] = useState(1);
  const [p, setP] = useState(0);
  const [d, setD] = useState(todayISO());
  const r = recipes.find(x => x.id === ri);

  useEffect(() => {
    if (r) setP(r.sale_price || 0);
  }, [r]);

  return (
    <div className="po">
      <div className="ph">
        <button onClick={onClose}>{Icon.back({})}</button>
        <h2>Registrar Venta</h2>
      </div>
      <div className="pb">
        <div className="fg">
          <label className="fl">Producto</label>
          <select className="fin" value={ri} onChange={e => setRi(e.target.value)}>
            <option value="">Seleccionar...</option>
            {recipes.map(r2 => <option key={r2.id} value={r2.id}>{r2.name} — ${formatInt(r2.sale_price)}</option>)}
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
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gn)", fontFamily: "'DM Serif Display',serif" }}>${formatInt(q * p)}</div>
          </div>
        )}
        <button className="btn bp" style={{ marginTop: 12 }} onClick={() => ri && q > 0 && p > 0 && onSave({ date: d, recipe_id: ri, qty: q, unit_price: p, total: q * p })}>
          {Icon.check({ size: 18, color: "#fff" })} Registrar
        </button>
      </div>
    </div>
  );
}

export { Expenses, Purchase, SalesView };