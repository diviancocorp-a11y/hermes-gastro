import { useState, useCallback } from "react";
import { OrderStatus } from "../lib/utils";
import useFeature from "../hooks/useFeature";

// Hooks
import useAdminData from "../hooks/useAdminData";
import useOrderWorkflow from "../hooks/useOrderWorkflow";
import useFinancials from "../hooks/useFinancials";

// Componentes nuevos · chrome del Admin (sistema visual v2)
import AdminBackdrop from "../components/admin/shared/AdminBackdrop";
import AdminTopbar from "../components/admin/shared/AdminTopbar";
import BottomNav from "../components/admin/shared/BottomNav";
import AdminDrawer from "../components/admin/shared/AdminDrawer";
import AdminMore from "../components/admin/shared/AdminMore";
import BrandModal from "../components/admin/shared/BrandModal";

// Pantallas (todavía visuales viejos — se adaptan en próximos pasos)
import LoginScreen from "../components/admin/LoginScreen";
import Home from "../components/admin/Home";
import Stock from "../components/admin/Stock";
import Recipes from "../components/admin/Recipes";
import Orders from "../components/admin/Orders";
import { Expenses, Purchase, SalesView } from "../components/admin/Finance";
import CRM from "../components/admin/CRM";
import Waste from "../components/admin/Waste";
import Settings from "../components/admin/Settings";
import Exports from "../components/admin/Exports";
import Invoicing from "../components/admin/Invoicing";
import PushNotifications from "../components/admin/PushNotifications";
import CategoryEditor from "../components/admin/CategoryEditor";
import MonthSummary from "../components/admin/MonthSummary";
import Suppliers from "../components/admin/Suppliers";
import { CancelDlg, StockWarningDlg, NewOrderOverlay } from "../components/admin/Dialogs";

// Estilos del sistema visual v2
import "../styles/admin-tokens.css";
import "../styles/admin-bg.css";
import "../styles/admin-topbar.css";
import "../styles/admin-bottomnav.css";
import "../styles/admin-cards.css";
import "../styles/admin-orders.css";
import "../styles/admin-shared.css";

