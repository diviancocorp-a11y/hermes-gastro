import { useState, useEffect, useMemo } from "react";
import { Icon, formatInt, todayISO, generateId, OrderStatus, OrderStatusLabels, OrderStatusColors, OrderStatusBorders, formatOrderCode } from "../../lib/utils";
import { verifyReceipt, getReceiptUrl } from "../../lib/adminService";
import { paymentLabel, paymentIcon, enabledPaymentMethods } from "../../lib/payments";
import OrderCard from "./shared/orders/OrderCard";
import { fetchDeliveryChannels, calcCommission } from "../../services/deliveryChannels";

// Mapeo status DB → status visual de OrderCard
const STATUS_MAP = {
  [OrderStatus.NEW]:       'new',
  [OrderStatus.PREPARING]: 'prep',
  [OrderStatus.ACTIVE]:    'ready',
  [OrderStatus.COMPLETED]: 'done',
  [OrderStatus.CANCELLED]: 'cancelled',
};
// Próximo estado en el flujo (para swipe-right)
const NEXT_STATUS = {
  [OrderStatus.NEW]:       OrderStatus.PREPARING,
  [OrderStatus.PREPARING]: OrderStatus.ACTIVE,
  [OrderStatus.ACTIVE]:    OrderStatus.COMPLETED,
};

const AV_COLORS = ['#E85A4A', '#6B5BD6', '#3A8B9F', '#D4894A', '#2A9D6E', '#E8A53A'];

// Helper: mapea un order de DB a las props que espera OrderCard. Defensivo:
// - Tolera created_at/date faltantes (usa epoch / ahora)
// - Tolera id null
// - Tolera items vacíos o sin recipe_id
function toCardProps(o, recipes = []) {
  if (!o) return null;

  const rawItems = o.order_items || o.items || [];
  const items = rawItems.slice(0, 3).map(it => {
    const r = recipes.find(x => x.id === it.recipe_id);
    return { qty: it.quantity || it.qty || 1, name: r?.name || '?' };
  });

  // Tiempo desde creado. Si no hay fecha válida, default 0 min.
  let minutes = 0;
  const tsRaw = o.created_at || (o.date ? `${o.date}T12:00:00` : null);
  if (tsRaw) {
    const created = new Date(tsRaw);
    if (!isNaN(created.getTime())) {
      minutes = Math.max(0, Math.floor((Date.now() - created.getTime()) / 60000));
    }
  }

  // ID legible
  let idStr = '----';
  if (o.id != null) {
    try {
      idStr = formatOrderCode ? formatOrderCode(o.id) : String(o.id).slice(-4);
    } catch { idStr = String(o.id).slice(-4); }
  }

  const idForColor = String(o.id || 'x');
  const avIdx = (idForColor.charCodeAt(0) || 0) % AV_COLORS.length;

  return {
    id: idStr,
    customer: o.customer || 'Cliente',
    avatarBg: AV_COLORS[avIdx],
    mode: o.delivery === 'envio' ? 'Delivery' : 'Retiro',
    total: o.total ? `$${formatInt(o.total)}` : '',
    items,
    status: STATUS_MAP[o.status] || 'new',
    minutes,
    phone: o.phone || o.customer_phone || '',
  };
}

// ─── Pedidos demo (no se guardan en DB) ───
const DEMO_ORDERS = [
  { id: 'demo-1', customer: 'Camila Méndez', avatarBg: '#E85A4A', mode: 'Delivery', total: '$8.450',
    items: [{qty:2, name:'Empanada de carne'}, {qty:1, name:'Coca 500ml'}],
    status: 'new', minutes: 3, phone: '5491155555555' },
  { id: 'demo-2', customer: 'Lucas Pérez', avatarBg: '#6B5BD6', mode: 'Retiro', total: '$12.300',
    items: [{qty:1, name:'Pizza Napolitana'}, {qty:1, name:'Agua sin gas'}],
    status: 'new', minutes: 14, phone: '5491166666666' },
  { id: 'demo-3', customer: 'Mara Suárez', avatarBg: '#3A8B9F', mode: 'Delivery', total: '$6.200',
    items: [{qty:1, name:'Lomito completo'}],
    status: 'new', minutes: 26, phone: '5491177777777' },
];

