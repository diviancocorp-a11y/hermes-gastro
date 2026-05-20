import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, formatInt, optimizeImage, originalImageUrl, disableImageTransforms, probeImageTransforms } from "../lib/utils";
import { preloadImages } from "../lib/preloadImages";
import { fetchCatalog, submitOrder, validateCouponPublic } from "../lib/catalogService";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import business, { waLink } from "@business";

// ── Extracted components ──
import ProductCard from "../components/catalog/ProductCard";
import PushBanner from "../components/catalog/PushBanner";
import ConfirmationAnimation from "../components/catalog/ConfirmationAnimation";
import OrderSentView from "../components/catalog/OrderSentView";

// ── Shared constants ──
import {
  avatarColors, CAT_GROUPS as FALLBACK_CAT_GROUPS, SUB_TO_PARENT as FALLBACK_SUB_TO_PARENT,
  DAILY_DEALS, DEAL_PCT,
  fallbackSettings, fallbackProducts, STORE_LAT, STORE_LNG,
  haversine, calcDeliveryCost, CHECKOUT_STEPS, DEFAULT_FORM
} from "../constants/catalogConstants";
import { fetchCategoryGroups, toClientFormat, buildSubToParent } from "../services/categories";
import useFeature from "../hooks/useFeature";

export default function Catalog() {
  const navigate = useNavigate();
  const { user, profile, addresses, isFavorite, toggleFavorite } = useAuth();

  // --- Feature flags ---
  const ffGift = useFeature('GIFT_MODE');
  const ffPush = useFeature('PUSH_NOTIFICATIONS');
  const ffDeals = useFeature('DAILY_DEALS');
  const ffWhatsapp = useFeature('WHATSAPP');

  // --- Estado de datos ---
  const [sett, setSett] = useState(fallbackSettings);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serverNow, setServerNow] = useState(null); // hora del servidor para validar horarios
  const [catGroups, setCatGroups] = useState(FALLBACK_CAT_GROUPS);
  const [subToParent, setSubToParent] = useState(FALLBACK_SUB_TO_PARENT);

  // --- Estado de UI ---
  const [selCat, setSelCat] = useState("Todos");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCk, setShowCk] = useState(false);
  const [sent, setSent] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [sending, setSending] = useState(false);
  const [orderErr, setOrderErr] = useState("");
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [scheduleMode, setScheduleMode] = useState("now"); // "now" | "later"
  const [ckStep, setCkStep] = useState(0); // 0=Datos, 1=Entrega, 2=Pago, 3=Resumen
  const [faqOpen, setFaqOpen] = useState(null); // índice de FAQ abierta
  const [receiptFile, setReceiptFile] = useState(null); // comprobante subido
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptStatus, setReceiptStatus] = useState(""); // "" | "ok" | "error"
  // waitingReceipt / waitTimer removed in FASE 3 cleanup. The 60s verification
  // window was replaced by direct "Pedido enviado" — Mercado Pago will
  // eventually handle payment validation via pasarela instead of this poll.
  const [geoLoading, setGeoLoading] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [deliveryKm, setDeliveryKm] = useState(null);
  const [calcingDelivery, setCalcingDelivery] = useState(false);
  const [confirmAnim, setConfirmAnim] = useState(false); // animación de confirmación

  // STORE_LAT, STORE_LNG, haversine, calcDeliveryCost importados de constants

  // Calcular envío cuando cambia la dirección
  const estimateDelivery = useCallback(async (address) => {
    if (!address || address.length < 5) { setDeliveryCost(0); setDeliveryKm(null); return; }
    setCalcingDelivery(true);
    try {
      const q = encodeURIComponent(address + ", Buenos Aires, Argentina");
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
      const data = await r.json();
      if (data?.[0]) {
        const km = haversine(STORE_LAT, STORE_LNG, parseFloat(data[0].lat), parseFloat(data[0].lon));
        const cost = calcDeliveryCost(km);
        setDeliveryKm(Math.round(km * 10) / 10);
        setDeliveryCost(cost);
      } else {
        setDeliveryCost(0); setDeliveryKm(null);
      }
    } catch { setDeliveryCost(0); setDeliveryKm(null); }
    setCalcingDelivery(false);
  }, []);

  // Fecha mínima para agendamiento: hoy (siempre permite programar para hoy y mañana)
  const minDate = useMemo(() => {
    const now = serverNow || new Date();
    return now.toISOString().split("T")[0];
  }, [serverNow]);

  // --- Per-client catalog theming ---
  const catalogTheme = useMemo(() => {
    const b = business.branding || {};
    const style = {};
    if (b.catalogBg) style['--catalog-bg'] = b.catalogBg;
    if (b.catalogCardBg) style['--catalog-card-bg'] = b.catalogCardBg;
    if (b.catalogHeaderBg) style['--catalog-header-bg'] = b.catalogHeaderBg;
    if (b.catalogTextOnBg) style['--catalog-text-on-bg'] = b.catalogTextOnBg;
    if (b.catalogStickyBg) style['--catalog-sticky-bg'] = b.catalogStickyBg;
    if (b.catalogStickyText) style['--catalog-sticky-text'] = b.catalogStickyText;
    return style;
  }, []);

  const [upsell, setUpsell] = useState(null); // {product, suggestions[]}
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null); // {id, discount_pct}
  const [couponErr, setCouponErr] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [showTrackerInput, setShowTrackerInput] = useState(false);
  const [trackerCode, setTrackerCode] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  // scheduleTimeErr eliminado — ahora usamos dropdown con horas válidas

  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-fill checkout form from profile when opening checkout
  useEffect(() => {
    if (showCk && user && profile) {
      setForm(p => ({
        ...p,
        name: p.name || profile.name || "",
        phone: p.phone || profile.phone || "",
        email: p.email || user.email || "",
      }));
    }
  }, [showCk, user, profile]);

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

  // Generar horas disponibles para una fecha según horario del local
  const getAvailableHours = useCallback((dateStr) => {
    if (!dateStr || !sett?.store_hours) return [];
    // Calcular día de semana de la fecha seleccionada
    const [y, m, d] = dateStr.split("-").map(Number);
    const selectedDate = new Date(y, m - 1, d);
    const jsDow = selectedDate.getDay(); // 0=Dom
    const dayIdx = (jsDow + 6) % 7; // → 0=Lun
    const dayHrs = sett.store_hours[dayIdx];
    if (!dayHrs || dayHrs.closed || !dayHrs.open || !dayHrs.close) return [];

    const [oh] = dayHrs.open.split(":").map(Number);
    const [ch] = dayHrs.close.split(":").map(Number);
    const firstHour = oh + 1; // +1h después de abrir (preparación)
    const lastHour = ch - 1;  // -1h antes de cerrar
    if (firstHour > lastHour) return [];

    const now = serverNow || new Date();
    const isToday = dateStr === now.toISOString().split("T")[0];
    const currentHour = now.getHours();

    const hours = [];
    for (let h = firstHour; h <= lastHour; h++) {
      // Si es hoy, solo mostrar horas futuras (+1h de margen)
      if (isToday && h <= currentHour + 1) continue;
      hours.push(h);
    }
    return hours;
  }, [sett, serverNow]);

  // Horas disponibles para la fecha seleccionada (reactivo)
  const availableHours = useMemo(() => getAvailableHours(form.delivery_date), [form.delivery_date, getAvailableHours]);

  // Info del día seleccionado
  const selectedDayInfo = useMemo(() => {
    if (!form.delivery_date || !sett?.store_hours) return null;
    const [y, m, d] = form.delivery_date.split("-").map(Number);
    const selectedDate = new Date(y, m - 1, d);
    const jsDow = selectedDate.getDay();
    const dayIdx = (jsDow + 6) % 7;
    const dayHrs = sett.store_hours[dayIdx];
    const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    if (!dayHrs || dayHrs.closed) return { closed: true, dayName: dayNames[dayIdx] };
    return { closed: false, dayName: dayNames[dayIdx], open: dayHrs.open, close: dayHrs.close };
  }, [form.delivery_date, sett]);

  // Si el local está cerrado, forzar modo "Programar" (también al abrir checkout)
  useEffect(() => {
    if (!storeStatus.open && scheduleMode === "now") setScheduleMode("later");
  }, [storeStatus.open, showCk]);

  // FASE 3: the 60s countdown + receipt-verification poll were removed.
  // Mercado Pago pasarela will replace this flow.

  // --- Cargar datos de Supabase al montar ---
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      // Fetch catalog data and categories in parallel
      const [data, dbCategories] = await Promise.all([
        fetchCatalog(),
        fetchCategoryGroups(),
      ]);
      // Apply dynamic categories
      const clientCats = toClientFormat(dbCategories);
      setCatGroups(clientCats);
      setSubToParent(buildSubToParent(clientCats));

      if (data) {
        setSett(data.settings);
        setProducts(data.products);
        if (data.serverNow) setServerNow(new Date(data.serverNow));
        // Probe if Supabase image transforms are available (Pro plan feature)
        probeImageTransforms(data.settings?.cover_url);
        // Preload hero + first 4 product images for fast LCP
        const criticalUrls = [
          data.settings?.cover_url,
          ...data.products.slice(0, 4).map(p => p.image_url),
        ];
        preloadImages(criticalUrls);
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

  // Restaurar carrito si vuelve del registro
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("lnp_cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCart(parsed);
          setShowCk(true); // reabrir checkout
        }
        sessionStorage.removeItem("lnp_cart");
      }
    } catch {}
  }, []);

  // Categorías madre con descuento del día (usa hora del servidor)
  const dealCats = useMemo(() => {
    if (!ffDeals) return new Set();
    const now = serverNow || new Date();
    const dow = now.getDay(); // 0=Dom, 1=Lun ... 4=Jue
    return new Set(DAILY_DEALS[dow] || []);
  }, [serverNow, ffDeals]);

  // Categorías madre con imagen: prioridad settings > primer producto con foto
  const categories = useMemo(() => {
    const catImgs = sett.cat_images || {};
    const existingSubs = new Set(products.map(r => r.category));
    const hiddenCats = new Set(sett.hidden_cats || []);
    const catNames = sett.cat_names || {};
    const catData = catGroups
      .filter(g => !hiddenCats.has(g.name) && g.subs.some(s => existingSubs.has(s)))
      .map(g => {
        const customImg = catImgs[g.name];
        const rep = !customImg ? products.find(p => g.subs.includes(p.category) && p.image_url) : null;
        const displayName = catNames[g.name] || g.name;
        return { name: g.name, displayName, icon: g.icon, subs: g.subs, img: customImg || rep?.image_url || null, deal: dealCats.has(g.name) };
      });
    return [{ name: "Todos", icon: "🏠", subs: [], img: catImgs["Todos"] || null, deal: false, displayName: "Todos" }, ...catData];
  }, [products, dealCats, sett, catGroups]);

  // Helper: ¿un producto pertenece a una categoría madre con descuento?
  const hasDeal = useCallback((p) => {
    const parent = subToParent[p.category];
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
    const group = catGroups.find(g => g.name === selCat);
    if (!group) return products;
    return products.filter(r => group.subs.includes(r.category));
  }, [selCat, products]);

  // avatarColors: definido fuera del componente como constante estática

  // Mapa rápido de cantidades en carrito: O(1) lookup en vez de O(n) find
  const cartQtyMap = useMemo(() => {
    const m = {};
    cart.forEach(i => { m[i.id] = i.qty; });
    return m;
  }, [cart]);

  // Totales del carrito (memoizado)
  const { cc, discount, ct, ctWithDelivery } = useMemo(() => {
    const cc = cart.reduce((s, i) => s + i.qty, 0);
    const ctBase = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const discount = coupon ? Math.round(ctBase * coupon.discount_pct / 100) : 0;
    const ct = ctBase - discount;
    const ctWithDelivery = ct + (form.delivery === "envio" ? deliveryCost : 0);
    return { cc, discount, ct, ctWithDelivery };
  }, [cart, coupon, deliveryCost, form.delivery]);

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
      const isNewProduct = !prev.find(i => i.id === p.id);
      const newCart = isNewProduct
        ? [...prev, { id: p.id, name: p.name, price: finalPrice, qty: 1, img: p.image_url }]
        : prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      // Upselling: mostrar sugerencias SOLO si el producto es nuevo en el carrito
      if (isNewProduct && p.related_ids && p.related_ids.length > 0) {
        const suggestions = products.filter(x => p.related_ids.includes(x.id));
        if (suggestions.length > 0) setUpsell({ product: p, suggestions: suggestions.slice(0, 3) });
      }
      return newCart;
    });
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
    // Construir dirección completa con piso y notas de referencia
    let fullAddress = form.address || "";
    if (form.delivery === "envio") {
      if (form.address_piso) fullAddress += ` - Piso/Depto: ${form.address_piso}`;
      if (form.address_notas) fullAddress += ` - ${form.address_notas}`;
    }

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
      email: user ? user.email : form.email,
      delivery: form.delivery,
      payment: form.payment,
      address: fullAddress,
      note: finalNote,
      is_gift: form.is_gift,
      gift_note: form.is_gift ? form.gift_note : '',
      coupon_id: coupon?.id || null,
      discount: discount,
      delivery_cost: form.delivery === "envio" ? deliveryCost : 0,
      total: ctWithDelivery,
      delivery_date: scheduleMode === "later" ? (form.delivery_date || null) : null,
      user_id: user?.id || null,
      items: cart.map(i => ({
        recipeId: i.id,
        qty: i.qty,
        unitPrice: i.price
      }))
    };

    const result = await submitOrder(orderData);
    setSending(false);

    if (result?.ok) {
      const isDigital = form.payment === "transferencia" || form.payment === "mercadopago";
      // Si pagó con transferencia/MP y subió comprobante, subirlo al storage + notificar
      if (receiptFile && result.orderId && isDigital) {
        try {
          const ext = receiptFile.name.split(".").pop() || "jpg";
          const path = `receipts/${result.orderId}.${ext}`;
          await supabase.storage.from("receipts").upload(path, receiptFile, { upsert: true });
          await supabase.from("orders").update({ receipt_url: path }).eq("id", result.orderId);
          // Notificar al grupo admin via webhook
          try {
            const webhookUrl = import.meta.env.VITE_CUSTOMER_WEBHOOK;
            if (webhookUrl) {
              await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                  type: "receipt",
                  store: business.name,
                  customer: form.name,
                  phone: form.phone,
                  payment: form.payment,
                  total: ctWithDelivery,
                  orderId: result.orderId
                })
              });
            }
          } catch {}
        } catch (e) {
          console.warn("Error subiendo comprobante (no bloquea):", e);
        }
      }
      setOrderId(result.orderId);
      // Mostrar animación de confirmación
      setConfirmAnim(true);
      setCart([]);
      setForm({ ...DEFAULT_FORM });
      setScheduleMode("now");
      setCoupon(null); setCouponCode("");
      setCkStep(0);
      setReceiptFile(null); setReceiptPreview(null); setReceiptStatus("");
      // Después de la animación del corazón (2.5s), entra directo a "Enviado".
      // El timer de 60s de verificación se eliminó — la validación de pago
      // se va a hacer vía pasarela de Mercado Pago en una etapa posterior.
      setTimeout(() => {
        setConfirmAnim(false);
        setSent(true);
      }, 2500);
    } else {
      console.error("Pedido no se guardó en Supabase.");
      setOrderErr("No pudimos procesar tu pedido. Revisá tu conexión e intentá de nuevo.");
    }
  };

  // Sonido de pato al confirmar pedido
  useEffect(() => {
    if (confirmAnim) {
      try { const a = new Audio(business.branding.sound); a.play().catch(() => {}); } catch {}
    }
  }, [confirmAnim]);

  // --- VISTA: CARGANDO ---
  if (loading) return (
    <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: "#C45D3E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Serif Display',serif", fontSize: 28, margin: "0 auto 16px" }}>N</div>
        <p style={{ color: "var(--t3)", fontSize: 15 }}>Cargando catálogo...</p>
      </div>
    </div>
  );

  // --- VISTA: ANIMACIÓN DE CONFIRMACIÓN ---
  if (confirmAnim) return <ConfirmationAnimation />;

  // --- VISTA: PEDIDO ENVIADO ---
  if (sent) return <OrderSentView orderId={orderId} form={form} receiptFile={receiptFile} onReset={() => { setSent(false); setOrderId(null); setShowCk(false); }} />;

  // --- VISTA: CHECKOUT STEPPER ---
  if (showCk) {
    const STEPS = CHECKOUT_STEPS;
    const canNext0 = form.name.trim().length >= 2 && form.phone.length >= 10 && (!form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email));
    const canNext1 = form.delivery === "retiro" || (form.delivery === "envio" && form.address.trim().length > 3);
    const canNext2 = !!form.payment && (form.payment !== "efectivo" || true);
    const needsReceipt = form.payment === "transferencia" || form.payment === "mercadopago";
    const goNext = () => setCkStep(s => Math.min(s + 1, 3));
    const goBack = () => { if (ckStep === 0) { setShowCk(false); setCkStep(0); } else setCkStep(s => s - 1); };

    return (
    <div className="po">
      <div className="ph">
        <button onClick={goBack}>{Icon.back({ size: 20 })}</button>
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
          {/* Si está logueado, mostrar saludo */}
          {user ? (
            <div className="cks">
              <div style={{padding:"12px 14px",background:"linear-gradient(135deg, #E8F5E9, #F1F8E9)",borderRadius:12,display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:"var(--ac)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:15}}>{(profile?.name || user.email)?.[0]?.toUpperCase() || "U"}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--tx)"}}>{profile?.name || "Mi cuenta"}</div>
                  <div style={{fontSize:12,color:"var(--t3)"}}>{user.email}</div>
                </div>
                <div style={{fontSize:11,color:"#3A7D44",fontWeight:600,background:"#C8E6C9",padding:"4px 10px",borderRadius:20}}>Registrado</div>
              </div>
            </div>
          ) : (
            /* INVITADO: datos + banner para registrarse */
            <>
              <div className="cks">
                <div className="ckl">👤 Tus datos</div>
                <input className="cki" value={form.name} onChange={e => sf("name", e.target.value.slice(0, 200))} placeholder="Nombre y Apellido" autoFocus />
                <input className="cki" type="tel" value={form.phone} onChange={e => sf("phone", e.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="Teléfono (Ej: 1155443322)" maxLength={15} style={{marginTop:10}} />
                {form.phone && form.phone.length < 10 && <p style={{fontSize:11,color:"#C62828",margin:"4px 0 0 4px"}}>Mínimo 10 dígitos · ({form.phone.length}/10)</p>}
              </div>

              {/* Banner: registrate para esta compra */}
              <div className="cks">
                <div style={{padding:"16px",background:"linear-gradient(135deg, #FFF8E1, #FFF3E0)",borderRadius:14,border:"1.5px solid #FFE0B2"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{fontSize:22}}>🦆</span>
                    <span style={{fontSize:15,fontWeight:700,color:"#5D4037"}}>¡Registrate y aprovechá en esta compra!</span>
                  </div>
                  <div style={{fontSize:13,color:"#5D4037",lineHeight:1.7,marginBottom:4}}>
                    <div>✓ Guardá tus direcciones y pedí más rápido</div>
                    <div>✓ Seguí tus pedidos en vivo</div>
                    <div>✓ Accedé a cupones y descuentos exclusivos</div>
                    <div>✓ Tus datos quedan guardados para la próxima</div>
                  </div>
                  <p style={{fontSize:12,color:"#8D6E00",fontWeight:600,margin:"8px 0 12px",lineHeight:1.4}}>
                    Creá tu cuenta ahora y volvé directo a terminar tu pedido con todos los beneficios activos.
                  </p>
                  <button
                    onClick={() => {
                      // Guardar carrito para restaurar después del registro
                      try { sessionStorage.setItem("lnp_cart", JSON.stringify(cart)); } catch {}
                      navigate("/mi-cuenta");
                    }}
                    style={{width:"100%",padding:"14px",background:"var(--ac)",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 15px rgba(196,93,62,.3)"}}
                  >
                    Registrarme gratis
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Cuándo lo necesitás */}
          <div className="cks">
            <div className="ckl">📅 ¿Para cuándo?</div>
            <div className="cko">
              <div data-testid="schedule-now" className={`ckv ${scheduleMode === "now" && storeStatus.open ? "on" : ""}`} onClick={() => { if(!storeStatus.open) return; setScheduleMode("now"); sf("delivery_date", ""); sf("delivery_time", ""); }} style={!storeStatus.open ? {opacity:0.4, pointerEvents:"none", textDecoration:"line-through"} : {}}>Ahora</div>
              <div data-testid="schedule-later" className={`ckv ${scheduleMode === "later" ? "on" : ""}`} onClick={() => setScheduleMode("later")}>Programar</div>
            </div>
            {!storeStatus.open && <p style={{fontSize:12,color:"var(--rd)",margin:"6px 0 0 2px"}}>⏰ {storeStatus.msg}</p>}
            {storeStatus.open && storeStatus.msg && scheduleMode === "now" && <p style={{fontSize:11,color:"var(--gn)",margin:"4px 0 0 2px"}}>✓ {storeStatus.msg}</p>}
          </div>
          {scheduleMode === "later" && (
            <div className="cks" style={{background:"var(--b2)",borderRadius:12,padding:"12px 14px",marginTop:-4}}>
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:4,display:"block"}}>Fecha</label>
                  <input data-testid="schedule-date" className="cki" type="date" value={form.delivery_date} min={minDate} onChange={e => {
                    sf("delivery_date", e.target.value);
                    sf("delivery_time", ""); // resetear hora al cambiar fecha
                  }} style={{colorScheme:"light"}} />
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:4,display:"block"}}>Hora de entrega</label>
                  <select
                    data-testid="schedule-time"
                    className="cki"
                    value={form.delivery_time}
                    onChange={e => sf("delivery_time", e.target.value)}
                    disabled={!form.delivery_date || availableHours.length === 0}
                    style={{colorScheme:"light",appearance:"none",backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239C8B7A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 14px center"}}
                  >
                    <option value="">Elegí una hora</option>
                    {availableHours.map(h => (
                      <option key={h} value={`${String(h).padStart(2,"0")}:00`}>
                        {String(h).padStart(2,"0")}:00 hs
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Info del día seleccionado */}
              {selectedDayInfo && selectedDayInfo.closed && (
                <div style={{marginTop:10,padding:"10px 12px",background:"var(--rl)",border:"1px solid var(--rd)",borderRadius:10,fontSize:13,color:"var(--rd)",lineHeight:1.4}}>
                  ⏰ El {selectedDayInfo.dayName} no abrimos. Elegí otro día.
                </div>
              )}
              {selectedDayInfo && !selectedDayInfo.closed && availableHours.length === 0 && form.delivery_date && (
                <div style={{marginTop:10,padding:"10px 12px",background:"var(--yl)",border:"1px solid var(--yw)",borderRadius:10,fontSize:13,color:"#8D6E00",lineHeight:1.4}}>
                  ⏰ No hay horarios disponibles para hoy. El local abre de {selectedDayInfo.open} a {selectedDayInfo.close} — probá con otro día.
                </div>
              )}
              {selectedDayInfo && !selectedDayInfo.closed && availableHours.length > 0 && (
                <p style={{fontSize:11,color:"var(--t3)",margin:"8px 0 0 2px"}}>
                  {selectedDayInfo.dayName}: abrimos {selectedDayInfo.open} – {selectedDayInfo.close}
                </p>
              )}
              {!form.delivery_date && <p style={{fontSize:11,color:"var(--rd)",margin:"6px 0 0 2px"}}>Seleccioná una fecha</p>}
            </div>
          )}

          <button className="abtn ck-next" data-testid="checkout-next" disabled={!canNext0 || (scheduleMode === "now" && !storeStatus.open) || (scheduleMode === "later" && (!form.delivery_date || !form.delivery_time))} onClick={goNext}>Siguiente →</button>
        </>}

        {/* ─── PASO 1: ENTREGA ─── */}
        {ckStep === 1 && <>
          <div className="cks">
            <div className="ckl">🛵 ¿Cómo lo recibís?</div>
            <div className="cko" style={{flexDirection:"column"}}>
              <div className={`ckv-card ${form.delivery === "retiro" ? "on" : ""}`} onClick={() => { sf("delivery", "retiro"); setDeliveryCost(0); setDeliveryKm(null); }}>
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
              <div className="ckl">📍 Dirección de entrega</div>

              {/* Direcciones guardadas del usuario */}
              {user && addresses.length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:600,color:"var(--t3)",marginBottom:6}}>Seleccioná una dirección guardada</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {addresses.map(a => {
                      const isSelected = form.address === a.address;
                      return (
                        <button key={a.id} onClick={() => {
                          sf("address", a.address);
                          sf("address_piso", a.notes || "");
                          if (a.lat && a.lng) {
                            const km = haversine(STORE_LAT, STORE_LNG, a.lat, a.lng);
                            setDeliveryKm(Math.round(km * 10) / 10);
                            setDeliveryCost(calcDeliveryCost(km));
                          } else {
                            estimateDelivery(a.address);
                          }
                        }} style={{
                          width:"100%",padding:"10px 14px",background: isSelected ? "var(--ac)" : "var(--b2)",
                          color: isSelected ? "#fff" : "var(--tx)",
                          border:"none",borderRadius:12,textAlign:"left",cursor:"pointer",fontSize:13,lineHeight:1.4
                        }}>
                          <span style={{fontWeight:700}}>{a.label}:</span> {a.address}
                          {a.notes && <span style={{opacity:0.7,fontSize:12}}> · {a.notes}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <input className="cki" value={form.address} onChange={e => {
                sf("address", e.target.value);
                clearTimeout(window._deliveryTimer);
                window._deliveryTimer = setTimeout(() => estimateDelivery(e.target.value), 1500);
              }} placeholder="Calle y número (Ej: Av. San Martín 1234)" />
              {form.address && form.address.length < 5 && <p style={{fontSize:11,color:"var(--rd)",margin:"4px 0 0 4px"}}>Ingresá una dirección más completa</p>}

              {/* Botón GPS: Usar mi ubicación actual */}
              <button
                onClick={async () => {
                  if (!navigator.geolocation) { alert("Tu navegador no soporta geolocalización"); return; }
                  setGeoLoading(true);
                  try {
                    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
                    const { latitude, longitude } = pos.coords;
                    // Intentar con zoom=18 primero
                    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=18`);
                    const d = await r.json();
                    let a = d.address || {};
                    let street = a.road || a.pedestrian || a.footway || "";
                    let number = a.house_number || "";
                    // Si no hay número, intentar con zoom más alto (nivel edificio)
                    if (!number && street) {
                      try {
                        const r2 = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=21`);
                        const d2 = await r2.json();
                        number = d2.address?.house_number || "";
                      } catch {}
                    }
                    // Si aún no hay número, buscar la dirección más cercana con número
                    if (!number && street) {
                      try {
                        const searchQ = encodeURIComponent(`${street}, ${a.city || a.town || a.village || ""}, Argentina`);
                        const r3 = await fetch(`https://nominatim.openstreetmap.org/search?q=${searchQ}&format=json&addressdetails=1&limit=5&viewbox=${longitude-0.002},${latitude+0.002},${longitude+0.002},${latitude-0.002}&bounded=1`);
                        const results = await r3.json();
                        // Buscar el resultado más cercano que tenga house_number
                        let bestNum = "";
                        let bestDist = Infinity;
                        for (const res of results) {
                          if (res.address?.house_number) {
                            const dist = haversine(latitude, longitude, parseFloat(res.lat), parseFloat(res.lon));
                            if (dist < bestDist) { bestDist = dist; bestNum = res.address.house_number; }
                          }
                        }
                        if (bestNum) number = bestNum;
                      } catch {}
                    }
                    // Último recurso: estimar número a partir de coordenadas (aprox)
                    if (!number) {
                      const approx = Math.round(Math.abs((latitude * 10000) % 9000) / 5) * 5 + 100;
                      number = `~${approx}`;
                    }
                    const locality = a.city || a.town || a.village || a.suburb || "";
                    const fullAddr = street ? `${street} ${number}, ${locality}`.trim() : d.display_name?.split(",").slice(0, 3).join(",") || "";
                    sf("address", fullAddr);
                    const km = haversine(STORE_LAT, STORE_LNG, latitude, longitude);
                    setDeliveryKm(Math.round(km * 10) / 10);
                    setDeliveryCost(calcDeliveryCost(km));
                  } catch {
                    alert("No pudimos obtener tu ubicación. Asegurate de permitir acceso a la ubicación en tu navegador.");
                  }
                  setGeoLoading(false);
                }}
                disabled={geoLoading}
                style={{
                  marginTop:8, width:"100%", padding:"10px 14px", background:"var(--bg)",
                  border:"1.5px dashed var(--b2)", borderRadius:10, fontSize:13, fontWeight:600,
                  color:"var(--ac)", cursor:"pointer", display:"flex", alignItems:"center",
                  justifyContent:"center", gap:6, transition:"all .2s"
                }}
              >
                {geoLoading ? "📍 Localizando..." : "📍 Usar mi ubicación actual"}
              </button>

              {/* Piso / Depto */}
              <input className="cki" value={form.address_piso} onChange={e => sf("address_piso", e.target.value)} placeholder="Piso / Depto (opcional)" style={{marginTop:10}} />

              {/* Notas de referencia para el delivery */}
              <input className="cki" value={form.address_notas} onChange={e => sf("address_notas", e.target.value)} placeholder="Referencia para el delivery (timbre, esquina...)" style={{marginTop:10}} />

              {/* Estimación de envío */}
              {calcingDelivery && <div style={{marginTop:8,fontSize:13,color:"var(--ac)",fontWeight:600}}>🔄 Calculando costo de envío...</div>}
              {!calcingDelivery && deliveryKm !== null && deliveryCost > 0 && (
                <div style={{marginTop:10,padding:"12px 14px",background:"var(--b2)",borderRadius:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--tx)"}}>🚚 Costo de envío</div>
                      <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>~{deliveryKm} km desde el local</div>
                    </div>
                    <div style={{fontSize:18,fontWeight:800,color:"var(--ac)"}}>${formatInt(deliveryCost)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <button className="abtn ck-next" data-testid="checkout-next" disabled={!canNext1} onClick={goNext}>Siguiente →</button>
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
              <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>¿Con cuánto pagás?</div>
              <div style={{display:"flex",gap:10}}>
                <button style={{
                  flex:1,
                  padding:"14px",
                  background: form.change_amount === "justo" ? "var(--ac)" : "var(--b2)",
                  color: form.change_amount === "justo" ? "#fff" : "var(--tx)",
                  border:"none",
                  borderRadius:12,
                  fontWeight:700,
                  fontSize:14,
                  cursor:"pointer",
                  transition:"all .2s"
                }} onClick={() => sf("change_amount", "justo")}>Pago justo</button>
                <button style={{
                  flex:1,
                  padding:"14px",
                  background: form.change_amount !== null && form.change_amount !== "justo" ? "var(--ac)" : "var(--b2)",
                  color: form.change_amount !== null && form.change_amount !== "justo" ? "#fff" : "var(--tx)",
                  border:"none",
                  borderRadius:12,
                  fontWeight:700,
                  fontSize:14,
                  cursor:"pointer",
                  transition:"all .2s"
                }} onClick={() => sf("change_amount", "")}>Necesito vuelto</button>
              </div>
              {form.change_amount !== null && form.change_amount !== "justo" && (
                <div style={{marginTop:10}}>
                  <input className="cki" type="number" inputMode="numeric" value={form.change_amount === "justo" ? "" : form.change_amount} onChange={e => sf("change_amount", e.target.value.replace(/\D/g,""))} placeholder="Ej: pago con $20.000" style={{fontSize:16}} />
                </div>
              )}
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
              <div style={{fontSize:13,color:"var(--t2)",marginTop:12,fontWeight:700}}>Monto a transferir: <span style={{color:"var(--ac)"}}>${formatInt(ctWithDelivery)}</span></div>

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
              <div style={{fontSize:13,color:"var(--t2)",marginTop:12,fontWeight:700}}>Monto a pagar: <span style={{color:"var(--ac)"}}>${formatInt(ctWithDelivery)}</span></div>

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
            {coupon && <div className="coupon-applied">🎉 Descuento <strong>{coupon.discount_pct}%</strong> — ahorrás <strong>${formatInt(discount)}</strong></div>}
          </div>

          {ffGift && <div className="gift-box" style={{marginTop:16}}>
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
          </div>}

          <button className="abtn ck-next" data-testid="checkout-next" disabled={!canNext2 || (needsReceipt && !receiptFile)} onClick={goNext}>
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
              <div className="ck-sum-val" style={{textTransform:"capitalize"}}>{form.payment === "mercadopago" ? "MercadoPago" : form.payment}{form.payment === "efectivo" && form.change_amount ? ` — ${form.change_amount === "justo" ? "Pago justo" : `Paga con $${formatInt(Number(form.change_amount))}`}` : ""}</div>
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
                  <span style={{fontWeight:700}}>${formatInt(it.price * it.qty)}</span>
                </div>
              ))}
            </div>

            {form.delivery === "envio" && deliveryCost > 0 && (
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--b2)",fontSize:14}}>
                <span>🚚 Envío (~{deliveryKm} km)</span>
                <span style={{fontWeight:700}}>${formatInt(deliveryCost)}</span>
              </div>
            )}

            <div className="ct" style={{marginTop:12}}>
              {(coupon || (form.delivery === "envio" && deliveryCost > 0)) && <><span style={{color:"var(--t3)",fontSize:13}}>Productos: ${formatInt(ct)}</span><span style={{flex:1}}/></>}
              <span style={{fontSize:16,fontWeight:700}}>Total</span>
              <span style={{fontSize:18,fontWeight:800,color:coupon?"var(--gn)":"var(--tx)"}}>${formatInt(ctWithDelivery)}</span>
            </div>
          </div>

          {orderErr && <div style={{background:"#FFEBEE",color:"#C62828",fontSize:13,padding:"10px 14px",borderRadius:10,marginBottom:8,textAlign:"center"}}>{orderErr}</div>}
          <button className="abtn ck-next" data-testid="checkout-submit" style={{background:"var(--gn, #3A7D44)"}} disabled={sending || ctWithDelivery === 0} onClick={send}>
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
        <button onClick={() => setShowCart(false)}>{Icon.back({ size: 20 })}</button>
        <h2>Mi Pedido</h2>
      </div>
      <div className="pb">
        {cart.map(it => (
          <div key={it.id} className="ci2">
            {it.img ? (
              <img className="ci-img" src={it.img} alt="" loading="lazy" onError={e => {
                const orig = originalImageUrl(e.target.src);
                if (orig && orig !== e.target.src) { disableImageTransforms(); e.target.src = orig; return; }
                e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex';
              }} />
            ) : null}
            <div className="ci-img prod-avatar" style={{ display: it.img ? 'none' : 'flex', background: avatarColors[it.name.charCodeAt(0) % avatarColors.length], width: 56, height: 56, fontSize: 22 }}>{it.name.charAt(0)}</div>
            <div className="ci-i">
              <div className="ci-n">{it.name}</div>
              <div className="ci-p" style={{ marginBottom: 12 }}>${formatInt(it.price * it.qty)}</div>
              <div className="qty">
                <button onClick={() => updQ(it.id, it.qty - 1)}>{it.qty <= 1 ? <span style={{ fontSize: 12, color: "var(--rd)" }}>🗑</span> : Icon.minus({ size: 14 })}</button>
                <span>{it.qty}</span>
                <button onClick={() => updQ(it.id, it.qty + 1)}>{Icon.plus({ size: 14 })}</button>
              </div>
            </div>
          </div>
        ))}
        <div className="ct"><span>Total</span><span>${formatInt(ct)}</span></div>

        {/* Notas del pedido */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--t2)",marginBottom:6}}>💬 Notas del pedido (opcional)</div>
          <input className="cki" value={form.note} onChange={e => sf("note", e.target.value)} placeholder="Ej: Sin azúcar, sin cebolla, para las 15hs..." />
        </div>

        <button className="abtn" data-testid="cart-continue" style={{ width: "100%" }} disabled={cc === 0 || ct === 0} onClick={() => { setShowCart(false); setShowCk(true); }}>Continuar</button>
      </div>
    </div>
  );

  // isOpen = automático por horario + override manual (store_open=false fuerza cerrado)
  const isOpen = sett.store_open === false ? false : storeStatus.open;

  // --- VISTA PRINCIPAL: CATÁLOGO ---
  return (
    <div className="app" style={{ ...catalogTheme, background: catalogTheme['--catalog-bg'] || undefined }}>
      {/* Portada y Header */}
      <div className="store-cover" style={{ backgroundImage: `url(${optimizeImage(sett.cover_url, { width: 600, quality: 55 }) || fallbackSettings.cover_url})` }}>
        {/* Hidden probe image: detects if render URL fails and falls back to original */}
        {sett.cover_url && <img src={optimizeImage(sett.cover_url, { width: 600, quality: 55 })} alt="" style={{display:'none'}} onError={e => {
          disableImageTransforms();
          const orig = sett.cover_url || fallbackSettings.cover_url;
          e.target.parentElement.style.backgroundImage = `url(${orig})`;
        }} />}
      </div>
      <div className="store-header">
        <div className="store-logo" style={{ background: sett.logo_url ? "transparent" : (sett.logo_color || fallbackSettings.logo_color), overflow: "hidden" }}>
          {sett.logo_url ? <img src={optimizeImage(sett.logo_url, { width: 150, height: 150, quality: 60 })} alt="" width={72} height={72} decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} onError={e => {
            const orig = originalImageUrl(e.target.src) || sett.logo_url;
            if (orig !== e.target.src) { disableImageTransforms(); e.target.src = orig; return; }
            e.target.style.display = "none"; e.target.parentElement.textContent = sett.logo_letter || fallbackSettings.logo_letter; e.target.parentElement.style.background = sett.logo_color || fallbackSettings.logo_color;
          }} /> : (sett.logo_letter || fallbackSettings.logo_letter)}
        </div>
        <div className="store-info">
          <h1 className="store-name">{sett.biz_name || fallbackSettings.biz_name}</h1>
          <div className="store-status" style={{ color: isOpen ? "#3A7D44" : "#C62828" }}>
            {isOpen ? (storeStatus.msg ? `● Abierto · ${storeStatus.msg}` : "● Abierto ahora") : `● Cerrado${storeStatus.msg ? ` · ${storeStatus.msg}` : " — pedidos programados"}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => navigate("/mi-cuenta")} style={{ background: user ? "var(--ac)" : "var(--b2)", border: "none", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }} aria-label="Mi cuenta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={user ? "#fff" : "var(--tx)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {user && <div style={{ position: "absolute", top: -2, right: -2, width: 10, height: 10, background: "#3A7D44", borderRadius: "50%", border: "2px solid var(--bg)" }} />}
          </button>
          <button onClick={() => setShowMenu(true)} style={{ background: "var(--b2)", border: "none", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} aria-label="Menú">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
          </button>
        </div>
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
              <a href={waLink('Hola! Tengo una consulta')} target="_blank" rel="noopener noreferrer" style={{ width: "100%", padding: "14px 16px", background: "#25D366", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, color: "#fff", boxShadow: "var(--sh)", marginBottom: 8, textDecoration: "none" }}>
                💬 WhatsApp
              </a>
            </div>

            {/* FAQ */}
            <div style={{ padding: "0 16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Preguntas frecuentes</div>
              {[
                { q: "¿Cómo hago un pedido?", a: "Elegí los productos que quieras del catálogo, tocá el botón + para agregarlos, ajustá la cantidad y luego tocá \"Ver pedido\" para continuar con el checkout." },
                { q: "¿Cuáles son los medios de pago?", a: "Aceptamos Efectivo (pagás al recibir), Transferencia bancaria (CBU: 0000003100000535412820) y MercadoPago (alias: pato.jhs). Para transferencia y MP, subí el comprobante en el checkout." },
                { q: "¿Hacen delivery?", a: "Sí, hacemos delivery. También podés retirar en nuestro local: Andrés Chazarreta 1435, Villa Rosa, Pilar, Buenos Aires." },
                { q: "¿Puedo programar un pedido?", a: "Sí, en el checkout elegí \"Programar\" y seleccioná la fecha y hora. Ideal si querés tu pedido para otro día o si el local ya cerró." },
                { q: "¿Cómo sé el estado de mi pedido?", a: "Al confirmar tu pedido recibís un código. Tocá \"Seguí tu pedido\" en el menú e ingresá el código para ver el estado en tiempo real." },
                { q: "¿Puedo enviar un pedido como regalo?", a: "Sí, en el paso de pago activá la opción \"¿Es un regalo?\" y escribí un mensaje para la tarjeta." },
                { q: "¿Tienen cupones de descuento?", a: "Sí, si tenés un cupón podés ingresarlo en el paso de pago. Se aplica automáticamente al total." },
                { q: "¿Cuál es el horario de atención?", a: "Nuestro horario se muestra en la parte superior del catálogo. Fuera de horario podés programar tu pedido para el próximo día hábil." },
              ].map((f, i) => (
                <div key={i} style={{ borderBottom: "1px solid var(--b2)", overflow: "hidden" }}>
                  <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} style={{ width: "100%", padding: "12px 0", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", fontSize: 14, fontWeight: 600, color: "var(--tx)", fontFamily: "'DM Sans',sans-serif" }}>
                    {f.q}
                    <span style={{ fontSize: 16, color: "var(--t3)", transition: "transform .2s", transform: faqOpen === i ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
                  </button>
                  {faqOpen === i && <div style={{ padding: "0 0 12px", fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>{f.a}</div>}
                </div>
              ))}
            </div>

            {/* Banner Eventos / Catering */}
            <div style={{ padding: "0 16px 24px" }}>
              <a href={waLink('Hola! Tengo una consulta sobre los eventos')} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", background: "linear-gradient(135deg, #2D1B0E 0%, #5D4037 100%)", borderRadius: 16, padding: "20px 18px", color: "#fff", position: "relative", overflow: "hidden" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🍾🥂</div>
                <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, lineHeight: 1.3, marginBottom: 6 }}>¿Necesitás catering o coctelería para tu evento?</div>
                <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5, marginBottom: 14 }}>Personal, catering completo y coctelería para cumpleaños, reuniones, empresas y más.</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#25D366", padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                  💬 Consultanos por WhatsApp
                </div>
              </a>
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
        <div style={{ margin: "0 16px 8px", padding: "10px 16px", background: "rgba(255,248,225,0.95)", borderRadius: 12, fontSize: 13, color: "#8D6E00", textAlign: "center" }}>
          ⚠️ Modo offline — mostrando productos de ejemplo
        </div>
      )}

      {/* Banner tienda cerrada */}
      {!isOpen && (
        <div style={{ margin: "0 16px 12px", padding: "18px 20px", background: "var(--catalog-card-bg, #FFFBF7)", borderRadius: 16, textAlign: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>
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
              {c.img && <img className="cat-card-bg" src={optimizeImage(c.img, { width: 300, quality: 60 })} alt="" loading="lazy" fetchpriority="low" width={180} height={120} decoding="async" onError={e=>{
                const orig = originalImageUrl(e.target.src) || c.img;
                if (orig !== e.target.src) { disableImageTransforms(); e.target.src = orig; return; }
                e.target.style.display='none';
              }} />}
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
        <div style={{ position: "sticky", top: 0, zIndex: 40, background: "var(--catalog-sticky-bg, var(--bg))", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", transition: "background .3s ease" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--catalog-sticky-text, var(--tx))" }}>{(sett.cat_names || {})[selCat] || selCat}</span>
          <button onClick={() => setSelCat("Todos")} style={{ background: "rgba(255,255,255,0.2)", border: "none", fontSize: 12, color: "var(--catalog-sticky-text, var(--ac))", cursor: "pointer", fontWeight: 600, padding: "4px 10px", borderRadius: 8 }}>
            Ver todo ✕
          </button>
        </div>
      )}

      {/* Lista de Productos (memoized cards) */}
      <div className="prod-list">
        {filteredProds.map(p => (
          <ProductCard
            key={p.id}
            p={p}
            qty={getQty(p.id)}
            hasDeal={hasDeal(p)}
            dealPrice={getPrice(p)}
            originalPrice={p.sale_price}
            onAdd={addC}
            onUpdate={updQ}
            isFav={isFavorite(p.id)}
            onToggleFav={toggleFavorite}
            isLoggedIn={!!user}
          />
        ))}
      </div>

      {/* Carrito Flotante "Pedix Style" */}
      {cc > 0 && (
        <div className="pedix-cart-btn" data-testid="cart-fab" onClick={() => setShowCart(true)}>
          <div className="pcb-qty">{cc}</div>
          <div className="pcb-text">Ver pedido</div>
          <div className="pcb-price">${formatInt(ct)}</div>
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
                    <img className="ups-img" src={optimizeImage(s.image_url, { width: 200 })} alt={s.name} loading="lazy" width={48} height={48} onError={e => {
                      const orig = originalImageUrl(e.target.src) || s.image_url;
                      if (orig !== e.target.src) { disableImageTransforms(); e.target.src = orig; return; }
                      e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex';
                    }} />
                  ) : null}
                  <div className="ups-img prod-avatar" style={{ display: s.image_url ? 'none' : 'flex', background: avatarColors[s.name.charCodeAt(0) % avatarColors.length], width: 48, height: 48, fontSize: 20, borderRadius: 10 }}>{s.name.charAt(0)}</div>
                  <div className="ups-info">
                    <div className="ups-name">{s.name}</div>
                    <div className="ups-price">${formatInt(s.sale_price)}</div>
                  </div>
                  <button className="ups-btn">+</button>
                </div>
              ))}
            </div>
            <button className="ups-skip" onClick={() => setUpsell(null)}>No, gracias</button>
          </div>
        </div>
      )}

      {/* Banner Eventos / Catering inline */}
      <div style={{ padding: "8px 16px 0", background: "var(--catalog-bg, transparent)" }}>
        <a href={waLink('Hola! Tengo una consulta sobre los eventos')} target="_blank" rel="noopener noreferrer" className="event-banner">
          <div className="event-banner-content">
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, color: "#fff", lineHeight: 1.3 }}>¿Tenés un evento?</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4, lineHeight: 1.4 }}>Personal, catering y coctelería. Preguntá por nuestro servicio.</div>
            </div>
            <div style={{ background: "#25D366", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", flexShrink: 0 }}>💬 Consultar</div>
          </div>
        </a>
      </div>

      {/* WhatsApp flotante para soporte */}
      {ffWhatsapp && <a href={waLink(`Hola! Tengo una consulta sobre ${business.name}`)} target="_blank" rel="noopener noreferrer" className="wa-float" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>}

      {/* Push notification prompt */}
      {ffPush && <PushBanner />}


      {/* Footer legal */}
      <footer className="catalog-footer">
        <div className="footer-links">
          <a href="/terminos" target="_blank" rel="noopener noreferrer">Términos y Condiciones</a>
          <span className="footer-dot">·</span>
          <a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>
        </div>
        <p className="footer-copy">Copyright © {business.legal.copyrightYear} {sett.biz_name || business.name}. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