export default function Admin() {
  const [tab, setTab] = useState("home");
  const [ov, setOv] = useState(null);
  const [toast, setToast] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('ag-theme') || 'light' } catch { return 'light' }
  });

  // Feature flags
  const ffInvoice = useFeature('E_INVOICE');

  const msg = useCallback(m => { setToast(m); setTimeout(() => setToast(""), 2200); }, []);

  const handleThemeChange = useCallback((next) => {
    setTheme(next);
    try { localStorage.setItem('ag-theme', next) } catch { /* noop */ }
  }, []);

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
    wastePct, monthFixedExpenses, monthVariableExpenses,
    monthGrossMargin, grossMarginPct,
  } = useFinancials({ ings, recs, sales, exps, orders, waste, settings: sett });

  // Order workflow
  const { moveOrder: moveOrd, confirmCancel, addOrder: addOrd } = useOrderWorkflow({
    orders, setOrders, recs, ings, setIngs, sett, loaded, setSales, setOv, msg,
  });

  // Loading / Login gates
  if (checking) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--ag-ink-3)" }}>Cargando...</div>;
  if (!session) return <LoginScreen onLogin={doLogin} />;

  const DEF = DEFAULT_SETTINGS;
  const themeClass = theme === 'dark' ? 'ag-theme-dark' : 'ag-theme-light';
  const newOrdersCount = orders.filter(o => o.status === OrderStatus.NEW).length;

  /* ─── Bottom nav: 5 secciones (Inicio · Pedidos · Compras · Gastos · Más) ─── */
  const handleNavChange = (nextTab) => {
    // home, orders, purchase, expenses, more son TODOS tabs reales
    // (purchase y expenses ya no son overlays, así no tapan la bottom nav)
    setTab(nextTab);
  };

  /* ─── Hub "Más": abre sub-pantallas ─── */
  const handleOpenMore = (key) => {
    switch (key) {
      case 'stock':     setTab('stock'); break;
      case 'recipes':   setTab('recipes'); break;
      case 'sales':     setTab('sales'); break;
      case 'crm':       setTab('crm'); break;
      case 'waste':     setTab('waste'); break;
      case 'suppliers': setTab('suppliers'); break;
      case 'settings':  setTab('settings'); break;
      case 'invoicing': setOv({ type: 'invoicing' }); break;
      case 'exports':   setOv({ type: 'exports' }); break;
      default: break;
    }
  };

  /* Mapeo del tab activo al item resaltado en el bottom nav.
     Si estamos en una sub-pantalla del hub Más (stock, recipes, sales, crm, waste,
     suppliers, settings, summary), el item "Más" queda activo. */
  const activeNav =
    tab === 'home' || tab === 'orders' || tab === 'purchase' || tab === 'expenses' ? tab :
    'more';

  const businessName = sett.biz_name || DEF.biz_name;
  const avatarLetter = (sett.logo_letter || DEF.logo_letter || businessName.charAt(0) || 'A').toUpperCase();

  return (
    <div className={`ag-root ${themeClass}`} style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AdminBackdrop />

      {toast && <div className="toast" style={{ zIndex: 1000 }}>{toast}</div>}

      <AdminTopbar
        title={businessName}
        avatarText={avatarLetter}
        avatarImage={sett.logo_url || null}
        onMenu={() => setDrawerOpen(true)}
        onAvatar={() => setBrandOpen(true)}
      />

      <main style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: 'var(--ag-bottom-nav-h, 76px)' }}>
        {tab === "home"     && <Home user={session?.user} lowStockIngredients={low} monthSales={tS} monthExpenses={tE} monthProfit={prof} profitMargin={mar} sales={sales} orders={orders} recipes={recs} ingredients={ings} calculateRecipeCost={rc} activeOrders={actOrd} settings={sett} waste={waste} onStock={() => setTab("stock")} onOrders={() => setTab("orders")} onShowToast={msg} onMonthSummary={() => setTab("summary")} />}
        {tab === "summary"  && <MonthSummary sales={sales} expenses={exps} orders={orders} recipes={recs} ingredients={ings} waste={waste} settings={sett} calculateRecipeCost={rc} onBack={() => setTab("home")} />}
        {tab === "orders"   && <Orders orders={orders} recipes={recs} moveOrderStatus={moveOrd} addOrder={addOrd} overlay={ov} setOverlay={setOv} showToast={msg} settings={sett} onUpdateOrder={(id, changes) => setOrders(p => p.map(o => o.id === id ? { ...o, ...changes } : o))} />}
        {tab === "stock"    && <Stock ingredients={ings} setIngredients={setIngs} recipes={recs} overlay={ov} setOverlay={setOv} showToast={msg} settings={sett} setSettings={setSett} loadAll={loadAll} />}
        {tab === "recipes"  && <Recipes recipes={recs} setRecipes={setRecs} ingredients={ings} calculateRecipeCost={rc} overlay={ov} setOverlay={setOv} showToast={msg} loadAll={loadAll} settings={sett} />}
        {tab === "sales"    && <SalesView sales={sales} setSales={setSales} orders={orders} recipes={recs} calculateRecipeCost={rc} overlay={ov} setOverlay={setOv} showToast={msg} />}
        {tab === "crm"      && <CRM orders={orders} recipes={recs} ingredients={ings} showToast={msg} />}
        {tab === "waste"    && <Waste waste={waste} orders={orders} recipes={recs} ingredients={ings} setIngredients={setIngs} showToast={msg} loadAll={loadAll} />}
        {tab === "suppliers" && <Suppliers onBack={() => setTab("home")} showToast={msg} />}
        {tab === "purchase"  && <Purchase ingredients={ings} setIngredients={setIngs} expenses={exps} setExpenses={setExps} settings={sett} onClose={() => setTab("home")} showToast={msg} loadAll={loadAll} user={session?.user} />}
        {tab === "expenses"  && <Expenses expenses={exps} setExpenses={setExps} settings={sett} setSettings={setSett} showToast={msg} onClose={() => setTab("home")} user={session?.user} />}
        {tab === "settings" && <Settings settings={sett} setSettings={setSett} showToast={msg} theme={theme} onThemeChange={handleThemeChange} exportData={{ sales, expenses: exps, ingredients: ings, orders, recipes: recs, sett }} />}
        {tab === "more"     && <AdminMore onOpen={handleOpenMore} ffInvoice={ffInvoice} />}
      </main>

      {/* Overlays (sin cambios) */}
      {ov?.type === "cancel"       && <CancelDlg order={ov.order} recs={recs} ings={ings} onClose={() => setOv(null)} onConfirm={ret => confirmCancel(ov.orderId, ret)} />}
      {ov?.type === "stockWarning" && <StockWarningDlg deficits={ov.deficits} onClose={() => setOv(null)} onForce={async () => { setOv(null); await moveOrd(ov.orderId, OrderStatus.PREPARING, true); }} />}
      {ov?.type === "exports"      && <Exports sales={sales} expenses={exps} ingredients={ings} orders={orders} recipes={recs} sett={sett} msg={msg} onClose={() => setOv(null)} />}
      {ov?.type === "invoicing"    && <Invoicing orders={orders} recipes={recs} sett={sett} msg={msg} onClose={() => setOv(null)} />}
      {ov?.type === "push"         && <PushNotifications msg={msg} onClose={() => setOv(null)} />}
      {ov?.type === "categories"   && <CategoryEditor msg={msg} onClose={() => setOv(null)} />}

      {/* New order alert overlay */}
      {newAlertCount > 0 && <NewOrderOverlay count={newAlertCount} onAck={() => { ackOrders(); setTab('orders'); }} />}

      <BottomNav
        active={activeNav}
        onChange={handleNavChange}
        badges={{ orders: newOrdersCount }}
      />

      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        businessName={businessName}
        userEmail={session?.user?.email || ''}
        onLogout={() => { setDrawerOpen(false); doLogout(); }}
      >
        <Settings
          settings={sett}
          setSettings={setSett}
          showToast={msg}
          theme={theme}
          onThemeChange={handleThemeChange}
          exportData={{ sales, expenses: exps, ingredients: ings, orders, recipes: recs, sett }}
        />
      </AdminDrawer>

      <BrandModal
        open={brandOpen}
        onClose={() => setBrandOpen(false)}
        settings={sett}
        setSettings={setSett}
        showToast={msg}
      />
    </div>
  );
}
