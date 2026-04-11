import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { I, fi, saleCode, imgOpt } from "../lib/utils";
import { fetchCatalog, submitOrder, validateCouponPublic } from "../lib/catalogService";
import { supabase } from "../lib/supabase";

// --- CATEGORÍAS MADRE (agrupan subcategorías de Supabase) ---
const CAT_GROUPS = [
  { name: "Primeros Mimos",         icon: "🫕", subs: ["Brusquetas", "Escabeches", "Aperitivos"] },
  { name: "La Mesa Principal",      icon: "🍕", subs: ["Rotisería", "Pizzas"] },
  { name: "El Sanguche de la Nona", icon: "🥪", subs: ["Sandwiches"] },
  { name: "La Nona Amasó",          icon: "🥖", subs: ["Panadería", "Panificados"] },
  { name: "La Última Mordida",      icon: "🍰", subs: ["Tortas", "torta", "Budines", "Alfajores"] },
  { name: "Cocina Consciente",      icon: "🥗", subs: ["Saludable"] },
];
// Mapa inverso: subcategoría → categoría madre
const SUB_TO_PARENT = {};
CAT_GROUPS.forEach(g => g.subs.forEach(s => { SUB_TO_PARENT[s] = g.name; }));

// --- DESCUENTOS ROTATIVOS POR CATEGORÍA MADRE (Lunes a Jueves, 15% OFF) ---
// dayIdx: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves  (JS getDay: 1-4)
const DAILY_DEALS = {
  1: ["La Nona Amasó", "La Mesa Principal"],              // Lunes
  2: ["La Última Mordida"],                                // Martes
  3: ["El Sanguche de la Nona", "Primeros Mimos"],         // Miércoles
  4: ["Cocina Consciente", "Primeros Mimos"],              // Jueves
};
const DEAL_PCT = 15; // porcentaje de descuento

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
  const [orderErr, setOrderErr] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", delivery: "retiro", payment: "efectivo", address: "", note: "", is_gift: false, gift_note: "", delivery_date: "", delivery_time: "", change_amount: "" });
  const [scheduleMode, setScheduleMode] = useState("now"); // "now" | "later"
  const [ckStep, setCkStep] = useState(0); // 0=Datos, 1=Entrega, 2=Pago, 3=Resumen
  const [faqOpen, setFaqOpen] = useState(null); // índice de FAQ abierta
  const [receiptFile, setReceiptFile] = useState(null); // comprobante subido
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [verifyingReceipt, setVerifyingReceipt] = useState(false);
  const [receiptStatus, setReceiptStatus] = useState(""); // "" | "ok" | "error"

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
  const [showMenu, setShowMenu] = useState(false);

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

  // Categorías madre con descuento del día (usa hora del servidor)
  const dealCats = useMemo(() => {
    const now = serverNow || new Date();
    const dow = now.getDay(); // 0=Dom, 1=Lun ... 4=Jue
    return new Set(DAILY_DEALS[dow] || []);
  }, [serverNow]);

  // Categorías madre con imagen: prioridad settings > primer producto con foto
  const categories = useMemo(() => {
    const catImgs = sett.cat_images || {};
    const existingSubs = new Set(products.map(r => r.category));
    const hiddenCats = new Set(sett.hidden_cats || []);
    const catNames = sett.cat_names || {};
    const catData = CAT_GROUPS
      .filter(g => !hiddenCats.has(g.name) && g.subs.some(s => existingSubs.has(s)))
      .map(g => {
        const customImg = catImgs[g.name];
        const rep = !customImg ? products.find(p => g.subs.includes(p.category) && p.image_url) : null;
        const displayName = catNames[g.name] || g.name;
        return { name: g.name, displayName, icon: g.icon, subs: g.subs, img: customImg || rep?.image_url || null, deal: dealCats.has(g.name) };
      });
    return [{ name: "Todos", icon: "🏠", subs: [], img: catImgs["Todos"] || null, deal: false, displayName: "Todos" }, ...catData];
  }, [products, dealCats, sett]);

  // Helper: ¿un producto pertenece a una categoría madre con descuento?
  const hasDeal = useCallback((p) => {
    const parent = SUB_TO_PARENT[p.category];
    return parent ? dealCats.has(parent) : false;
  }, [dealCats]);

  // Precio con descuento del día aplicado (basado en categoría madre)
  const getPrice = useCallback((p) => {
    if (hasDeal(p)) return Math.round(p.sale_price * (1 - DEAL_PCT / 100));
    return p.sale_price;
  }, [hasDeal]);

  // Filtrar productos por categoría madre seleccionada
  const filteredProds = useMemo(() => {
    if (selCat === "Todos") return products;
    const group = CAT_GROUPS.find(g => g.name === selCat);
    if (!group) return products;
    return products.filter(r => group.subs.includes(r.category));
  }, [selCat, products]);

  // Colores para avatares de productos sin imagen
  const avatarColors = useMemo(() => [
    "#C45D3E", "#3A7D44", "#8D6E00", "#5C6BC0", "#AB47BC",
    "#00897B", "#D84315", "#6D4C41", "#546E7A", "#7B1FA2"
  ], []);

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

  // Agregar al carrito (memoizado) — usa precio con descuento del día
  const addC = useCallback((p, e) => {
    e.stopPropagation();
    const finalPrice = getPrice(p);
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: finalPrice, qty: 1, img: p.image_url }];
    });
    // Upselling: mostrar sugerencias si el producto tiene related_ids
    if (p.related_ids && p.related_ids.length > 0) {
      const suggestions = products.filter(x => p.related_ids.includes(x.id));
      if (suggestions.length > 0) setUpsell({ product: p, suggestions: suggestions.slice(0, 3) });
    }
  }, [products, getPrice]);

  // Agregar desde upsell y cerrar popup (memoizado)
  const addFromUpsell = useCallback((p) => {
    const finalPrice = getPrice(p);
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: finalPrice, qty: 1, img: p.image_url }];
    });
    setUpsell(null);
  }, [getPrice]);

  // Actualizar cantidad en el carrito
  const updQ = (id, nq) => {
    if (nq <= 0) setCart(p => p.filter(i => i.id !== id));
    else setCart(p => p.map(i => i.id === id ? { ...i, qty: nq } : i));
  };

  // Enviar pedido a Supabase
  const send = async () => {
    setSending(true); setOrderErr("");
    // Construir nota con hora programada si aplica
    let finalNote = form.note || "";
    if (scheduleMode === "later" && form.delivery_time) {
      const timeTag = `[Hora programada: ${form.delivery_time}]`;
      finalNote = finalNote ? `${timeTag} ${finalNote}` : timeTag;
    }
    // Agregar monto de cambio para efectivo
    if (form.payment === "efectivo" && form.change_amount) {
      const changeTag = form.change_amount === "justo" ? "[Pago justo]" : `[Paga con $${form.change_amount}]`;
      finalNote = finalNote ? `${changeTag} ${finalNote}` : changeTag;
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
      // Si pagó con transferencia/MP y subió comprobante, subirlo al storage
      if (receiptFile && result.orderId && (form.payment === "transferencia" || form.payment === "mercadopago")) {
        try {
          const ext = receiptFile.name.split(".").pop() || "jpg";
          const path = `receipts/${result.orderId}.${ext}`;
          await supabase.storage.from("receipts").upload(path, receiptFile, { upsert: true });
          // Guardar referencia en la orden
          await supabase.from("orders").update({ receipt_url: path }).eq("id", result.orderId);
        } catch (e) {
          console.warn("Error subiendo comprobante (no bloquea):", e);
        }
      }
      setOrderId(result.orderId);
      setSent(true);
      setCart([]);
      setForm({ name: "", phone: "", email: "", delivery: "retiro", payment: "efectivo", address: "", note: "", is_gift: false, gift_note: "", delivery_date: "", delivery_time: "", change_amount: "" });
      setScheduleMode("now");
      setCoupon(null); setCouponCode("");
      setCkStep(0);
      setReceiptFile(null); setReceiptPreview(null); setReceiptStatus("");
    } else {
      console.error("Pedido no se guardó en Supabase.");
      setOrderErr("No pudimos procesar tu pedido. Revisá tu conexión e intentá de nuevo.");
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
  if (sent) {
    const wasPaidDigital = form.payment === "transferencia" || form.payment === "mercadopago";
    return (
    <div className="po" style={{ zIndex: 250 }}>
      <div className="success">
        <div className="suc-ic">{I.check({ size: 40, color: "#fff" })}</div>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28 }}>¡Pedido confirmado!</h2>
        <p style={{ fontSize: 15, color: "var(--t3)", lineHeight: 1.6, marginTop: 12 }}>
          {wasPaidDigital && receiptFile
            ? "Tu comprobante fue recibido. Lo estamos verificando y tu pedido pasará a preparación en breve."
            : wasPaidDigital
            ? "Recordá subir el comprobante de pago para que procesemos tu pedido más rápido."
            : "Estamos preparando todo con mucho amor 🦆"}
        </p>
        {orderId && (<>
          <a href={`/order/${orderId}`} className="tracker-link-btn">
            🔴 Seguir mi pedido en vivo
          </a>
          <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--b2)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 6 }}>📋 Código de tu pedido</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <code style={{ fontSize: 22, fontWeight: 700, color: "var(--tx)", letterSpacing: 2, fontFamily: "'DM Serif Display',monospace" }}>
                {saleCode(orderId)}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(saleCode(orderId)); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }}
                style={{ flexShrink: 0, padding: "6px 12px", background: copiedCode ? "var(--gn, #3A7D44)" : "var(--pr, #C45D3E)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", transition: "background .2s" }}
              >
                {copiedCode ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 8, marginBottom: 0 }}>Usá este código para reclamos, factura o seguimiento.</p>
          </div>
        </>)}
        {wasPaidDigital && (
          <a href="https://wa.me/5491165706805?text=Hola!%20Acabo%20de%20hacer%20un%20pedido%20y%20tengo%20una%20consulta" target="_blank" rel="noopener noreferrer"
            style={{display:"block",marginTop:14,padding:"10px 16px",background:"#25D366",color:"#fff",borderRadius:12,fontSize:13,fontWeight:600,textAlign:"center",textDecoration:"none"}}>
            💬 ¿Dudas? Escribinos por WhatsApp
          </a>
        )}
        <button onClick={() => { setSent(false); setOrderId(null); setShowCk(false); }} style={{ marginTop: 14, fontSize: 12, color: "var(--t3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 4 }}>
          ← Volver a la tienda
        </button>
      </div>
    </div>
  );
  }

  // --- VISTA: CHECKOUT STEPPER ---
  if (showCk) {
    const STEPS = ["Datos", "Entrega", "Pago", "Resumen"];
    const canNext0 = form.name.trim().length >= 2 && form.phone.length >= 10 && (!form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email));
    const canNext1 = form.delivery === "retiro" || (form.delivery === "envio" && form.address.trim().length > 3);
    const canNext2 = !!form.payment && (form.payment !== "efectivo" || true);
    const needsReceipt = form.payment === "transferencia" || form.payment === "mercadopago";
    const goNext = () => setCkStep(s => Math.min(s + 1, 3));
    const goBack = () => { if (ckStep === 0) { setShowCk(false); setCkStep(0); } else setCkStep(s => s - 1); };

    return (
    <div className="po">
      <div className="ph">
        <button onClick={goBack}>{I.back({ size: 20 })}</button>
        <h2>{STEPS[ckStep]}</h2>
        <span style={{fontSize:12,color:"var(--t3)",fontWeight:600}}>{ckStep+1}/{STEPS.length}</span>
      </div>

      {/* Stepper indicator */}
      <div className="ck-stepper">
        {STEPS.map((s, i) => (
          <div key={s} className={`ck-step ${i < ckStep ? "done" : ""} ${i === ckStep ? "active" : ""}`}>
            <div className="ck-step-dot">{i < ckStep ? "✓" : i + 1}</div>
            <span className="ck-step-label">{s}</span>
          </div>
        ))}
        <div className="ck-step-line" style={{width: `${(ckStep / (STEPS.length - 1)) * 100}%`}} />
      </div>

      <div className="pb" style={{ paddingBottom: 120 }}>

        {/* ─── PASO 0: DATOS ─── */}
        {ckStep === 0 && <>
          <div className="cks">
            <div className="ckl">👤 Tus datos</div>
            <input className="cki" value={form.name} onChange={e => sf("name", e.target.value.slice(0, 200))} placeholder="Nombre y Apellido" autoFocus />
          </div>
          <div className="cks">
            <input className="cki" type="tel" value={form.phone} onChange={e => sf("phone", e.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="Teléfono (Ej: 1155443322)" maxLength={15}/>
            {form.phone && form.phone.length < 10 && <p style={{fontSize:11,color:"#C62828",margin:"4px 0 0 4px"}}>Mínimo 10 dígitos · ({form.phone.length}/10)</p>}
          </div>
          <div className="cks">
            <input className="cki" type="email" value={form.email} onChange={e => sf("email", e.target.value.slice(0, 200))} placeholder="Email (opcional, para recibir tu pedido)" />
            {form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && <p style={{fontSize:11,color:"#C62828",margin:"4px 0 0 4px"}}>Email no válido</p>}
          </div>

          {/* Cuándo lo necesitás */}
          <div className="cks">
            <div className="ckl">📅 ¿Para cuándo?</div>
            <div className="cko">
              <div className={`ckv ${scheduleMode === "now" ? "on" : ""} ${!storeStatus.open ? "dis" : ""}`} onClick={() => { if(!storeStatus.open){setScheduleMode("later");return;} setScheduleMode("now"); sf("delivery_date", ""); sf("delivery_time", ""); }}>Ahora</div>
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
              {!form.delivery_date && <p style={{fontSize:11,color:"var(--rd)",margin:"6px 0 0 2px"}}>Elegí fecha y hora</p>}
            </div>
          )}

          <button className="abtn ck-next" disabled={!canNext0 || (scheduleMode === "later" && !form.delivery_date)} onClick={goNext}>Siguiente →</button>
        </>}

        {/* ─── PASO 1: ENTREGA ─── */}
        {ckStep === 1 && <>
          <div className="cks">
            <div className="ckl">🛵 ¿Cómo lo recibís?</div>
            <div className="cko" style={{flexDirection:"column"}}>
              <div className={`ckv-card ${form.delivery === "retiro" ? "on" : ""}`} onClick={() => sf("delivery", "retiro")}>
                <div style={{fontSize:22,marginBottom:6}}>🏠</div>
                <div style={{fontWeight:700,fontSize:14}}>Retiro en local</div>
                <div style={{fontSize:12,color:"var(--t3)",marginTop:4,lineHeight:1.4}}>Andrés Chazarreta 1435, Villa Rosa, Pilar, Buenos Aires</div>
              </div>
              <div className={`ckv-card ${form.delivery === "envio" ? "on" : ""}`} onClick={() => sf("delivery", "envio")}>
                <div style={{fontSize:22,marginBottom:6}}>🚚</div>
                <div style={{fontWeight:700,fontSize:14}}>Delivery</div>
                <div style={{fontSize:12,color:"var(--t3)",marginTop:4}}>Te lo llevamos a tu dirección</div>
              </div>
            </div>
          </div>

          {form.delivery === "retiro" && (
            <div className="ck-pickup-info">
              <div style={{fontSize:13,fontWeight:700,color:"var(--tx)",marginBottom:8}}>📍 Dirección de retiro</div>
              <div style={{fontSize:14,color:"var(--t2)",lineHeight:1.5}}>Andrés Chazarreta 1435<br/>Villa Rosa, Pilar<br/>Buenos Aires</div>
              <a href="https://maps.google.com/?q=Andrés+Chazarreta+1435+Villa+Rosa+Pilar+Buenos+Aires" target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:10,fontSize:13,color:"var(--ac)",fontWeight:600,textDecoration:"none"}}>
                📌 Ver en Google Maps
              </a>
            </div>
          )}

          {form.delivery === "envio" && (
            <div className="cks">
              <div className="ckl">📍 Tu dirección</div>
              <div style={{position:"relative"}}>
                <input className="cki" value={form.address} onChange={e => sf("address", e.target.value)} placeholder="Calle, número, piso, localidad..." style={{paddingRight:44}} />
                <button onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition(async (pos) => {
                    try {
                      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
                      const d = await r.json();
                      if (d.display_name) sf("address", d.display_name.split(",").slice(0,4).join(","));
                    } catch {}
                  }, () => {}, {enableHighAccuracy:true});
                }} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"var(--ac)",border:"none",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16}} title="Usar mi ubicación">
                  📍
                </button>
              </div>
              {form.address && form.address.length < 5 && <p style={{fontSize:11,color:"var(--rd)",margin:"4px 0 0 4px"}}>Ingresá una dirección más completa</p>}
            </div>
          )}

          <div className="cks"><div className="ckl">💬 Notas</div><input className="cki" value={form.note} onChange={e => sf("note", e.target.value)} placeholder="Ej: Sin azúcar, timbre 2B..." /></div>

          <button className="abtn ck-next" disabled={!canNext1} onClick={goNext}>Siguiente →</button>
        </>}

        {/* ─── PASO 2: PAGO ─── */}
        {ckStep === 2 && <>
          <div className="cks">
            <div className="ckl">💳 Medio de pago</div>
            <div className="cko" style={{flexDirection:"column"}}>
              <div className={`ckv-card ${form.payment === "efectivo" ? "on" : ""}`} onClick={() => { sf("payment", "efectivo"); setReceiptFile(null); setReceiptPreview(null); setReceiptStatus(""); }}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>💵</span>
                  <div><div style={{fontWeight:700,fontSize:14}}>Efectivo</div><div style={{fontSize:12,color:"var(--t3)"}}>Pagás al recibir</div></div>
                </div>
              </div>
              <div className={`ckv-card ${form.payment === "transferencia" ? "on" : ""}`} onClick={() => { sf("payment", "transferencia"); setReceiptFile(null); setReceiptPreview(null); setReceiptStatus(""); }}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>🏦</span>
                  <div><div style={{fontWeight:700,fontSize:14}}>Transferencia</div><div style={{fontSize:12,color:"var(--t3)"}}>Transferí y subí el comprobante</div></div>
                </div>
              </div>
              <div className={`ckv-card ${form.payment === "mercadopago" ? "on" : ""}`} onClick={() => { sf("payment", "mercadopago"); setReceiptFile(null); setReceiptPreview(null); setReceiptStatus(""); }}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>📱</span>
                  <div><div style={{fontWeight:700,fontSize:14}}>MercadoPago</div><div style={{fontSize:12,color:"var(--t3)"}}>Pagá con alias y subí comprobante</div></div>
                </div>
              </div>
            </div>
          </div>

          {/* Detalles de Efectivo */}
          {form.payment === "efectivo" && (
            <div className="ck-pay-detail">
              <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>¿Con cuánto pagás? (para darte el vuelto)</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[500, 1000, 2000, 5000, 10000, 20000].map(v => (
                  <button key={v} className={`ck-denom ${form.change_amount === String(v) ? "on" : ""}`} onClick={() => sf("change_amount", String(v))}>${fi(v)}</button>
                ))}
                <button className={`ck-denom ${form.change_amount === "justo" ? "on" : ""}`} onClick={() => sf("change_amount", "justo")}>Justo</button>
              </div>
            </div>
          )}

          {/* Detalles de Transferencia */}
          {form.payment === "transferencia" && (
            <div className="ck-pay-detail">
              <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>Datos para transferir</div>
              <div className="ck-bank-box">
                <div className="ck-bank-row"><span style={{color:"var(--t3)",fontSize:12}}>CBU</span><span style={{fontWeight:700,fontSize:14,letterSpacing:0.5}}>0000003100000535412820</span></div>
                <button onClick={() => {navigator.clipboard.writeText("0000003100000535412820");}} className="ck-copy-btn">Copiar CBU</button>
              </div>
              <div style={{fontSize:13,color:"var(--t2)",marginTop:12,fontWeight:700}}>Monto a transferir: <span style={{color:"var(--ac)"}}>${fi(ct)}</span></div>

              {/* Upload comprobante */}
              <div style={{marginTop:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>📎 Subí tu comprobante</div>
                <label className="ck-upload-area">
                  <input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setReceiptFile(file);
                    setReceiptStatus("");
                    if (file.type.startsWith("image/")) {
                      const reader = new FileReader();
                      reader.onload = ev => setReceiptPreview(ev.target.result);
                      reader.readAsDataURL(file);
                    } else { setReceiptPreview(null); }
                  }} />
                  {receiptPreview ? (
                    <img src={receiptPreview} alt="Comprobante" style={{maxWidth:"100%",maxHeight:200,borderRadius:10}} />
                  ) : receiptFile ? (
                    <div style={{padding:20,textAlign:"center"}}><span style={{fontSize:28}}>📄</span><div style={{fontSize:13,marginTop:6}}>{receiptFile.name}</div></div>
                  ) : (
                    <div style={{padding:24,textAlign:"center",color:"var(--t3)"}}>
                      <span style={{fontSize:28}}>📸</span>
                      <div style={{fontSize:13,marginTop:6}}>Tocá para subir foto o PDF del comprobante</div>
                    </div>
                  )}
                </label>
                {receiptFile && receiptStatus === "" && <p style={{fontSize:11,color:"var(--gn)",margin:"6px 0 0"}}>✓ Comprobante cargado — se verificará al confirmar</p>}
                {receiptStatus === "ok" && <p style={{fontSize:12,color:"var(--gn)",margin:"6px 0 0",fontWeight:700}}>✓ Comprobante verificado</p>}
                {receiptStatus === "error" && <p style={{fontSize:12,color:"var(--rd)",margin:"6px 0 0"}}>⚠ No pudimos verificar — lo revisaremos manualmente</p>}
              </div>
            </div>
          )}

          {/* Detalles de MercadoPago */}
          {form.payment === "mercadopago" && (
            <div className="ck-pay-detail">
              <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>Pagá con MercadoPago</div>
              <div className="ck-bank-box">
                <div className="ck-bank-row"><span style={{color:"var(--t3)",fontSize:12}}>Alias</span><span style={{fontWeight:700,fontSize:16}}>pato.jhs</span></div>
                <button onClick={() => {navigator.clipboard.writeText("pato.jhs");}} className="ck-copy-btn">Copiar alias</button>
              </div>
              <div style={{fontSize:13,color:"var(--t2)",marginTop:12,fontWeight:700}}>Monto a pagar: <span style={{color:"var(--ac)"}}>${fi(ct)}</span></div>

              {/* Upload comprobante */}
              <div style={{marginTop:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>📎 Subí tu comprobante</div>
                <label className="ck-upload-area">
                  <input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setReceiptFile(file);
                    setReceiptStatus("");
                    if (file.type.startsWith("image/")) {
                      const reader = new FileReader();
                      reader.onload = ev => setReceiptPreview(ev.target.result);
                      reader.readAsDataURL(file);
                    } else { setReceiptPreview(null); }
                  }} />
                  {receiptPreview ? (
                    <img src={receiptPreview} alt="Comprobante" style={{maxWidth:"100%",maxHeight:200,borderRadius:10}} />
                  ) : receiptFile ? (
                    <div style={{padding:20,textAlign:"center"}}><span style={{fontSize:28}}>📄</span><div style={{fontSize:13,marginTop:6}}>{receiptFile.name}</div></div>
                  ) : (
                    <div style={{padding:24,textAlign:"center",color:"var(--t3)"}}>
                      <span style={{fontSize:28}}>📸</span>
                      <div style={{fontSize:13,marginTop:6}}>Tocá para subir foto o PDF del comprobante</div>
                    </div>
                  )}
                </label>
                {receiptFile && receiptStatus === "" && <p style={{fontSize:11,color:"var(--gn)",margin:"6px 0 0"}}>✓ Comprobante cargado — se verificará al confirmar</p>}
                {receiptStatus === "ok" && <p style={{fontSize:12,color:"var(--gn)",margin:"6px 0 0",fontWeight:700}}>✓ Comprobante verificado</p>}
                {receiptStatus === "error" && <p style={{fontSize:12,color:"var(--rd)",margin:"6px 0 0"}}>⚠ No pudimos verificar — lo revisaremos manualmente</p>}
              </div>
            </div>
          )}

          {/* Cupón y Regalo */}
          <div style={{marginTop:20}}>
            <div className="coupon-row">
              <input className="coupon-input" placeholder="¿Tenés un cupón?" value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null); setCouponErr(""); }} disabled={!!coupon || validatingCoupon}/>
              {!coupon
                ? <button className="coupon-btn" onClick={applyCoupon} disabled={validatingCoupon || !couponCode.trim()}>{validatingCoupon ? "..." : "Aplicar"}</button>
                : <button className="coupon-btn coupon-ok" onClick={() => { setCoupon(null); setCouponCode(""); }}>✓ -{coupon.discount_pct}%</button>
              }
            </div>
            {couponErr && <p className="coupon-err">{couponErr}</p>}
            {coupon && <div className="coupon-applied">🎉 Descuento <strong>{coupon.discount_pct}%</strong> — ahorrás <strong>${fi(discount)}</strong></div>}
          </div>

          <div className="gift-box" style={{marginTop:16}}>
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
                <textarea className="gift-note-input" placeholder="Tu mensaje para la tarjeta... (máx. 200)" maxLength={200} value={form.gift_note} onChange={e => sf("gift_note", e.target.value)} />
                <div className="gift-chars">{form.gift_note.length}/200</div>
              </div>
            )}
          </div>

          <button className="abtn ck-next" disabled={!canNext2 || (needsReceipt && !receiptFile)} onClick={goNext}>
            {needsReceipt && !receiptFile ? "Subí el comprobante para continuar" : "Siguiente →"}
          </button>
        </>}

        {/* ─── PASO 3: RESUMEN ─── */}
        {ckStep === 3 && <>
          <div className="ck-summary">
            <div className="ck-sum-section">
              <div className="ck-sum-title">👤 Cliente</div>
              <div className="ck-sum-val">{form.name}</div>
              <div className="ck-sum-val" style={{fontSize:13,color:"var(--t3)"}}>{form.phone}{form.email ? ` · ${form.email}` : ""}</div>
            </div>

            <div className="ck-sum-section">
              <div className="ck-sum-title">🛵 Entrega</div>
              <div className="ck-sum-val">{form.delivery === "retiro" ? "Retiro en local — Andrés Chazarreta 1435, Villa Rosa" : `Delivery — ${form.address}`}</div>
              {scheduleMode === "later" && <div className="ck-sum-val" style={{fontSize:13,color:"var(--ac)"}}>📅 Programado: {form.delivery_date}{form.delivery_time ? ` a las ${form.delivery_time}` : ""}</div>}
            </div>

            <div className="ck-sum-section">
              <div className="ck-sum-title">💳 Pago</div>
              <div className="ck-sum-val" style={{textTransform:"capitalize"}}>{form.payment === "mercadopago" ? "MercadoPago" : form.payment}{form.payment === "efectivo" && form.change_amount ? ` — ${form.change_amount === "justo" ? "Pago justo" : `Paga con $${fi(Number(form.change_amount))}`}` : ""}</div>
              {receiptFile && <div className="ck-sum-val" style={{fontSize:12,color:"var(--gn)"}}>📎 Comprobante adjunto</div>}
              {coupon && <div className="ck-sum-val" style={{fontSize:12,color:"var(--gn)"}}>🎟 Cupón -{coupon.discount_pct}%</div>}
              {form.is_gift && <div className="ck-sum-val" style={{fontSize:12,color:"var(--ac)"}}>🎁 Es un regalo{form.gift_note ? `: "${form.gift_note.slice(0,40)}${form.gift_note.length>40?"...":""}"` : ""}</div>}
            </div>

            {form.note && <div className="ck-sum-section"><div className="ck-sum-title">💬 Notas</div><div className="ck-sum-val">{form.note}</div></div>}

            <div className="ck-sum-section">
              <div className="ck-sum-title">🛒 Productos</div>
              {cart.map(it => (
                <div key={it.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--b2)"}}>
                  <div><span style={{fontWeight:600}}>{it.name}</span><span style={{color:"var(--t3)",fontSize:13}}> x{it.qty}</span></div>
                  <span style={{fontWeight:700}}>${fi(it.price * it.qty)}</span>
                </div>
              ))}
            </div>

            <div className="ct" style={{marginTop:12}}>
              {coupon && <><span style={{color:"var(--t3)",textDecoration:"line-through",fontSize:13}}>${fi(ctBase)}</span><span style={{flex:1}}/></>}
              <span style={{fontSize:16,fontWeight:700}}>Total</span>
              <span style={{fontSize:18,fontWeight:800,color:coupon?"var(--gn)":"var(--tx)"}}>${fi(ct)}</span>
            </div>
          </div>

          {orderErr && <div style={{background:"#FFEBEE",color:"#C62828",fontSize:13,padding:"10px 14px",borderRadius:10,marginBottom:8,textAlign:"center"}}>{orderErr}</div>}
          <button className="abtn ck-next" style={{background:"var(--gn, #3A7D44)"}} disabled={sending || ct === 0} onClick={send}>
            {sending ? "Enviando..." : "✓ Confirmar Pedido"}
          </button>
        </>}
      </div>
    </div>
  );
  }

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
            {it.img ? (
              <img className="ci-img" src={it.img} alt="" loading="lazy" onError={e => { e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex'; }} />
            ) : null}
            <div className="ci-img prod-avatar" style={{ display: it.img ? 'none' : 'flex', background: avatarColors[it.name.charCodeAt(0) % avatarColors.length], width: 56, height: 56, fontSize: 22 }}>{it.name.charAt(0)}</div>
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

  // isOpen = automático por horario + override manual (store_open=false fuerza cerrado)
  const isOpen = sett.store_open === false ? false : storeStatus.open;

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
      <div className="store-cover" style={{ backgroundImage: `url(${imgOpt(sett.cover_url, { width: 800, quality: 70 }) || fallbackSettings.cover_url})` }}></div>
      <div className="store-header">
        <div className="store-logo" style={{ background: sett.logo_url ? "transparent" : (sett.logo_color || fallbackSettings.logo_color), overflow: "hidden" }}>
          {sett.logo_url ? <img src={imgOpt(sett.logo_url, { width: 150, height: 150 })} alt="" width={72} height={72} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} onError={e => { e.target.style.display = "none"; e.target.parentElement.textContent = sett.logo_letter || fallbackSettings.logo_letter; e.target.parentElement.style.background = sett.logo_color || fallbackSettings.logo_color; }} /> : (sett.logo_letter || fallbackSettings.logo_letter)}
        </div>
        <div className="store-info">
          <h1 className="store-name">{sett.biz_name || fallbackSettings.biz_name}</h1>
          <div className="store-status" style={{ color: isOpen ? "#3A7D44" : "#C62828" }}>
            {isOpen ? (storeStatus.msg ? `● Abierto · ${storeStatus.msg}` : "● Abierto ahora") : `● Cerrado${storeStatus.msg ? ` · ${storeStatus.msg}` : " — pedidos programados"}`}
          </div>
        </div>
        <button onClick={() => setShowMenu(true)} style={{ background: "var(--b2)", border: "none", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }} aria-label="Menú">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
        </button>
      </div>

      {/* Menú lateral (hamburguesa) — solo accesos rápidos */}
      {showMenu && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex" }}>
          <div onClick={() => setShowMenu(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", width: "85%", maxWidth: 380, background: "var(--bg)", height: "100%", overflowY: "auto", boxShadow: "4px 0 30px rgba(0,0,0,0.2)", animation: "slideIn .25s ease" }}>
            <div style={{ padding: "24px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--b2)" }}>
              <div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "var(--tx)" }}>{sett.biz_name || fallbackSettings.biz_name}</div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>Accesos rápidos</div>
              </div>
              <button onClick={() => setShowMenu(false)} style={{ background: "var(--b2)", border: "none", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "var(--t2)" }}>✕</button>
            </div>

            <div style={{ padding: "16px" }}>
              <button onClick={() => { setShowMenu(false); setShowTrackerInput(true); }} style={{ width: "100%", padding: "14px 16px", background: "var(--b3)", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, color: "var(--tx)", boxShadow: "var(--sh)", marginBottom: 8 }}>
                🦆 Seguí tu pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracker input (se muestra cuando se activa desde el menú) */}
      {showTrackerInput && (
        <div style={{ margin: "0 16px 4px" }}>
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
        </div>
      )}

      {/* Banner offline */}
      {error === "offline" && (
        <div style={{ margin: "0 20px 8px", padding: "10px 16px", background: "#FFF8E1", borderRadius: 12, fontSize: 13, color: "#8D6E00", textAlign: "center" }}>
          ⚠️ Modo offline — mostrando productos de ejemplo
        </div>
      )}

      {/* Banner tienda cerrada */}
      {!isOpen && (
        <div style={{ margin: "0 16px 12px", padding: "18px 20px", background: "linear-gradient(135deg, #FFF8E1, #FFF3E0)", borderRadius: 16, textAlign: "center", border: "1px solid rgba(196,93,62,0.15)" }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🌙</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#5D4037", lineHeight: 1.5, maxWidth: 340, margin: "0 auto" }}>
            ¡Ay, llegaste un poquitito tarde! Ya cerramos la cocina por hoy. Pero dejame tu pedido programado y apenas abramos me pongo a preparar todo para vos.
          </div>
          <button onClick={() => { setScheduleMode("later"); document.querySelector(".cat-section")?.scrollIntoView({ behavior: "smooth" }); }} style={{ marginTop: 14, padding: "12px 28px", background: "var(--ac)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", boxShadow: "0 2px 8px rgba(196,93,62,0.3)" }}>
            📅 Programar pedido
          </button>
        </div>
      )}

      {/* Categorías verticales — lo primero que ve el usuario */}
      <div className="cat-section">
        <div className="cat-header">
          <h2 className="cat-title">Categorías</h2>
        </div>
        <div className="cat-scroll">
          {categories.map(c => (
            <div key={c.name} className={`cat-card ${selCat === c.name ? "active" : ""} ${c.deal ? "has-deal" : ""}`} onClick={() => setSelCat(c.name)}>
              {c.img && <img className="cat-card-bg" src={imgOpt(c.img, { width: 400, quality: 70 })} alt="" loading="eager" width={180} height={120} onError={e=>{e.target.style.display='none'}} />}
              <div className="cat-card-overlay" />
              <div className="cat-card-content">
                <span className="cat-card-label">{c.displayName || c.name}</span>
              </div>
              {c.deal && <span className="cat-deal-badge">{DEAL_PCT}% OFF</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Barra sticky de filtro activo */}
      {selCat !== "Todos" && (
        <div style={{ position: "sticky", top: 0, zIndex: 40, background: "var(--bg)", borderBottom: "1px solid rgba(0,0,0,0.05)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--tx)" }}>{(sett.cat_names || {})[selCat] || selCat}</span>
          <button onClick={() => setSelCat("Todos")} style={{ background: "none", border: "none", fontSize: 12, color: "var(--ac)", cursor: "pointer", fontWeight: 600, padding: "4px 8px" }}>
            Ver todo ✕
          </button>
        </div>
      )}

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
                  <div className="prod-price">
                    {hasDeal(p) ? (<>
                      <span className="price-old">${fi(p.sale_price)}</span>
                      <span className="price-deal">${fi(getPrice(p))}</span>
                    </>) : `$${fi(p.sale_price)}`}
                  </div>
                  {hasDeal(p) && <span className="prod-deal-tag">-{DEAL_PCT}%</span>}
                  {inCartQty > 0 ? (
                    <div className="qty-inline" onClick={e => e.stopPropagation()}>
                      <button onClick={() => updQ(p.id, inCartQty - 1)}>{inCartQty <= 1 ? <span style={{fontSize:12}}>🗑</span> : I.minus({size:14})}</button>
                      <span>{inCartQty}</span>
                      <button onClick={(e) => addC(p, e)}>{I.plus({size:14})}</button>
                    </div>
                  ) : (
                    <button className="btn-add" onClick={(e) => addC(p, e)}>{I.plus({size:16})}</button>
                  )}
                </div>
              </div>
              {p.image_url ? (
                <img className="prod-img" src={imgOpt(p.image_url, { width: 300 })} alt={p.name} loading="lazy" width={120} height={120}
                  onError={e => { e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex'; }}
                />
              ) : null}
              {(!p.image_url || true) && (
                <div className="prod-img prod-avatar" style={{
                  display: p.image_url ? 'none' : 'flex',
                  background: avatarColors[p.name.charCodeAt(0) % avatarColors.length]
                }}>
                  {p.name.charAt(0)}
                </div>
              )}
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
            <h3 className="ups-title">¡Llevate un antojito!</h3>
            <div className="ups-list">
              {upsell.suggestions.map(s => (
                <div key={s.id} className="ups-card" onClick={() => addFromUpsell(s)}>
                  {s.image_url ? (
                    <img className="ups-img" src={imgOpt(s.image_url, { width: 200 })} alt={s.name} loading="lazy" width={48} height={48} onError={e => { e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex'; }} />
                  ) : null}
                  <div className="ups-img prod-avatar" style={{ display: s.image_url ? 'none' : 'flex', background: avatarColors[s.name.charCodeAt(0) % avatarColors.length], width: 48, height: 48, fontSize: 20, borderRadius: 10 }}>{s.name.charAt(0)}</div>
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

      {/* WhatsApp flotante para soporte */}
      <a href="https://wa.me/5491165706805?text=Hola!%20Tengo%20una%20consulta%20sobre%20La%20Nona%20Pato" target="_blank" rel="noopener noreferrer" className="wa-float" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>

      {/* Footer legal */}
      <footer className="catalog-footer">
        <div className="footer-links">
          <a href="/terminos" target="_blank" rel="noopener noreferrer">Términos y Condiciones</a>
          <span className="footer-dot">·</span>
          <a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>
        </div>
        <p className="footer-copy">Copyright © 2026 {sett.biz_name || "La Nona Pato"}. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}