function DeliveryBadge({date}){
  if(!date)return null;
  const today=todayISO();
  const tom=new Date();tom.setDate(tom.getDate()+1);const tomStr=tom.toISOString().split("T")[0];
  const past=date<today;
  const label=date===today?"🔴 Para HOY":date===tomStr?"🟡 Para MAÑANA":past?`⚠️ Vencido ${new Date(date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"})}`:`📅 Para el ${new Date(date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"})}`;
  const bg=past?"var(--ag-c-orders-soft)":date===today?"var(--ag-c-orders-soft)":date===tomStr?"var(--ag-c-stock-soft)":"var(--ag-bg-soft)";
  const co=past?"var(--ag-c-orders)":date===today?"var(--ag-c-orders)":date===tomStr?"var(--ag-c-stock)":"var(--ag-ink-3)";
  return(<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8,background:bg,color:co}}>{label}</span>);
}

function Orders({orders,recipes,moveOrderStatus,addOrder,overlay,setOverlay,showToast,settings,onUpdateOrder}){
  const [fil,setFil]=useState(OrderStatus.NEW);const [showH,setShowH]=useState(false);const [showSched,setShowSched]=useState(false);const t=todayISO();
  const [histPage,setHistPage]=useState(1);const HIST_PER_PAGE=20;
  const [viewReceipt,setViewReceipt]=useState(null); // order object to view receipt

  // ─── Demo mode: 3 pedidos de ejemplo que pasan por todas las etapas ───
  // Útil para probar el flujo de swipe sin tener que crear pedidos reales.
  const [demoActive, setDemoActive] = useState(false);
  const [demoOrders, setDemoOrders] = useState(DEMO_ORDERS);

  // Mapeo de status del OrderCard → tab del filtro
  const DEMO_STATUS_TO_TAB = {
    new:       OrderStatus.NEW,
    prep:      OrderStatus.PREPARING,
    ready:     OrderStatus.ACTIVE,
    done:      OrderStatus.COMPLETED,
    cancelled: OrderStatus.CANCELLED,
  };
  const DEMO_FLOW_NEXT = { new: 'prep', prep: 'ready', ready: 'done' };
  const DEMO_NEXT_LABEL = { new: 'En preparación', prep: 'Listo', ready: 'Entregado' };

  const advanceDemo = (id) => setDemoOrders(prev => prev.map(d => {
    if (d.id !== id) return d;
    const nxt = DEMO_FLOW_NEXT[d.status];
    if (!nxt) return d;
    showToast(`(Demo) ${d.customer} → ${DEMO_NEXT_LABEL[d.status]}`);
    return { ...d, status: nxt, minutes: 0 }; // reset minutos al avanzar
  }));
  const cancelDemo = (id) => setDemoOrders(prev => prev.map(d => {
    if (d.id !== id) return d;
    showToast(`(Demo) ${d.customer} cancelado`);
    return { ...d, status: 'cancelled' };
  }));
  const resetDemos = () => { setDemoOrders(DEMO_ORDERS); };

  // Calcular si el local está abierto ahora (misma lógica que Catalog)
  const storeIsOpen=useMemo(()=>{
    if(settings?.store_open===false)return false;
    const hrs=settings?.store_hours;if(!hrs)return true;
    const now=new Date();const dayIdx=(now.getDay()+6)%7;
    const day=hrs[dayIdx];if(!day||day.closed)return false;
    if(!day.open||!day.close)return true;
    const nowMins=now.getHours()*60+now.getMinutes();
    const [oh,om]=day.open.split(":").map(Number);
    const [ch,cm]=day.close.split(":").map(Number);
    return nowMins>=oh*60+om&&nowMins<ch*60+cm;
  },[settings]);

  // Pedidos programados: solo los de HOY (o vencidos) que no estén finalizados
  // Se muestran solo cuando el local está abierto
  const scheduled=useMemo(()=>orders.filter(o=>o.delivery_date&&o.status!==OrderStatus.COMPLETED&&o.status!==OrderStatus.CANCELLED&&(o.delivery_date<=t)).sort((a,b)=>(a.delivery_date||"").localeCompare(b.delivery_date||"")),[orders,t]);
  // Programados futuros (para referencia)
  const scheduledFuture=useMemo(()=>orders.filter(o=>o.delivery_date&&o.status!==OrderStatus.COMPLETED&&o.status!==OrderStatus.CANCELLED&&o.delivery_date>t).sort((a,b)=>(a.delivery_date||"").localeCompare(b.delivery_date||"")),[orders,t]);

  // Counts: para "new" solo contar pedidos de hoy sin delivery_date
  const cts=useMemo(()=>{const c={};Object.values(OrderStatus).forEach(s=>{
    if(s===OrderStatus.NEW)c[s]=orders.filter(o=>o.status===s&&o.date===t&&!o.delivery_date).length;
    else if(s===OrderStatus.COMPLETED||s===OrderStatus.CANCELLED)c[s]=orders.filter(o=>o.status===s&&o.date===t).length;
    else c[s]=orders.filter(o=>o.status===s).length;
  });return c;},[orders,t]);

  // Filtrado: NEW = solo hoy sin delivery_date; COMPLETED/CANCELLED = solo hoy; resto = todos
  const filt=useMemo(()=>orders.filter(o=>{
    if(fil===OrderStatus.NEW)return o.status===fil&&o.date===t&&!o.delivery_date;
    if(fil===OrderStatus.COMPLETED||fil===OrderStatus.CANCELLED)return o.status===fil&&o.date===t;
    return o.status===fil;
  }).sort((a,b)=>(b.created_at||b.date||"").localeCompare(a.created_at||a.date||"")),[orders,fil,t]);
  const hist=useMemo(()=>orders.filter(o=>(o.status===OrderStatus.COMPLETED||o.status===OrderStatus.CANCELLED)&&o.date<t).sort((a,b)=>(b.created_at||b.date||"").localeCompare(a.created_at||a.date||"")),[orders,t]);
  const histPaged=useMemo(()=>hist.slice(0,histPage*HIST_PER_PAGE),[hist,histPage]);
  const histGrouped=useMemo(()=>Object.entries(histPaged.reduce((a,o)=>{const d=(o.created_at||o.date||"").split("T")[0];if(!a[d])a[d]=[];a[d].push(o);return a;},{})).sort((a,b)=>b[0].localeCompare(a[0])),[histPaged]);
  const nxt=s=>({[OrderStatus.NEW]:{l:"Preparar",c:"byw",i:Icon.fire,n:OrderStatus.PREPARING},[OrderStatus.PREPARING]:{l:"Marcar activo",c:"bgn",i:Icon.zap,n:OrderStatus.ACTIVE},[OrderStatus.ACTIVE]:{l:"Completar",c:"bbl",i:Icon.check,n:OrderStatus.COMPLETED}}[s]||null);
  const sfs=[{id:OrderStatus.NEW,l:"Nuevos",i:Icon.orders,co:"var(--ag-c-prep)"},{id:OrderStatus.PREPARING,l:"Preparando",i:Icon.fire,co:"var(--ag-c-stock)"},{id:OrderStatus.ACTIVE,l:"Activos",i:Icon.zap,co:"var(--ag-c-sales)"},{id:OrderStatus.COMPLETED,l:"Listos",i:Icon.check,co:"var(--ag-ink-3)"},{id:OrderStatus.CANCELLED,l:"Cancel.",i:Icon.x,co:"var(--ag-c-orders)"}];

  return(<>
    {/* ─── Header nuevo: título + contador activos + acciones ─── */}
    <div style={{ padding: '12px 16px 6px', position: 'relative', zIndex: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 800,
              fontSize: 22,
              margin: 0,
              color: 'var(--ag-ink)',
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
            }}>Pedidos</h1>
            {(() => {
              const activeCount = (cts[OrderStatus.NEW] || 0) + (cts[OrderStatus.PREPARING] || 0) + (cts[OrderStatus.ACTIVE] || 0);
              if (activeCount === 0) return (
                <span style={{ fontSize: 11.5, color: 'var(--ag-ink-3)', fontWeight: 600 }}>· sin actividad</span>
              );
              return (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px',
                  background: 'var(--ag-c-orders)', color: '#fff',
                  borderRadius: 999,
                  fontSize: 11, fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>{activeCount} activo{activeCount > 1 ? 's' : ''}</span>
              );
            })()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowSched(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px',
              background: 'var(--ag-bg-card)',
              border: '1px solid var(--ag-line)',
              borderRadius: 999,
              color: 'var(--ag-ink-2)',
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--ag-sh-sm)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Programados</span>
            {(scheduled.length + scheduledFuture.length) > 0 && (
              <span style={{
                background: 'var(--ag-c-stock)', color: '#fff',
                borderRadius: 999, padding: '0 6px',
                fontSize: 10, fontWeight: 800,
              }}>{scheduled.length + scheduledFuture.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowH(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px',
              background: 'var(--ag-bg-card)',
              border: '1px solid var(--ag-line)',
              borderRadius: 999,
              color: 'var(--ag-ink-2)',
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--ag-sh-sm)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9" />
              <polyline points="3 5 3 12 10 12" />
              <polyline points="12 8 12 13 16 15" />
            </svg>
            <span>Historial</span>
          </button>
        </div>
      </div>
    </div>
    {/* ─── Tabs de filtros (pills horizontales con scroll) ─── */}
    <div className="ag-o-tabs">
      {sfs.map(sf => {
        const on = fil === sf.id;
        const count = cts[sf.id] || 0;
        return (
          <button
            key={sf.id}
            type="button"
            className={`ag-o-tab ${on ? 'on' : ''}`}
            style={on ? { '--tab-color': sf.co } : undefined}
            onClick={() => setFil(sf.id)}
          >
            <span style={{ display: 'inline-flex' }}>
              {sf.i({ size: 13, color: on ? sf.co : 'var(--ag-ink-3)' })}
            </span>
            <span>{sf.l}</span>
            {count > 0 && (
              <span className="ag-o-tab-count" style={on ? { background: sf.co, color: '#fff' } : undefined}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
    <div className="s">
      {/* Lista de pedidos reales con el nuevo OrderCard */}
      {filt.map(o => {
        const cardProps = toCardProps(o, recipes);
        const next = NEXT_STATUS[o.status];
        return (
          <OrderCard
            key={o.id}
            order={cardProps}
            onPrimary={next ? () => {
              moveOrderStatus(o.id, next);
              showToast(`Pedido ${cardProps.id} → ${OrderStatusLabels[next] || next}`);
            } : undefined}
            onCancel={() => setOverlay({ type: 'cancel', orderId: o.id, order: o })}
            onGhost={() => onUpdateOrder?.(o.id, { _showDetail: true })}
          />
        );
      })}

      {/* Demos visibles · se filtran por tab activo según su status */}
      {demoActive && demoOrders
        .filter(d => DEMO_STATUS_TO_TAB[d.status] === fil)
        .map(d => (
          <OrderCard
            key={d.id}
            order={d}
            onPrimary={d.status !== 'done' && d.status !== 'cancelled' ? () => advanceDemo(d.id) : undefined}
            onCancel={d.status !== 'done' && d.status !== 'cancelled' ? () => cancelDemo(d.id) : undefined}
          />
        ))
      }

      {/* Empty state cuando no hay reales ni demos visibles */}
      {filt.length === 0 && (!demoActive || demoOrders.filter(d => DEMO_STATUS_TO_TAB[d.status] === fil).length === 0) && (
        <div className="ag-card" style={{ padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>
            {fil === OrderStatus.NEW ? '📋' : fil === OrderStatus.PREPARING ? '👨‍🍳' : fil === OrderStatus.ACTIVE ? '⚡' : '✓'}
          </div>
          <div style={{ color: 'var(--ag-ink-3)', fontSize: 13, marginBottom: 14 }}>
            No hay pedidos {OrderStatusLabels[fil]?.toLowerCase()}
          </div>
          {fil === OrderStatus.NEW && !demoActive && (
            <button
              type="button"
              onClick={() => { setDemoActive(true); setDemoOrders(DEMO_ORDERS); }}
              style={{
                padding: '8px 16px',
                background: 'var(--ag-c-terra, #F59E0B)',
                color: '#fff', border: 0, borderRadius: 999,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >Ver 3 pedidos demo (swipe para probar)</button>
          )}
          {demoActive && (
            <button
              type="button"
              onClick={resetDemos}
              style={{
                padding: '6px 14px',
                background: 'transparent', color: 'var(--ag-c-terra, #F59E0B)',
                border: '1px solid var(--ag-c-terra, #F59E0B)', borderRadius: 999,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', marginTop: 6,
              }}
            >↺ Reiniciar demos</button>
          )}
        </div>
      )}

      {/* Botón flotante para reiniciar demos cuando hay alguno avanzado */}
      {demoActive && demoOrders.some(d => d.status !== 'new') && filt !== OrderStatus.NEW && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button
            type="button"
            onClick={resetDemos}
            style={{
              padding: '6px 14px',
              background: 'transparent', color: 'var(--ag-c-terra, #F59E0B)',
              border: '1px solid var(--ag-c-terra, #F59E0B)', borderRadius: 999,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >↺ Reiniciar demos</button>
        </div>
      )}
    </div>
    {/* CTA centrado al fondo de la lista de pedidos · reemplaza el FAB "+" */}
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 16px 90px' }}>
      <button
        type="button"
        className="ag-cta"
        onClick={() => setOverlay({ type: 'addOrder' })}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Registrar un pedido</span>
      </button>
    </div>
    {overlay?.type==="addOrder"&&<OrdForm recipes={recipes} settings={settings} onClose={()=>setOverlay(null)} onSave={o=>{addOrder(o);setOverlay(null);}}/>}
    {/* ─── Programados ─── */}
    {showSched && (
      <div className="ag-page-over">
        <div className="ag-page-over-head">
          <button type="button" className="ag-subpage-back" onClick={() => setShowSched(false)} aria-label="Volver">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Atrás</span>
          </button>
          <h2 className="ag-page-over-title">Programados</h2>
        </div>
        <div className="ag-page-over-body">
          {!storeIsOpen && scheduled.length > 0 && (
            <div className="ag-card" style={{ padding: '10px 12px', marginBottom: 14, background: 'var(--ag-c-stock-soft)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ag-c-stock)' }}>
                ⚠ Local cerrado · los programados de hoy se activan al abrir
              </div>
            </div>
          )}

          {scheduled.length > 0 && (
            <>
              <div className="ag-page-section-title">Para hoy ({scheduled.length})</div>
              {scheduled.map(o => (
                <OrderCard
                  key={o.id}
                  order={toCardProps(o, recipes)}
                />
              ))}
            </>
          )}

          {scheduledFuture.length > 0 && (
            <>
              <div className="ag-page-section-title" style={{ marginTop: scheduled.length > 0 ? 18 : 4 }}>
                Próximos días ({scheduledFuture.length})
              </div>
              <div style={{ opacity: 0.7 }}>
                {scheduledFuture.map(o => (
                  <OrderCard
                    key={o.id}
                    order={toCardProps(o, recipes)}
                  />
                ))}
              </div>
            </>
          )}

          {scheduled.length === 0 && scheduledFuture.length === 0 && (
            <div className="ag-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div style={{ color: 'var(--ag-ink-3)', fontSize: 13 }}>No hay pedidos programados</div>
            </div>
          )}

          {/* Botón Volver al pie de la vista (para no scrollear arriba) */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
            <button type="button" className="ag-cta" onClick={() => setShowSched(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Volver a Pedidos</span>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ─── Historial ─── */}
    {showH && (
      <div className="ag-page-over">
        <div className="ag-page-over-head">
          <button type="button" className="ag-subpage-back" onClick={() => { setShowH(false); setHistPage(1); }} aria-label="Volver">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Atrás</span>
          </button>
          <h2 className="ag-page-over-title">Historial ({hist.length})</h2>
        </div>
        <div className="ag-page-over-body">
          {hist.length === 0 ? (
            <div className="ag-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📜</div>
              <div style={{ color: 'var(--ag-ink-3)', fontSize: 13 }}>Sin historial</div>
            </div>
          ) : (
            <>
              {histGrouped.map(([d, os]) => (
                <div key={d}>
                  <div className="ag-page-section-title">
                    {new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  {os.map(o => (
                    <OrderCard
                      key={o.id}
                      order={toCardProps(o, recipes)}
                    />
                  ))}
                </div>
              ))}
              {histPaged.length < hist.length && (
                <button
                  type="button"
                  className="ag-btn-ghost"
                  style={{ width: '100%', marginTop: 12 }}
                  onClick={() => setHistPage(p => p + 1)}
                >
                  Cargar más ({hist.length - histPaged.length} restantes)
                </button>
              )}
            </>
          )}

          {/* Botón Volver al pie de la vista */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
            <button type="button" className="ag-cta" onClick={() => { setShowH(false); setHistPage(1); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Volver a Pedidos</span>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Overlay: Ver y verificar comprobante */}
    {viewReceipt&&(()=>{
      const o=viewReceipt;
      const url=getReceiptUrl(o.receipt_url);
      const isImg=o.receipt_url&&/\.(jpg|jpeg|png|webp|gif)$/i.test(o.receipt_url);
      return(<div className="po" style={{background:"rgba(0,0,0,0.85)",display:"flex",flexDirection:"column"}}>
        <div className="ph" style={{background:"transparent"}}>
          <button onClick={()=>setViewReceipt(null)}>{Icon.back({size:20,color:"#fff"})}</button>
          <h2 style={{color:"#fff"}}>Comprobante</h2>
        </div>
        <div style={{flex:1,overflow:"auto",padding:16,display:"flex",flexDirection:"column",gap:16}}>
          {/* Info del pedido */}
          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:14,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontWeight:700,color:"#fff",fontSize:15}}>{o.customer}</span>
              <span style={{fontWeight:700,color:"#fff",fontSize:10,background:"rgba(255,255,255,0.2)",padding:"2px 8px",borderRadius:6}}>{formatOrderCode(o.id)}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.7)",textTransform:"capitalize"}}>{o.payment==="mercadopago"?"MercadoPago":o.payment}</span>
              <span style={{fontSize:22,fontWeight:800,color:"#4CAF50",fontFamily:"'DM Serif Display',monospace"}}>$ {formatInt(o.total)}</span>
            </div>
            <div style={{marginTop:8,fontSize:12,color:"rgba(255,255,255,0.5)"}}>Verificá que el monto y la cuenta destino coincidan con el comprobante</div>
          </div>

          {/* Imagen del comprobante */}
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",minHeight:200}}>
            {url ? (
              isImg ? <img src={url} alt="Comprobante" loading="lazy" decoding="async" style={{maxWidth:"100%",maxHeight:"60vh",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}} />
              : <a href={url} target="_blank" rel="noopener noreferrer" style={{padding:"20px 32px",background:"rgba(255,255,255,0.15)",borderRadius:14,color:"#fff",fontSize:15,fontWeight:600,textDecoration:"none"}}>📄 Abrir PDF del comprobante</a>
            ) : <div style={{color:"rgba(255,255,255,0.5)",fontSize:14}}>No se pudo cargar el comprobante</div>}
          </div>

          {/* Botones */}
          <div style={{display:"flex",gap:10,paddingBottom:20}}>
            <button onClick={()=>setViewReceipt(null)} style={{flex:1,padding:"14px",background:"rgba(255,255,255,0.15)",border:"none",borderRadius:12,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cerrar</button>
            {!o.receipt_verified && (
              <button onClick={async()=>{
                const ok=await verifyReceipt(o.id);
                if(ok){
                  if(onUpdateOrder) onUpdateOrder(o.id,{receipt_verified:true});
                  showToast("✓ Comprobante verificado");
                  setViewReceipt(null);
                } else { showToast("Error al verificar"); }
              }} style={{flex:2,padding:"14px",background:"#4CAF50",border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 16px rgba(76,175,80,0.4)"}}>
                ✓ Verificar comprobante
              </button>
            )}
          </div>
        </div>
      </div>);
    })()}
  </>);
}

function OrdForm({ recipes, settings, onClose, onSave }) {
  const [cust, setCust] = useState("");
  const [ph, setPh]     = useState("");
  const [note, setNote] = useState("");
  const [delivDate, setDelivDate] = useState("");
  const [items, setItems] = useState([{ recipe_id: "", qty: 1 }]);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  // ── USAR: canal de venta + comisión ──
  const [channel, setChannel] = useState("mostrador");
  const [channels, setChannels] = useState([]);
  useEffect(() => {
    let mounted = true;
    fetchDeliveryChannels().then(list => { if (mounted) setChannels(list); });
    return () => { mounted = false; };
  }, []);
  const activeChannel = channels.find(c => c.slug === channel);
  const commissionAmt = calcCommission(tot, activeChannel?.commission_pct || 0);
  const netAmt = tot - commissionAmt;
  const add = () => setItems(p => [...p, { recipe_id: "", qty: 1 }]);
  const upd = (i, k, v) => setItems(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const rm  = i => setItems(p => p.filter((_, j) => j !== i));
  const tot = items.reduce((s, it) => { const r = recipes.find(x => x.id === it.recipe_id); return s + (r ? (r.sale_price || 0) * it.qty : 0); }, 0);
  const ok = cust && items.some(it => it.recipe_id && it.qty > 0);
  const todayStr = todayISO();
  const enabledPMs = enabledPaymentMethods(settings);

  return (
    <div className="ag-page-over">
      <div className="ag-page-over-head">
        <button type="button" className="ag-subpage-back" onClick={onClose} aria-label="Cancelar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Atrás</span>
        </button>
        <h2 className="ag-page-over-title">Nuevo pedido</h2>
      </div>

      <div className="ag-page-over-body">
        {/* Cliente */}
        <label className="ag-field-lbl">Cliente *</label>
        <input
          className="ag-field-input"
          value={cust}
          onChange={e => setCust(e.target.value)}
          placeholder="Nombre del cliente"
          style={{ marginBottom: 12 }}
        />

        {/* Teléfono + Nota */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label className="ag-field-lbl">Teléfono</label>
            <input
              className="ag-field-input"
              value={ph}
              onChange={e => setPh(e.target.value)}
              placeholder="549..."
              inputMode="tel"
            />
          </div>
          <div>
            <label className="ag-field-lbl">Nota</label>
            <input
              className="ag-field-input"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Observaciones"
            />
          </div>
        </div>

        {/* Fecha de entrega */}
        <label className="ag-field-lbl">📅 Fecha de entrega</label>
        <input
          className="ag-field-input"
          type="date"
          value={delivDate}
          min={todayStr}
          onChange={e => setDelivDate(e.target.value)}
          style={{ marginBottom: 18 }}
        />

        {/* Productos */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ag-ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Productos ({items.length})
          </div>
          <button type="button" className="ag-btn-ghost" onClick={add} style={{ padding: '6px 12px', fontSize: 12 }}>
            + Producto
          </button>
        </div>

        {items.map((it, i) => {
          const r = recipes.find(x => x.id === it.recipe_id);
          return (
            <div
              key={i}
              className="ag-card"
              style={{ padding: '10px 12px', marginBottom: 8, position: 'relative' }}
            >
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => rm(i)}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 24, height: 24,
                    background: 'none', border: 0,
                    color: 'var(--ag-c-orders)',
                    cursor: 'pointer',
                    fontSize: 16, fontWeight: 700,
                    fontFamily: 'inherit',
                  }}
                  aria-label="Quitar producto"
                >✕</button>
              )}
              <select
                className="ag-field-input"
                value={it.recipe_id}
                onChange={e => upd(i, "recipe_id", e.target.value)}
                style={{ marginBottom: 8 }}
              >
                <option value="">Seleccionar producto...</option>
                {recipes.filter(r2 => r2.visible !== false && !r2.is_archived).map(r2 => (
                  <option key={r2.id} value={r2.id}>{r2.name} — ${formatInt(r2.sale_price)}</option>
                ))}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'center' }}>
                <div>
                  <label className="ag-field-lbl">Cantidad</label>
                  <input
                    className="ag-field-input"
                    type="number" min="1"
                    value={it.qty}
                    onChange={e => upd(i, "qty", Number(e.target.value))}
                  />
                </div>
                {r && (
                  <div>
                    <label className="ag-field-lbl">Subtotal</label>
                    <div style={{ padding: '9px 12px', fontWeight: 700, fontSize: 14, color: 'var(--ag-ink)' }}>
                      ${formatInt((r.sale_price || 0) * it.qty)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Medio de pago */}
        <label className="ag-field-lbl" style={{ marginTop: 4 }}>💳 Medio de pago</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {enabledPMs.map(pm => {
            const on = paymentMethod === pm;
            return (
              <button
                key={pm}
                type="button"
                onClick={() => setPaymentMethod(pm)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: on ? "2px solid var(--ag-c-terra)" : "1px solid var(--ag-line)",
                  background: on ? "rgba(245,158,11,0.08)" : "var(--ag-bg)",
                  color: on ? "var(--ag-c-terra)" : "var(--ag-ink-2)",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 14 }}>{paymentIcon(pm)}</span>
                {paymentLabel(pm)}
              </button>
            );
          })}
        </div>

        {/* USAR: Canal de venta */}
        <label className="ag-field-lbl" style={{ marginTop: 14 }}>Canal de venta</label>
        <select
          className="ag-field-input"
          value={channel}
          onChange={e => setChannel(e.target.value)}
        >
          {channels.map(c => (
            <option key={c.slug} value={c.slug}>
              {c.label}{c.commission_pct > 0 ? ` — comisión ${c.commission_pct}%` : ""}
            </option>
          ))}
        </select>

        {/* Total con desglose USAR */}
        {tot > 0 && (
          <div
            className="ag-card"
            style={{
              textAlign: 'center', marginTop: 12, padding: '14px 12px',
              background: 'var(--ag-c-terra)', color: '#fff',
            }}
          >
            {commissionAmt > 0 ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.9, marginBottom: 4 }}>
                  <span>Bruto</span><span>${formatInt(tot)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.9, marginBottom: 6 }}>
                  <span>− Comisión {activeChannel?.commission_pct}%</span><span>−${formatInt(commissionAmt)}</span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, letterSpacing: '0.08em' }}>NETO EN CAJA</div>
                  <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>
                    ${formatInt(netAmt)}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, letterSpacing: '0.08em' }}>TOTAL</div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>
                  ${formatInt(tot)}
                </div>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          className="ag-btn-primary"
          style={{ marginTop: 18, width: '100%', padding: '14px', fontSize: 15, opacity: ok ? 1 : 0.5 }}
          disabled={!ok}
          onClick={() => {
            if (!ok) return;
            const f = items.filter(it => it.recipe_id && it.qty > 0).map(it => {
              const r = recipes.find(x => x.id === it.recipe_id);
              return {
                recipe_id: it.recipe_id,
                quantity: it.qty,
                unit_price: r?.sale_price || 0,
                subtotal: (r?.sale_price || 0) * it.qty,
              };
            });
            onSave({
              id: generateId(),
              customer: cust, phone: ph, note,
              delivery_date: delivDate || null,
              order_items: f, items: f,
              total: f.reduce((s, it) => s + it.subtotal, 0),
              status: OrderStatus.NEW,
              payment_method: paymentMethod,
              delivery_channel: channel,
              platform_commission_amt: commissionAmt,
              date: todayISO(),
              created_at: new Date().toISOString(),
            });
          }}
        >✓ Crear pedido</button>

        {/* Botón Volver al pie */}
        <button
          type="button"
          className="ag-btn-ghost"
          onClick={onClose}
          style={{ marginTop: 10, width: '100%', padding: '12px', fontSize: 13 }}
        >← Volver</button>
      </div>
    </div>
  );
}

export default Orders;
export { DeliveryBadge };
