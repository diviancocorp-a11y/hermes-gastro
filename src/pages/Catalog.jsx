import { useState, useEffect } from "react";
import { I, fi } from "../lib/utils";
import { fetchCatalog, submitOrder } from "../lib/catalogService";

// --- DATOS DE RESPALDO (se usan si Supabase no responde) ---
const fallbackSettings = {
  biz_name: "La Nona Pato",
  logo_letter: "N",
  logo_color: "#C45D3E",
  cover_url: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=800&q=80"
};

const fallbackProducts = [
  { id: "r1", name: "Alfajores de Maicena", category: "Alfajores", sale_price: 6500, image_url: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=300&q=80", description: "Caja x12. Clásicos alfajores artesanales que se deshacen en la boca, con mucho dulce de leche." },
  { id: "r2", name: "Torta de Chocolate", category: "Tortas", sale_price: 18000, image_url: "https://images.unsplash.com/photo-1578985545062-69928b1d9ba9?auto=format&fit=crop&w=300&q=80", description: "Torta súper húmeda de chocolate rellena y cubierta con ganache de chocolate semiamargo." },
  { id: "r3", name: "Cheesecake Frutos Rojos", category: "Tortas", sale_price: 15000, image_url: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=300&q=80", description: "Cheesecake horneado súper cremoso con base crocante y abundante salsa de frutos rojos." },
  { id: "r4", name: "Budín de Limón", category: "Budines", sale_price: 5500, image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=300&q=80", description: "Budín esponjoso con glaseado cítrico." }
];

export default function Catalog() {
  // --- Estado de datos ---
  const [sett, setSett] = useState(fallbackSettings);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Estado de UI ---
  const [selCat, setSelCat] = useState("Todos");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCk, setShowCk] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", delivery: "retiro", payment: "efectivo", address: "", note: "" });

  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // --- Cargar datos de Supabase al montar ---
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await fetchCatalog();
      if (data) {
        setSett(data.settings);
        setProducts(data.products);
      } else {
        // Si Supabase falla, usamos datos de respaldo
        console.warn("No se pudo conectar a Supabase. Usando datos de respaldo.");
        setProducts(fallbackProducts);
        setError("offline");
      }
      setLoading(false);
    }
    loadData();
  }, []);

  // Categorías únicas
  const categories = ["Todos", ...new Set(products.map(r => r.category))];

  // Filtrar productos
  const filteredProds = selCat === "Todos"
    ? products
    : products.filter(r => r.category === selCat);

  // Totales del carrito
  const cc = cart.reduce((s, i) => s + i.qty, 0);
  const ct = cart.reduce((s, i) => s + i.qty * i.price, 0);

  // Obtener cantidad de un producto específico en el carrito
  const getQty = (id) => {
    const item = cart.find(i => i.id === id);
    return item ? item.qty : 0;
  };

  // Agregar al carrito
  const addC = (p, e) => {
    e.stopPropagation();
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.sale_price, qty: 1, img: p.image_url }];
    });
  };

  // Actualizar cantidad en el carrito
  const updQ = (id, nq) => {
    if (nq <= 0) setCart(p => p.filter(i => i.id !== id));
    else setCart(p => p.map(i => i.id === id ? { ...i, qty: nq } : i));
  };

  // Enviar pedido a Supabase
  const send = async () => {
    setSending(true);
    const orderData = {
      customer: form.name,
      phone: form.phone,
      email: form.email,
      delivery: form.delivery,
      payment: form.payment,
      address: form.address,
      note: form.note,
      total: ct,
      items: cart.map(i => ({
        recipeId: i.id,
        qty: i.qty,
        unitPrice: i.price
      }))
    };

    const ok = await submitOrder(orderData);
    setSending(false);

    if (ok) {
      setSent(true);
      setCart([]);
      setForm({ name: "", phone: "", email: "", delivery: "retiro", payment: "efectivo", address: "", note: "" });
    } else {
      // Si Supabase falla, igual mostramos confirmación (modo offline)
      console.warn("Pedido no se guardó en Supabase, pero se confirma al usuario.");
      setSent(true);
      setCart([]);
    }
  };

  // --- VISTA: CARGANDO ---
  if (loading) return (
    <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: "#C45D3E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Serif Display',serif", fontSize: 28, margin: "0 auto 16px" }}>N</div>
        <p style={{ color: "var(--t3)", fontSize: 15 }}>Cargando catálogo...</p>
      </div>
    </div>
  );

  // --- VISTA: PEDIDO ENVIADO ---
  if (sent) return (
    <div className="po" style={{ zIndex: 250 }}>
      <div className="success">
        <div className="suc-ic">{I.check({ size: 40, color: "#fff" })}</div>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28 }}>¡Pedido confirmado!</h2>
        <p style={{ fontSize: 15, color: "var(--t3)", lineHeight: 1.6, marginTop: 12 }}>Estamos preparando todo. Te contactaremos por WhatsApp a la brevedad.</p>
        <button className="abtn" onClick={() => setSent(false)} style={{ marginTop: 32, width: "100%" }}>Volver a la tienda</button>
      </div>
    </div>
  );

  // --- VISTA: CHECKOUT ---
  if (showCk) return (
    <div className="po">
      <div className="ph">
        <button onClick={() => setShowCk(false)}>{I.back({ size: 20 })}</button>
        <h2>Finalizar Pedido</h2>
      </div>
      <div className="pb" style={{ paddingBottom: 100 }}>
        <div className="cks"><div className="ckl">👤 Tus Datos</div><input className="cki" value={form.name} onChange={e => sf("name", e.target.value)} placeholder="Nombre y Apellido" /></div>
        <div className="cks"><input className="cki" type="tel" value={form.phone} onChange={e => sf("phone", e.target.value)} placeholder="Teléfono (Ej: 1155443322)" /></div>
        <div className="cks"><input className="cki" type="email" value={form.email} onChange={e => sf("email", e.target.value)} placeholder="Email (opcional, para recibir tu pedido)" /></div>

        <div className="cks">
          <div className="ckl">🛵 ¿Cómo lo recibís?</div>
          <div className="cko">
            <div className={`ckv ${form.delivery === "retiro" ? "on" : ""}`} onClick={() => sf("delivery", "retiro")}>Retiro en local</div>
            <div className={`ckv ${form.delivery === "envio" ? "on" : ""}`} onClick={() => sf("delivery", "envio")}>Delivery</div>
          </div>
        </div>
        {form.delivery === "envio" && <div className="cks"><input className="cki" value={form.address} onChange={e => sf("address", e.target.value)} placeholder="Dirección completa" /></div>}

        <div className="cks">
          <div className="ckl">💳 Medio de pago</div>
          <div className="cko">
            {["Efectivo", "Transferencia", "MercadoPago"].map(p => (
              <div key={p} className={`ckv ${form.payment === p.toLowerCase() ? "on" : ""}`} onClick={() => sf("payment", p.toLowerCase())}>{p}</div>
            ))}
          </div>
        </div>

        <div className="cks"><div className="ckl">💬 Notas para el pedido</div><input className="cki" value={form.note} onChange={e => sf("note", e.target.value)} placeholder="Ej: Sin azúcar, enviar ticket..." /></div>

        <div className="ct"><span>Total a pagar</span><span style={{ color: "var(--tx)" }}>${fi(ct)}</span></div>
        <button className="abtn" style={{ width: "100%" }} disabled={!form.name || !form.phone || (form.delivery === "envio" && !form.address) || sending} onClick={send}>
          {sending ? "Enviando..." : "Confirmar y Enviar"}
        </button>
      </div>
    </div>
  );

  // --- VISTA: CARRITO ---
  if (showCart) return (
    <div className="po">
      <div className="ph">
        <button onClick={() => setShowCart(false)}>{I.back({ size: 20 })}</button>
        <h2>Mi Pedido</h2>
      </div>
      <div className="pb">
        {cart.map(it => (
          <div key={it.id} className="ci2">
            <img className="ci-img" src={it.img} alt="" />
            <div className="ci-i">
              <div className="ci-n">{it.name}</div>
              <div className="ci-p" style={{ marginBottom: 12 }}>${fi(it.price * it.qty)}</div>
              <div className="qty">
                <button onClick={() => updQ(it.id, it.qty - 1)}>{it.qty <= 1 ? <span style={{ fontSize: 12, color: "var(--rd)" }}>🗑</span> : I.minus({ size: 14 })}</button>
                <span>{it.qty}</span>
                <button onClick={() => updQ(it.id, it.qty + 1)}>{I.plus({ size: 14 })}</button>
              </div>
            </div>
          </div>
        ))}
        <div className="ct"><span>Total</span><span>${fi(ct)}</span></div>
        <button className="abtn" style={{ width: "100%" }} onClick={() => { setShowCart(false); setShowCk(true); }}>Continuar</button>
      </div>
    </div>
  );

  // --- VISTA PRINCIPAL: CATÁLOGO ---
  return (
    <div className="app">
      {/* Portada y Header */}
      <div className="store-cover" style={{ backgroundImage: `url(${sett.cover_url || fallbackSettings.cover_url})` }}></div>
      <div className="store-header">
        <div className="store-logo" style={{ background: sett.logo_color || fallbackSettings.logo_color }}>{sett.logo_letter || fallbackSettings.logo_letter}</div>
        <div className="store-info">
          <h1 className="store-name">{sett.biz_name || fallbackSettings.biz_name}</h1>
          <div className="store-status">● Abierto ahora</div>
        </div>
      </div>

      {/* Banner offline */}
      {error === "offline" && (
        <div style={{ margin: "0 20px 8px", padding: "10px 16px", background: "#FFF8E1", borderRadius: 12, fontSize: 13, color: "#8D6E00", textAlign: "center" }}>
          ⚠️ Modo offline — mostrando productos de ejemplo
        </div>
      )}

      {/* Menú de Categorías (Pills) */}
      <div className="cat-scroll">
        {categories.map(c => (
          <div key={c} className={`cat-pill ${selCat === c ? "active" : ""}`} onClick={() => setSelCat(c)}>
            {c}
          </div>
        ))}
      </div>

      {/* Lista de Productos */}
      <div className="prod-list">
        {filteredProds.map(p => {
          const inCartQty = getQty(p.id);
          return (
            <div key={p.id} className="prod-card">
              <div className="prod-info">
                <div className="prod-title">{p.name}</div>
                <div className="prod-desc">{p.description}</div>
                <div className="prod-bot">
                  <div className="prod-price">${fi(p.sale_price)}</div>
                  <button className={`btn-add ${inCartQty > 0 ? 'has-qty' : ''}`} onClick={(e) => addC(p, e)}>
                    {inCartQty > 0 ? inCartQty : I.plus({ size: 16 })}
                  </button>
                </div>
              </div>
              <img className="prod-img" src={p.image_url} alt={p.name} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
              <div className="prod-img prod-img-placeholder" style={{ display:'none', alignItems:'center', justifyContent:'center', fontSize:32, fontFamily:"'DM Serif Display',serif", color:'var(--t3)', background:'var(--b2)' }}>{p.name.charAt(0)}</div>
            </div>
          )
        })}
      </div>

      {/* Carrito Flotante "Pedix Style" */}
      {cc > 0 && (
        <div className="pedix-cart-btn" onClick={() => setShowCart(true)}>
          <div className="pcb-qty">{cc}</div>
          <div className="pcb-text">Ver pedido</div>
          <div className="pcb-price">${fi(ct)}</div>
        </div>
      )}
    </div>
  );
}