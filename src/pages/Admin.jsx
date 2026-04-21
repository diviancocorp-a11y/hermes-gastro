import { useState, useCallback } from "react";
import { Icon, OrderStatus } from "../lib/utils";
import useFeature from "../hooks/useFeature";

// Hooks
import useAdminData from "../hooks/useAdminData";
import useOrderWorkflow from "../hooks/useOrderWorkflow";
import useFinancials from "../hooks/useFinancials";

// Components
import LoginScreen from "../components/admin/LoginScreen";
import Home from "../components/admin/Home";
import Stock from "../components/admin/Stock";
import Recipes from "../components/admin/Recipes";
import Orders from "../components/admin/Orders";
import { Expenses, Purchase, SalesView } from "../components/admin/Finance";
import CRM from "../components/admin/CRM";
import Waste from "../components/admin/Waste";
import Settings from "../components/admin/Settings";
import Analytics from "../components/admin/Analytics";
import Exports from "../components/admin/Exports";
import Invoicing from "../components/admin/Invoicing";
import Reviews from "../components/admin/Reviews";
import PushNotifications from "../components/admin/PushNotifications";
import CategoryEditor from "../components/admin/CategoryEditor";
import FeatureFlags from "../components/admin/FeatureFlags";
import ThemeBuilder from "../components/admin/ThemeBuilder";
import { CancelDlg, StockWarningDlg, NewOrderOverlay } from "../components/admin/Dialogs";

