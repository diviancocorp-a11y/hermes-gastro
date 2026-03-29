import { useState, useEffect } from "react";
import { I, fi, fm, ST_L, ST_C, ST_B } from "../lib/utils";
import {
  login, logout, getSession,
  fetchAllRecipes, upsertRecipe, deleteRecipe,
  fetchOrders, updateOrderStatus,
  fetchSettings, updateSettings,
  fetchIngredients, upsertIngredient, deleteIngredient,
  fetchRecipeIngredients, saveRecipeIngredients,
  fetchDashboardStats
} from "../lib/adminService";

// ─── TABS ─────────────────────────────────────────────
const TABS = [
  { id: "home",     label: "Inicio",   icon: "home" },
  { id: "orders",   label: "Pedidos",  icon: "orders" },
  { id: "products", label: "Recetas",  icon: "recipe" },
  { id: "stock",    label: "Stock",    icon: "box" },
  { id: "settings", label: "Config",   icon: "settings" },
];

export default function Admin() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState("orders");

  useEffect(() => {
    getSession().then(s => { setSession(s); setChecking(false); });
  }, []);

  if (checking) return <div className="admin-loading"><p>Cargando...</p></div>;
  if (!session) return <LoginScreen onLogin={setSession} />;

  return (
    <div className="admin-app">
      <div className="admin-header">
        <h1 className="admin-title">La Nona Pato</h1>
        <button className="admin-logout" onClick={async () => { await logout(); setSession(null); }}>
          Salir
        </button>
      </div>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`admin-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {I[t.icon]({ size: 18 })}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="admin-content">
        {tab === "home"     && <DashboardPanel />}
        {tab === "orders"   && <OrdersPanel />}
        {tab === "products" && <ProductsPanel />}
        {tab === "stock"    && <StockPanel />}
        {tab === "settings" && <SettingsPanel />}
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await login(email, pass);
    setLoading(false);
    if (res.ok) {
      const s = await getSession();
      onLogin(s);
    } else {
      setErr(res.msg);
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleLogin}>
        <div className="login-logo">N</div>
        <h2 className="login-title">Panel de Gestión</h2>
        <p className="login-sub">La Nona Pato</p>
        {err && <div className="login-err">{err}</div>}
        <input
          type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} className="login-input" required
        />
        <input
          type="password" placeholder="Contraseña" value={pass}
          onChange={e => setPass(e.target.value)} className="login-input" required
        />
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────
function DashboardPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats().then(s => { setStats(s); setLoading(false); });
  }, []);

  if (loading) return <p className="admin-msg">Cargando dashboard...</p>;
  if (!stats)  return <p className="admin-msg">Error al cargar estadísticas</p>;

  return (
    <div>
      <p className="dash-title">📊 Resumen de hoy</p>
      <div className="dash-grid">
        <div className="dash-card">
          <div className="dash-val">${fi(stats.todayRevenue)}</div>
          <div className="dash-lbl">Ventas hoy</div>
        </div>
        <div className="dash-card">
          <div className="dash-val">{stats.todayOrders}</div>
          <div className="dash-lbl">Pedidos hoy</div>
        </div>
        <div className="dash-card">
          <div className="dash-val">${fi(stats.monthRevenue)}</div>
          <div className="dash-lbl">Ventas este mes</div>
        </div>
        <div className="dash-card">
          <div className="dash-val">{stats.monthOrders}</div>
          <div className="dash-lbl">Pedidos mes</div>
        </div>
      </div>

      <p className="dash-title" style={{ marginTop: 24 }}>📋 Pedidos por estado</p>
      <div className="dash-statuses">
        {Object.entries(ST_L).map(([key, label]) => (
          <div key={key} className="dash-status-row">
            <span className="status-badge" style={{ background: ST_C[key]?.bg, color: ST_C[key]?.tx }}>
              {label}
            </span>
            <span className="dash-status-count">{stats.byStatus[key] || 0}</span>
          </div>
        ))}
      </div>

      {stats.topProducts.length > 0 && (
        <>
          <p className="dash-title" style={{ marginTop: 24 }}>🏆 Más vendidos</p>
          <div className="dash-products">
            {stats.topProducts.map((p, i) => (
              <div key={i} className="dash-product-row">
                <span className="dash-rank">#{i + 1}</span>
                <span className="dash-pname">{p.name}</span>
                <span className="dash-pqty">{p.qty} uds</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── PEDIDOS ──────────────────────────────────────────
function OrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    setLoading(true);
    const data = await fetchOrders();
    setOrders(data);
    setLoading(false);
  };

  const changeStatus = async (id, status) => {
    await updateOrderStatus(id, status);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
  };

  if (loading) return <p className="admin-msg">Cargando pedidos...</p>;
  if (!orders.length) return <p className="admin-msg">No hay pedidos todavía</p>;

  if (selected) return (
    <div>
      <button className="admin-back" onClick={() => setSelected(null)}>
        {I.back({ size: 18 })} Volver
      </button>
      <div className="order-detail">
        <div className="od-header">
          <h3>Pedido #{selected.id.slice(0, 8)}</h3>
          <span className="status-badge" style={{ background: ST_C[selected.status]?.bg, color: ST_C[selected.status]?.tx }}>
            {ST_L[selected.status] || selected.status}
          </span>
        </div>
        <div className="od-info">
          <p><strong>Cliente:</strong> {selected.customer}</p>
          <p><strong>Tel:</strong> {selected.phone}</p>
          {selected.email && <p><strong>Email:</strong> {selected.email}</p>}
          <p><strong>Entrega:</strong> {selected.delivery === "retiro" ? "Retiro en local" : "Delivery"}</p>
          <p><strong>Pago:</strong> {selected.payment}</p>
          {selected.note && <p><strong>Nota:</strong> {selected.note}</p>}
          <p><strong>Fecha:</strong> {new Date(selected.created_at).toLocaleString("es-AR")}</p>
        </div>
        <div className="od-items">
          <h4>Items</h4>
          {(selected.order_items || []).map((item, i) => (
            <div key={i} className="od-item">
              <span>{item.recipes?.name || "Producto"} x{item.quantity}</span>
              <span>${fi(item.subtotal)}</span>
            </div>
          ))}
          <div className="od-total"><span>Total</span><span>${fi(selected.total)}</span></div>
        </div>
        <div className="od-actions">
          <h4>Cambiar estado</h4>
          <div className="status-btns">
            {Object.entries(ST_L).map(([key, label]) => (
              <button
                key={key}
                className={`status-btn ${selected.status === key ? "active" : ""}`}
                style={{
                  borderColor: ST_B[key],
                  color: selected.status === key ? "#fff" : ST_B[key],
                  background: selected.status === key ? ST_B[key] : "transparent"
                }}
                onClick={() => changeStatus(selected.id, key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="orders-list">
      {orders.map(o => (
        <div key={o.id} className="order-card" onClick={() => setSelected(o)}>
          <div className="oc-top">
            <span className="oc-id">#{o.id.slice(0, 8)}</span>
            <span className="status-badge" style={{ background: ST_C[o.status]?.bg, color: ST_C[o.status]?.tx }}>
              {ST_L[o.status] || o.status}
            </span>
          </div>
          <div className="oc-mid">
            <span className="oc-name">{o.customer}</span>
            <span className="oc-total">${fi(o.total)}</span>
          </div>
          <div className="oc-bot">
            <span>{o.delivery === "retiro" ? "Retiro" : "Delivery"} · {o.payment}</span>
            <span>{new Date(o.created_at).toLocaleDateString("es-AR")}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── STOCK DE INGREDIENTES ────────────────────────────
function StockPanel() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadIngredients(); }, []);

  const loadIngredients = async () => {
    setLoading(true);
    const data = await fetchIngredients();
    setIngredients(data);
    setLoading(false);
  };

  const save = async (ing) => {
    const saved = await upsertIngredient(ing);
    if (saved) { await loadIngredients(); setEditing(null); }
  };

  const remove = async (id) => {
    if (confirm("¿Eliminar este ingrediente?")) {
      await deleteIngredient(id);
      setIngredients(prev => prev.filter(i => i.id !== id));
    }
  };

  if (loading) return <p className="admin-msg">Cargando stock...</p>;

  if (editing !== null) return (
    <IngredientForm ingredient={editing} onSave={save} onCancel={() => setEditing(null)} />
  );

  // Ordenar: primero los con stock bajo
  const sorted = [...ingredients].sort((a, b) => {
    const aLow = a.stock <= (a.min_stock || 0) ? 0 : 1;
    const bLow = b.stock <= (b.min_stock || 0) ? 0 : 1;
    return aLow - bLow;
  });

  return (
    <div>
      <button
        className="admin-add-btn"
        onClick={() => setEditing({ name: "", unit: "gr", cost_per_unit: 0, stock: 0, min_stock: 0 })}
      >
        {I.plus({ size: 18 })} Nuevo Ingrediente
      </button>

      {!ingredients.length ? (
        <p className="admin-msg">No hay ingredientes todavía. ¡Agregá el primero!</p>
      ) : (
        <div className="ingredients-list">
          {sorted.map(ing => {
            const isLow = ing.stock <= (ing.min_stock || 0);
            return (
              <div key={ing.id} className={`ingredient-card ${isLow ? "ing-low" : ""}`}>
                <div className="ing-info">
                  <div className="ing-name">
                    {isLow && <span className="ing-alert">⚠️ </span>}
                    {ing.name}
                  </div>
                  <div className="ing-details">
                    <span className="ing-unit">{ing.unit}</span>
                    <span className="ing-cost">${fm(ing.cost_per_unit)}/{ing.unit}</span>
                    <span className={`ing-stock ${isLow ? "low" : ""}`}>
                      Stock: {fm(ing.stock)} {ing.unit}
                    </span>
                  </div>
                </div>
                <div className="pc-actions">
                  <button onClick={() => setEditing({ ...ing })} title="Editar">
                    {I.edit({ size: 16 })}
                  </button>
                  <button onClick={() => remove(ing.id)} title="Eliminar" className="pc-del">
                    {I.trash({ size: 16 })}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const UNITS = ["gr", "kg", "ml", "lt", "un", "docena", "taza", "cucharada", "cucharadita"];

function IngredientForm({ ingredient, onSave, onCancel }) {
  const [form, setForm] = useState(ingredient);
  const [saving, setSaving] = useState(false);
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div>
      <button className="admin-back" onClick={onCancel}>{I.back({ size: 18 })} Volver</button>
      <div className="pf-form">
        <h3>{form.id ? "Editar Ingrediente" : "Nuevo Ingrediente"}</h3>

        <label>Nombre</label>
        <input
          value={form.name}
          onChange={e => sf("name", e.target.value)}
          placeholder="Ej: Harina, Azúcar, Huevos"
        />

        <label>Unidad de medida</label>
        <select
          value={form.unit}
          onChange={e => sf("unit", e.target.value)}
          className="ing-select"
        >
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <label>Costo por {form.unit} ($)</label>
        <input
          type="number" step="0.01" min="0"
          value={form.cost_per_unit}
          onChange={e => sf("cost_per_unit", Number(e.target.value))}
        />

        <label>Stock actual ({form.unit})</label>
        <input
          type="number" step="0.01" min="0"
          value={form.stock}
          onChange={e => sf("stock", Number(e.target.value))}
        />

        <label>Stock mínimo ({form.unit}) — alerta cuando baje de este nivel</label>
        <input
          type="number" step="0.01" min="0"
          value={form.min_stock || 0}
          onChange={e => sf("min_stock", Number(e.target.value))}
        />

        <button className="login-btn" onClick={handleSave} disabled={!form.name.trim() || saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ─── PRODUCTOS / RECETAS ──────────────────────────────
function ProductsPanel() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadRecipes(); }, []);

  const loadRecipes = async () => {
    setLoading(true);
    const data = await fetchAllRecipes();
    setRecipes(data);
    setLoading(false);
  };

  const remove = async (id) => {
    if (confirm("¿Eliminar este producto?")) {
      await deleteRecipe(id);
      setRecipes(prev => prev.filter(r => r.id !== id));
    }
  };

  if (loading) return <p className="admin-msg">Cargando productos...</p>;

  if (editing !== null) return (
    <ProductForm
      recipe={editing}
      onDone={async () => { await loadRecipes(); setEditing(null); }}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <div>
      <button
        className="admin-add-btn"
        onClick={() => setEditing({ name: "", category: "", sale_price: 0, description: "", image_url: "", visible: true })}
      >
        {I.plus({ size: 18 })} Nuevo Producto
      </button>
      <div className="products-list">
        {recipes.map(r => (
          <div key={r.id} className="product-card">
            <div className="pc-img-wrap">
              {r.image_url ? <img src={r.image_url} alt="" onError={e => { e.target.style.display = 'none'; }} /> : null}
              <div className="pc-initial">{r.name.charAt(0)}</div>
            </div>
            <div className="pc-info">
              <div className="pc-name">{r.name}</div>
              <div className="pc-cat">{r.category} · ${fi(r.sale_price)}</div>
              <div className="pc-vis">{r.visible ? "✅ Visible" : "🚫 Oculto"}</div>
            </div>
            <div className="pc-actions">
              <button onClick={() => setEditing({ ...r })} title="Editar">{I.edit({ size: 16 })}</button>
              <button onClick={() => remove(r.id)} title="Eliminar" className="pc-del">{I.trash({ size: 16 })}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductForm({ recipe, onDone, onCancel }) {
  const [form, setForm]         = useState(recipe);
  const [saving, setSaving]     = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [allIngredients, setAllIngredients]     = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [loadingIng, setLoadingIng] = useState(false);

  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Cargar ingredientes al montar
  useEffect(() => {
    setLoadingIng(true);
    const tasks = [fetchIngredients()];
    if (recipe.id) tasks.push(fetchRecipeIngredients(recipe.id));
    Promise.all(tasks).then(([ings, recIng]) => {
      setAllIngredients(ings || []);
      if (recIng) setRecipeIngredients(recIng);
      setLoadingIng(false);
    });
  }, [recipe.id]);

  // Costo calculado de la receta
  const recipeCost = recipeIngredients.reduce((sum, ri) => {
    const ing = allIngredients.find(i => i.id === ri.ingredient_id);
    return sum + (ing ? Number(ri.quantity) * Number(ing.cost_per_unit) : 0);
  }, 0);

  const margin = (form.sale_price > 0 && recipeCost > 0)
    ? ((form.sale_price - recipeCost) / form.sale_price * 100).toFixed(1)
    : null;

  const addIngLine = () => {
    if (!allIngredients.length) return;
    setRecipeIngredients(prev => [
      ...prev,
      { ingredient_id: allIngredients[0].id, quantity: 1 }
    ]);
  };

  const updateIngLine = (idx, key, val) =>
    setRecipeIngredients(prev => prev.map((ri, i) => i === idx ? { ...ri, [key]: val } : ri));

  const removeIngLine = (idx) =>
    setRecipeIngredients(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim()) return;
    setSaving(true);
    const saved = await upsertRecipe(form);
    if (saved) {
      await saveRecipeIngredients(saved.id, recipeIngredients);
      await onDone();
    }
    setSaving(false);
  };

  return (
    <div>
      <button className="admin-back" onClick={onCancel}>{I.back({ size: 18 })} Volver</button>

      <div className="pf-tabs">
        <button className={`pf-tab ${activeTab === "info" ? "active" : ""}`} onClick={() => setActiveTab("info")}>
          📝 Info
        </button>
        <button className={`pf-tab ${activeTab === "cost" ? "active" : ""}`} onClick={() => setActiveTab("cost")}>
          💰 Costo
        </button>
      </div>

      {/* TAB INFO */}
      {activeTab === "info" && (
        <div className="pf-form">
          <h3>{form.id ? "Editar Producto" : "Nuevo Producto"}</h3>

          <label>Nombre</label>
          <input value={form.name} onChange={e => sf("name", e.target.value)} placeholder="Ej: Torta de Chocolate" />

          <label>Categoría</label>
          <input value={form.category} onChange={e => sf("category", e.target.value)} placeholder="Ej: Tortas, Alfajores, Budines" />

          <label>Precio de venta ($)</label>
          <input type="number" min="0" value={form.sale_price} onChange={e => sf("sale_price", Number(e.target.value))} />

          <label>Descripción</label>
          <textarea
            value={form.description || ""}
            onChange={e => sf("description", e.target.value)}
            placeholder="Descripción corta del producto"
            rows={3}
          />

          <label>URL de imagen</label>
          <input value={form.image_url || ""} onChange={e => sf("image_url", e.target.value)} placeholder="https://..." />
          {form.image_url && (
            <img className="pf-preview" src={form.image_url} alt="Preview" onError={e => { e.target.style.display = 'none'; }} />
          )}

          <label className="pf-toggle">
            <input type="checkbox" checked={form.visible} onChange={e => sf("visible", e.target.checked)} />
            <span>Visible en el catálogo</span>
          </label>

          <button className="login-btn" onClick={handleSave} disabled={!form.name || !form.category || saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}

      {/* TAB COSTO */}
      {activeTab === "cost" && (
        <div className="pf-form">
          <h3>Composición y Costo</h3>

          {recipeCost > 0 && (
            <div className="cost-summary">
              <div className="cost-row">
                <span>Costo de receta</span>
                <span>${fm(recipeCost)}</span>
              </div>
              <div className="cost-row">
                <span>Precio de venta</span>
                <span>${fi(form.sale_price)}</span>
              </div>
              {margin !== null && (
                <div className={`cost-row accent ${Number(margin) < 30 ? "low-margin" : ""}`}>
                  <span>Margen</span>
                  <span>{margin}%</span>
                </div>
              )}
            </div>
          )}

          {loadingIng ? (
            <p className="admin-msg">Cargando ingredientes...</p>
          ) : allIngredients.length === 0 ? (
            <div className="ing-empty">
              <p>Primero agregá ingredientes en la pestaña <strong>Stock</strong>.</p>
            </div>
          ) : (
            <>
              {recipeIngredients.map((ri, idx) => {
                const ing = allIngredients.find(i => i.id === ri.ingredient_id);
                const lineCost = ing ? Number(ri.quantity) * Number(ing.cost_per_unit) : 0;
                return (
                  <div key={idx} className="ing-line">
                    <select
                      value={ri.ingredient_id}
                      onChange={e => updateIngLine(idx, "ingredient_id", e.target.value)}
                      className="ing-line-select"
                    >
                      {allIngredients.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number" step="0.01" min="0"
                      value={ri.quantity}
                      onChange={e => updateIngLine(idx, "quantity", e.target.value)}
                      className="ing-line-qty"
                      placeholder="Cant."
                    />
                    <span className="ing-line-cost">
                      {ing ? `${ing.unit}` : ""}<br />
                      <strong>${fm(lineCost)}</strong>
                    </span>
                    <button className="ing-line-del" onClick={() => removeIngLine(idx)}>
                      {I.x({ size: 16 })}
                    </button>
                  </div>
                );
              })}

              <button className="admin-add-btn" onClick={addIngLine} style={{ marginTop: 8 }}>
                {I.plus({ size: 16 })} Agregar ingrediente
              </button>

              <button
                className="login-btn"
                onClick={handleSave}
                disabled={!form.name || !form.category || saving}
                style={{ marginTop: 8 }}
              >
                {saving ? "Guardando..." : "Guardar Todo"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CONFIGURACIÓN ────────────────────────────────────
function SettingsPanel() {
  const [sett, setSett] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchSettings().then(s => {
      setSett(s || { biz_name: "La Nona Pato", logo_letter: "N", logo_color: "#C45D3E", cover_url: "" });
      setLoading(false);
    });
  }, []);

  const sf = (k, v) => setSett(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const result = await updateSettings(sett);
    setSaving(false);
    setMsg(result ? "✅ Guardado" : "❌ Error al guardar");
    setTimeout(() => setMsg(""), 3000);
  };

  if (loading) return <p className="admin-msg">Cargando configuración...</p>;

  return (
    <div className="pf-form">
      <h3>Configuración de la Tienda</h3>
      {msg && <div className="settings-msg">{msg}</div>}

      <label>Nombre del negocio</label>
      <input value={sett.biz_name} onChange={e => sf("biz_name", e.target.value)} />

      <label>Letra del logo</label>
      <input value={sett.logo_letter} onChange={e => sf("logo_letter", e.target.value)} maxLength={2} />

      <label>Color del logo</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="color" value={sett.logo_color}
          onChange={e => sf("logo_color", e.target.value)}
          style={{ width: 48, height: 40, border: "none", cursor: "pointer" }}
        />
        <input value={sett.logo_color} onChange={e => sf("logo_color", e.target.value)} style={{ flex: 1 }} />
      </div>

      <label>URL de foto de portada</label>
      <input value={sett.cover_url || ""} onChange={e => sf("cover_url", e.target.value)} placeholder="https://..." />

      <div className="settings-preview">
        <div style={{
          background: sett.logo_color, width: 60, height: 60, borderRadius: 18,
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'DM Serif Display',serif", fontSize: 24
        }}>
          {sett.logo_letter}
        </div>
        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20 }}>{sett.biz_name}</span>
      </div>

      <button className="login-btn" onClick={save} disabled={saving}>
        {saving ? "Guardando..." : "Guardar Cambios"}
      </button>
    </div>
  );
}
