import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { I, fi } from "../lib/utils";
import { fetchCatalog, submitOrder, validateCouponPublic } from "../lib/catalogService";

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
  const navigate = useNavigate();

  // --- Estado de datos ---
  const [sett, setSett] = useState(fallbackSettings);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serverNow, setServerNow] = useState(null); // hora del servidor para validar horarios

  // --- Estado de UI ---
  const [selCat, setSelCat] = useState("Todos");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCk, setShowCk] = useState(false);
  const [sent, setSent] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", delivery: "retiro", payment: "efectivo", address: "", note: "", is_gift: false, gift_note: "", delivery_date: "", delivery_time: "" });
  const [scheduleMode, setScheduleMode] = useState("now"); // "now" | "later"

  // Fecha mínima para agendamiento: hoy o mañana si ya pasaron las 18:00
  // Usa hora del servidor si está disponible para evitar manipulación del reloj
  const minDate = useMemo(() => {
    const now = serverNow || new Date();
    const cutoff = new Date(now); cutoff.setHours(18, 0, 0, 0);
    const base = now >= cutoff ? new Date(now.getTime() + 86400000) : now;
    return base.toISOString().split("T")[0];
  }, [serverNow]);
  const [upsell, setUpsell] = useState(null); // {product, suggestions[]}
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null); // {id, discount_pct}
  const [couponErr, setCouponErr] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showTrackerInput, setShowTrackerInput] = useState(false);
  const [trackerCode, setTrackerCode] = useState("");

  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // --- Verificar si el local está abierto ahora según store_hours ---
  // Usa hora del servidor (serverNow) para evitar que el cliente manipule su reloj
  const storeStatus = useMemo(() => {
    const hrs = sett?.store_hours;
    if (!hrs) return { open: true, msg: "" }; // sin horarios configurados = siempre abierto
    const now = serverNow || new Date();
    const dayIdx = (now.getDay() + 6) % 7; // JS: 0=Dom → nuestro: 0=Lun
    const today = hrs[dayIdx];
    if (!today || today.closed) return { open: false, msg: "Hoy no abrimos" };
    if (!today.open || !today.close) return { open: true, msg: "" };
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = today.open.split(":").map(Number);
    const [ch, cm] = today.close.split(":").map(Number);
    const openMins = oh * 60 + om;
    const closeMins = ch * 60 + cm;
    if (nowMins < openMins) return { open: false, msg: `Abrimos a las ${today.open}` };
    if (nowMins >= closeMins) return { open: false, msg: `Cerramos a las ${today.close}. Podés programar tu pedido.` };
    return { open: true, msg: `Abierto hasta las ${today.close}` };
  }, [sett, serverNow]);
  // Si el local está cerrado, forzar modo "Programar"
  useEffect(() => {
    if (!storeStatus.open && scheduleMode === "now") setScheduleMode("later");
  }, [storeStatus.open]);

  // --- Cargar datos de Supabase al montar ---
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await fetchCatalog();
      if (data) {
        setSett(data.settings);
        setProducts(data.products);
        if (data.serverNow) setServerNow(new Date(data.serverNow));
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

  // Categorías únicas (memoizado)
  const categories = useMemo(() => ["Todos", ...new Set(products.map(r => r.category))], [products]);

  // Filtrar productos (memoizado)
  const filteredProds = useMemo(() => selCat === "Todos"
    ? products
    : products.filter(r => r.category === selCat), [selCat, products]);

  // Mapa rápido de cantidades en carrito: O(1) lookup en vez de O(n) find
  const cartQtyMap = useMemo(() => {
    const m = {};
    cart.forEach(i => { m[i.id] = i.qty; });
    return m;
  }, [cart]);

  // Totales del carrito (memoizado)
  const { cc, ctBase, discount, ct } = useMemo(() => {
    const cc = cart.reduce((s, i) => s + i.qty, 0);
    const ctBase = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const discount = coupon ? Math.round(ctBase * coupon.discount_pct / 100) : 0;
    const ct = ctBase - discount;
    return { cc, ctBase, discount, ct };
  }, [cart, coupon]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true); setCouponErr("");
    const result = await validateCouponPublic(couponCode, form.email);
    setValidatingCoupon(false);
    if (result) { setCoupon(result); setCouponErr(""); }
    else setCouponErr("Cupón inválido, vencido o no corresponde a tu email.");
  };

  // Obtener cantidad de un producto específico en el carrito (O(1) con mapa)
  const getQty = useCallback((id) => {
    return cartQtyMap[id] || 0;
  }, [cartQtyMap]);

  // Agregar al carrito (memoizado)
  const addC = useCallback((p, e) => {
    e.stopPropagation();
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.sale_price, qty: 1, img: p.image_url }];
    });
    // Upselling: mostrar sugerencias si el producto tiene related_ids
    if (p.related_ids && p.related_ids.length > 0) {
      const suggestions = products.filter(x => p.related_ids.includes(x.id));
      if (suggestions.length > 0) setUpsell({ product: p, suggestions: suggestions.slice(0, 3) });
    }
  }, [products]);

  // Agregar desde upsell y cerrar popup (memoizado)
  const addFromUpsell = useCallback((p) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.sale_price, qty: 1, img: p.image_url }];
    });
    setUpsell(null);
  }, []);

  // Actualizar cantidad en el carrito
  const updQ = (id, nq) => {
    if (nq <= 0) setCart(p => p.filter(i => i.id !== id));
    else setCart(p => p.map(i => i.id === id ? { ...i, qty: nq } : i));
  };

  // Enviar pedido a Supabase
  const send = async () => {
    setSending(true);
    // Construir nota con hora programada si aplica
    let finalNote = form.note || "";
    if (scheduleMode === "later" && form.delivery_time) {
      const timeTag = `[Hora programada: ${form.delivery_time}]`;
      finalNote = finalNote ? `${timeTag} ${finalNote}` : timeTag;
    }

    const orderData = {
      customer: form.name,
      phone: form.phone,
      email: form.email,
      delivery: form.delivery,
      payment: form.payment,
      address: form.address,
      note: finalNote,
      is_gift: form.is_gift,
      gift_note: form.is_gift ? form.gift_note : '',
      coupon_id: coupon?.id || null,
      discount: discount,
      total: ct,
      delivery_date: scheduleMode === "later" ? (form.delivery_date || null) : null,
      items: cart.map(i => ({
        recipeId: i.id,
        qty: i.qty,
        unitPrice: i.price
      }))
    };

    const result = await submitOrder(orderData);
    setSending(false);

    if (result?.ok) {
      setOrderId(result.orderId);
      setSent(true);
      setCart([]);
      setForm({ name: "", phone: "", email: "", delivery: "retiro", payment: "efectivo", address: "", note: "", is_gift: false, gift_note: "", delivery_date: "", delivery_time: "" });
      setScheduleMode("now");
      setCoupon(null); setCouponCode("");
    } else {
      console.warn("Pedido no se guardó en Supabase, pero se confirma al usuario.");
      setOrderId(null);
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
        <p style={{ fontSize: 15, color: "var(--t3)", lineHeight: 1.6, marginTop: 12 }}>
          Estamos preparando todo con mucho amor 🦆
        </p>
        {orderId && (<>
          <a href={`/order/${orderId}`} className="tracker-link-btn">
            🔴 Seguir mi pedido en vivo
          </a>
          <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--b2)", borderRadius: 12, textAlign: "left" }}>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 6 }}>📋 Código de tu pedido</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <code style={{ flex: 1, fontSize: 12, color: "var(--tx)", wordBreak: "break-all", background: "var(--bg)", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--b2)" }}>
                {orderId}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(orderId); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }}
                style={{ flexShrink: 0, padding: "6px 12px", background: copiedCode ? "var(--gn, #3A7D44)" : "var(--pr, #C45D3E)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", transition: "background .2s" }}
              >
                {copiedCode ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 8, marginBottom: 0 }}>Guardá este código para seguir tu pedido cuando quieras.</p>
          </div>
        </>)}
        <button className="abtn" onClick={() => { setSent(false); setOrderId(null); setShowCk(false); }} style={{ marginTop: 16, width: "100%", background: "transparent", color: "var(--t3)", border: "1.5px solid var(--b2)" }}>
          ← Volver a la tienda
        </button>
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
        <div className="cks"><div className="ckl">👤 Tus Datos</div><input className="cki" value={form.name} onChange={e => sf("name", e.target.value.slice(0, 200))} placeholder="Nombre y Apellido" /></div>
        <div className="cks">
          <input className="cki" type="tel" value={form.phone} onChange={e => sf("phone", e.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="Teléfono (Ej: 1155443322)" maxLength={15}/>
          {form.phone && form.phone.length < 10 && <p style={{fontSize:11,color:"#C62828",margin:"4px 0 0 4px"}}>Mínimo 10 dígitos · ({form.phone.length}/10)</p>}
        </div>
        <div className="cks"><input className="cki" type="email" value={form.email} onChange={e => sf("email", e.target.value.slice(0, 200))} placeholder="Email (opcional, para recibir tu pedido)" />
          {form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && <p style={{fontSize:11,color:"#C62828",margin:"4px 0 0 4px"}}>Email no válido</p>}
        </div>

        {/* Cuándo lo necesitás: Ahora o Programar */}
        <div className="cks">
          <div className="ckl">📅 ¿Para cuándo lo necesitás?</div>
          <div className="cko">
            <div className={`ckv ${scheduleMode === "now" ? "on" : ""} ${!storeStatus.open ? "dis" : ""}`} onClick={() => { if(!storeStatus.open){setScheduleMode("later");return;} setScheduleMode("now"); sf("delivery_date", ""); sf("delivery_time", ""); }}>Pedir ahora</div>
            <div className={`ckv ${scheduleMode === "later" ? "on" : ""}`} onClick={() => setScheduleMode("later")}>Programar</div>
          </div>
          {!storeStatus.open && <p style={{fontSize:12,color:"var(--rd)",margin:"6px 0 0 2px"}}>⏰ {storeStatus.msg}</p>}
          {storeStatus.open && storeStatus.msg && scheduleMode === "now" && <p style={{fontSize:11,color:"var(--gn)",margin:"4px 0 0 2px"}}>✓ {storeStatus.msg}</p>}
        </div>
        {scheduleMode === "later" && (
          <div className="cks" style={{background:"var(--b2)",borderRadius:12,padding:"12px 14px",marginTop:-4}}>
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1}}>
                <label style={{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:4,display:"block"}}>Fecha</label>
                <input className="cki" type="date" value={form.delivery_date} min={minDate} onChange={e => sf("delivery_date", e.target.value)} style={{colorScheme:"light"}} />
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:4,display:"block"}}>Hora (aprox.)</label>
                <input className="cki" type="time" value={form.delivery_time} onChange={e => sf("delivery_time", e.target.value)} style={{colorScheme:"light"}} />
              </div>
            </div>
            {!form.delivery_date && <p style={{fontSize:11,color:"var(--rd)",margin:"6px 0 0 2px"}}>Seleccioná fecha y hora para tu pedido</p>}
          </div>
        )}

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

        {/* Modo Regalo */}
        <div className="gift-box">
          <div className="gift-hd" onClick={() => sf("is_gift", !form.is_gift)}>
            <div className="gift-info">
              <span className="gift-icon">🎁</span>
              <div>
                <div className="gift-title">¿Es un regalo?</div>
                <div className="gift-sub">Incluimos una tarjeta especial</div>
              </div>
            </div>
            <div className={`gift-toggle ${form.is_gift ? "on" : ""}`}><div className="gift-thumb" /></div>
          </div>
          {form.is_gift && (
            <div className="gift-note-wrap">
              <textarea
                className="gift-note-input"
                placeholder="Escribí tu mensaje para la tarjeta... (máx. 200 caracteres)"
                maxLength={200}
                value={form.gift_note}
                onChange={e => sf("gift_note", e.target.value)}
              />
              <div className="gift-chars">{form.gift_note.length}/200</div>
            </div>
          )}
        </div>

        {/* Campo de cupón */}
        <div className="coupon-row">
          <input className="coupon-input" placeholder="Tenés un cupón? Ingresalo acá" value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null); setCouponErr(""); }} disabled={!!coupon}/>
          {!coupon
            ? <button className="coupon-btn" onClick={applyCoupon} disabled={validatingCoupon || !couponCode.trim()}>{validatingCoupon ? "..." : "Aplicar"}</button>
            : <button className="coupon-btn coupon-ok" onClick={() => { setCoupon(null); setCouponCode(""); }}>✓ -{coupon.discount_pct}%</button>
          }
        </div>
        {couponErr && <p className="coupon-err">{couponErr}</p>}

        {coupon && <div className="coupon-applied">🎉 Descuento <strong>{coupon.discount_pct}%</strong> aplicado — ahorrás <strong>${fi(discount)}</strong></div>}
        <div className="ct">
          {coupon && <><span style={{color:"var(--t3)",textDecoration:"line-through",fontSize:13}}>${fi(ctBase)}</span><span style={{flex:1}}/></>}
          <span>Total a pagar</span><span style={{ color: coupon?"var(--gn)":"var(--tx)",fontWeight:700 }}>${fi(ct)}</span>
        </div>
        <button className="abtn" style={{ width: "100%" }} disabled={!form.name.trim() || !form.phone || form.phone.length < 10 || (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) || (scheduleMode === "later" && !form.delivery_date) || (form.delivery === "envio" && !form.address.trim()) || sending || ct === 0} onClick={send}>
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
            <img className="ci-img" src={it.img} alt="" loading="lazy" />
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
        <button className="abtn" style={{ width: "100%" }} disabled={cc === 0 || ct === 0} onClick={() => { setShowCart(false); setShowCk(true); }}>Continuar</button>
      </div>
    </div>
  );

  const isOpen = sett.store_open !== false; // null/undefined = abierto por defecto

  // --- VISTA PRINCIPAL: CATÁLOGO ---
  return (
    <div className="app">
      {/* Banner de anuncios (si hay texto configurado) */}
      {sett.banner_text && (
        <div style={{ background: sett.banner_color || "#2D1B0E", color: "#fff", textAlign: "center", padding: "10px 20px", fontSize: 13, fontWeight: 600, letterSpacing: 0.2 }}>
          {sett.banner_text}
        </div>
      )}

      {/* Portada y Header */}
      <div className="store-cover" style={{ backgroundImage: `url(${sett.cover_url || fallbackSettings.cover_url})` }}></div>
      <div className="store-header">
        <div className="store-logo" style={{ background: sett.logo_color || fallbackSettings.logo_color }}>{sett.logo_letter || fallbackSettings.logo_letter}</div>
        <div className="store-info">
          <h1 className="store-name">{sett.biz_name || fallbackSettings.biz_name}</h1>
          <div className="store-status" style={{ color: isOpen ? "#3A7D44" : "#C62828" }}>
            {isOpen ? "● Abierto ahora" : "● Cerrado por hoy"}
          </div>
        </div>
      </div>

      {/* Botón Seguí tu pedido */}
      <div style={{ margin: "0 16px 4px" }}>
        {!showTrackerInput ? (
          <button
            onClick={() => setShowTrackerInput(true)}
            style={{ width: "100%", padding: "10px 16px", background: "var(--b2)", border: "none", borderRadius: 12, fontSize: 13, color: "var(--t3)", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}
          >
            🦆 <span>¿Ya hiciste un pedido? <strong style={{ color: "var(--tx)" }}>Seguí tu pedido →</strong></span>
          </button>
        ) : (
          <div style={{ background: "var(--b2)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>🦆 Seguí tu pedido</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ flex: 1, padding: "8px 12px", border: "1.5px solid var(--b2)", borderRadius: 10, fontSize: 13, background: "var(--bg)", color: "var(--tx)", outline: "none" }}
                placeholder="Pegá tu código de pedido..."
                value={trackerCode}
                onChange={e => setTrackerCode(e.target.value.trim())}
                onKeyDown={e => e.key === "Enter" && trackerCode && navigate(`/order/${trackerCode}`)}
                autoFocus
              />
              <button
                onClick={() => trackerCode && navigate(`/order/${trackerCode}`)}
                disabled={!trackerCode}
                style={{ padding: "8px 16px", background: "#C45D3E", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: trackerCode ? "pointer" : "not-allowed", opacity: trackerCode ? 1 : 0.5 }}
              >
                Ir
              </button>
              <button
                onClick={() => { setShowTrackerInput(false); setTrackerCode(""); }}
                style={{ padding: "8px 10px", background: "transparent", border: "1.5px solid var(--b2)", borderRadius: 10, fontSize: 13, cursor: "pointer", color: "var(--t3)" }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Banner offline */}
      {error === "offline" && (
        <div style={{ margin: "0 20px 8px", padding: "10px 16px", background: "#FFF8E1", borderRadius: 12, fontSize: 13, color: "#8D6E00", textAlign: "center" }}>
          ⚠️ Modo offline — mostrando productos de ejemplo
        </div>
      )}

      {/* Banner tienda cerrada */}
      {!isOpen && (
        <div style={{ margin: "0 16px 12px", padding: "14px 18px", background: "#FFEBEE", borderRadius: 14, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🌙</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#C62828" }}>Estamos cerrados por hoy</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>Volvemos pronto. Podés ver el catálogo pero los pedidos están deshabilitados.</div>
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
                  <button className={`btn-add ${inCartQty > 0 ? 'has-qty' : ''} ${!isOpen ? 'disabled' : ''}`} onClick={(e) => isOpen && addC(p, e)} disabled={!isOpen} style={!isOpen ? { opacity: 0.4, cursor: "not-allowed" } : {}}>
                    {inCartQty > 0 ? inCartQty : I.plus({ size: 16 })}
                  </button>
                </div>
              </div>
              <img className="prod-img" src={p.image_url} alt={p.name} loading="lazy" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
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

      {/* Popup de Upselling */}
      {upsell && (
        <div className="ups-overlay" onClick={() => setUpsell(null)}>
          <div className="ups-sheet" onClick={e => e.stopPropagation()}>
            <div className="ups-drag" />
            <p className="ups-added">✓ <strong>{upsell.product.name}</strong> agregado</p>
            <h3 className="ups-title">¿Le sumás algo más?</h3>
            <div className="ups-list">
              {upsell.suggestions.map(s => (
                <div key={s.id} className="ups-card" onClick={() => addFromUpsell(s)}>
                  <img className="ups-img" src={s.image_url} alt={s.name} loading="lazy" onError={e => { e.target.style.display='none'; }} />
                  <div className="ups-info">
                    <div className="ups-name">{s.name}</div>
                    <div className="ups-price">${fi(s.sale_price)}</div>
                  </div>
                  <button className="ups-btn">+</button>
                </div>
              ))}
            </div>
            <button className="ups-skip" onClick={() => setUpsell(null)}>No, gracias</button>
          </div>
        </div>
      )}
    </div>
  );
}