export default function Admin() {
  const [tab, setTab] = useState("home");
  const [ov, setOv] = useState(null);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Feature flags
  const ffInvoice = useFeature('E_INVOICE');
  const ffReviews = useFeature('REVIEWS');
  const ffPush = useFeature('PUSH_NOTIFICATIONS');
  const ffReferral = useFeature('REFERRAL');

  const msg = useCallback(m => { setToast(m); setTimeout(() => setToast(""), 2200); }, []);

  // Data layer
  const {
    session, checking, doLogin, doLogout,
    ings, setIngs, recs, setRecs, sales, setSales,
    exps, setExps, orders, setOrders, sett, setSett,
    waste, loaded, loadAll, newAlertCount, ackOrders,
    DEFAULT_SETTINGS,
  } = useAdminData();

  // Financial computations
  const {
    calculateRecipeCost: rc, lowStockIngredients: low, activeOrders: actOrd,
    monthSales: tS, monthExpenses: tE, monthProductionCost: tCR,
    monthWasteCost: tW, monthProfit: prof, profitMargin: mar,
  } = useFinancials({ ings, recs, sales, exps, orders, waste });

  // Order workflow
  const { moveOrder: moveOrd, confirmCancel, addOrder: addOrd } = useOrderWorkflow({
    orders, setOrders, recs, ings, setIngs, sett, loaded, setSales, setOv, msg,
  });

  // Loading / Login gates
  if (checking) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--t3)" }}>Cargando...</div>;
  if (!session) return <LoginScreen onLogin={doLogin} />;

  const DEF = DEFAULT_SETTINGS;

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div className="hd">
        <div className="hd-l" style={{ background: sett.logo_color || DEF.logo_color }}>{sett.logo_letter || DEF.logo_letter}</div>
        <div><div className="hd-t">{sett.biz_name || DEF.biz_name}</div><div className="hd-s">Gestión Operativa</div></div>
        <div className="hd-r">
          <button className="hb" onClick={() => setTab("settings")}>{Icon.settings({ size: 18 })}</button>
          <button className="hb" onClick={doLogout} title="Cerrar sesión">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === "home" && <Home lowStockIngredients={low} monthSales={tS} monthExpenses={tE} monthWasteCost={tW} monthProfit={prof} profitMargin={mar} monthProductionCost={tCR} sales={sales} recipes={recs} ingredients={ings} calculateRecipeCost={rc} activeOrders={actOrd} settings={sett} waste={waste} onStock={() => setTab("stock")} onPurchase={() => setOv({ type: "purchase" })} onOrders={() => setTab("orders")} onExp={() => setOv({ type: "expenses" })} />}
      {tab === "stock" && <Stock ingredients={ings} setIngredients={setIngs} recipes={recs} overlay={ov} setOverlay={setOv} showToast={msg} settings={sett} loadAll={loadAll} />}
      {tab === "recipes" && <Recipes recipes={recs} setRecipes={setRecs} ingredients={ings} calculateRecipeCost={rc} overlay={ov} setOverlay={setOv} showToast={msg} loadAll={loadAll} />}
      {tab === "orders" && <Orders orders={orders} recipes={recs} moveOrderStatus={moveOrd} addOrder={addOrd} overlay={ov} setOverlay={setOv} showToast={msg} settings={sett} onUpdateOrder={(id, changes) => setOrders(p => p.map(o => o.id === id ? { ...o, ...changes } : o))} />}
      {tab === "sales" && <SalesView sales={sales} setSales={setSales} orders={orders} recipes={recs} calculateRecipeCost={rc} overlay={ov} setOverlay={setOv} showToast={msg} />}
      {tab === "crm" && <CRM orders={orders} recipes={recs} ingredients={ings} showToast={msg} />}
      {tab === "waste" && <Waste waste={waste} orders={orders} recipes={recs} ingredients={ings} />}
      {tab === "analytics" && <Analytics sales={sales} orders={orders} recipes={recs} calculateRecipeCost={rc} />}
      {tab === "reviews" && ffReviews && <Reviews msg={msg} />}
      {tab === "settings" && <Settings settings={sett} setSettings={setSett} showToast={msg} onBack={() => setTab("home")} />}

      {/* Overlays */}
      {ov?.type === "purchase" && <Purchase ingredients={ings} setIngredients={setIngs} expenses={exps} setExpenses={setExps} settings={sett} onClose={() => setOv(null)} showToast={msg} loadAll={loadAll} />}
      {ov?.type === "expenses" && <Expenses expenses={exps} setExpenses={setExps} settings={sett} showToast={msg} onClose={() => setOv(null)} />}
      {ov?.type === "cancel" && <CancelDlg order={ov.order} recs={recs} ings={ings} onClose={() => setOv(null)} onConfirm={ret => confirmCancel(ov.orderId, ret)} />}
      {ov?.type === "stockWarning" && <StockWarningDlg deficits={ov.deficits} onClose={() => setOv(null)} onForce={async () => { setOv(null); await moveOrd(ov.orderId, OrderStatus.prep, true); }} />}
      {ov?.type === "exports" && <Exports sales={sales} expenses={exps} ingredients={ings} orders={orders} recipes={recs} sett={sett} msg={msg} onClose={() => setOv(null)} />}
      {ov?.type === "invoicing" && <Invoicing orders={orders} recipes={recs} sett={sett} msg={msg} onClose={() => setOv(null)} />}
      {ov?.type === "push" && <PushNotifications msg={msg} onClose={() => setOv(null)} />}
      {ov?.type === "categories" && <CategoryEditor msg={msg} onClose={() => setOv(null)} />}
      {ov?.type === "flags" && <FeatureFlags msg={msg} onClose={() => setOv(null)} />}
      {ov?.type === "theme" && <ThemeBuilder msg={msg} onClose={() => setOv(null)} />}

      {/* New order alert overlay */}
      {newAlertCount > 0 && <NewOrderOverlay count={newAlertCount} onAck={() => { ackOrders(); setTab('orders'); }} />}

      {/* Hamburger menu */}
      {menuOpen && <>
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 900 }} />
        <div style={{ position: "fixed", bottom: 64, right: 12, background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", zIndex: 901, padding: "6px 0", minWidth: 180, animation: "fadeIn .15s ease" }}>
          {[{ id: "stock", icon: Icon.box, l: "Stock" }, { id: "recipes", icon: Icon.recipe, l: "Recetas" }, { id: "sales", icon: Icon.cart, l: "Ventas" }, { id: "analytics", icon: Icon.chart || Icon.settings, l: "Analytics" }, { id: "exports", icon: Icon.download, l: "Exportar", action: () => setOv({ type: "exports" }) }, { id: "invoicing", icon: Icon.recipe, l: "Facturación", action: () => setOv({ type: "invoicing" }), show: ffInvoice }, { id: "waste", icon: Icon.alert, l: "Mermas" }, { id: "reviews", icon: Icon.fire, l: "Reseñas", show: ffReviews }, { id: "crm", icon: Icon.user, l: "CRM" }, { id: "push", icon: Icon.bell, l: "Push", action: () => setOv({ type: "push" }), show: ffPush }, { id: "categories", icon: Icon.box, l: "Categorías", action: () => setOv({ type: "categories" }) }, { id: "flags", icon: Icon.settings, l: "Flags", action: () => setOv({ type: "flags" }) }, { id: "theme", icon: Icon.fire, l: "Tema", action: () => setOv({ type: "theme" }) }].filter(t => t.show !== false).map(t => (
            <button key={t.id} onClick={() => { if (t.action) { t.action(); } else { setTab(t.id); } setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 18px", border: "none", background: tab === t.id ? "var(--b1,#f5f0eb)" : "transparent", color: tab === t.id ? "var(--pr,#C45D3E)" : "var(--tx,#333)", fontSize: 14, fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", textAlign: "left" }}>
              {t.icon({ size: 18 })}{t.l}
            </button>
          ))}
        </div>
      </>}

      {/* Bottom navigation */}
      <nav className="nv">
        {[{ id: "home", icon: Icon.home, l: "Inicio" }, { id: "orders", icon: Icon.orders, l: "Pedidos", badge: orders.filter(o => o.status === OrderStatus.new).length }, { id: "purchase", icon: Icon.truck, l: "Compras", action: () => setOv({ type: "purchase" }) }, { id: "expenses", icon: Icon.dollar, l: "Gastos", action: () => setOv({ type: "expenses" }) }].map(t => (
          <button key={t.id} className={`ni ${tab === t.id || (tab === "settings" && t.id === "home") ? "on" : ""}`} onClick={() => { if (t.action) { t.action(); } else { setTab(t.id); } }}>
            {t.badge > 0 && <span className="nb">{t.badge}</span>}
            {t.icon({ size: 20 })}{t.l}
          </button>
        ))}
        <button className={`ni ${["stock", "recipes", "sales", "analytics", "waste", "crm", "reviews"].includes(tab) ? "on" : ""}`} onClick={() => setMenuOpen(p => !p)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          Más
        </button>
      </nav>
    </div>
  );
}
