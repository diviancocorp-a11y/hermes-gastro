import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import { I, fi, fm, td, uid, ST, playNotif } from "../lib/utils";
import {
  getSession, logout,
  fetchAllRecipes, fetchOrders, updateOrderStatus,
  fetchSettings,
  fetchIngredients, fetchAllRecipeIngredients,
  fetchExpenses,
  fetchSales, createSale,
  updateIngredientStock,
  fetchWasteLog,
  deductComboStock,
  createCouponForOrder,
  notifyWhatsApp
} from "../lib/adminService";

// ═══════ COMPONENTES EXTRAÍDOS ═══════
import LoginScreen from "../components/admin/LoginScreen";
import Home from "../components/admin/Home";
import Stock from "../components/admin/Stock";
import Recipes from "../components/admin/Recipes";
import Orders from "../components/admin/Orders";
import { Expenses, Purchase, SalesView } from "../components/admin/Finance";
import CRM from "../components/admin/CRM";
import Waste from "../components/admin/Waste";
import Settings from "../components/admin/Settings";
import { CancelDlg, StockWarningDlg, NewOrderOverlay } from "../components/admin/Dialogs";

const DEF={biz_name:"La Nona Pato",logo_letter:"N",logo_color:"#C45D3E",
  exp_cats:["Materia Prima","Servicios","Packaging","Transporte","Alquiler","Equipamiento","Otros"],
  ing_cats:["Secos","Frescos","Packaging","Otros"]};

// ═══════ MAIN ═══════
export default function Admin(){
  const [session,setSession]=useState(null);const [checking,setChecking]=useState(true);
  const [tab,setTab]=useState("home");
  const [ings,setIngs]=useState([]);const [recs,setRecs]=useState([]);const [sales,setSales]=useState([]);
  const [exps,setExps]=useState([]);const [orders,setOrders]=useState([]);const [sett,setSett]=useState(DEF);
  const [waste,setWaste]=useState([]);
  const [loaded,setLoaded]=useState(false);const [ov,setOv]=useState(null);const [toast,setToast]=useState("");
  const [newAlertCount,setNewAlertCount]=useState(0);
  const [menuOpen,setMenuOpen]=useState(false);
  const prev=useRef(0);
  const alarmRef=useRef(null);

  // Inicializar audio del pato (MP3, loop 3s) + desbloquear en primer clic
  const alarmTimer=useRef(null);
  useEffect(()=>{
    const audio=new Audio('/quack.mp3');
    audio.loop=true;
    alarmRef.current=audio;
    const unlock=()=>{
      audio.play().then(()=>{ audio.pause(); audio.currentTime=0; }).catch(()=>{});
      document.removeEventListener('click',unlock);
      document.removeEventListener('keydown',unlock);
    };
    document.addEventListener('click',unlock);
    document.addEventListener('keydown',unlock);
    return()=>{
      audio.pause();
      if(alarmTimer.current) clearTimeout(alarmTimer.current);
      document.removeEventListener('click',unlock);
      document.removeEventListener('keydown',unlock);
    };
  },[]);

  useEffect(()=>{getSession().then(s=>{setSession(s);setChecking(false);});},[]);

  // Load all data after login
  const loadAll=useCallback(async()=>{
    const [ig,rc,ri,sl,ex,od,st,wl]=await Promise.all([
      fetchIngredients(),fetchAllRecipes(),fetchAllRecipeIngredients(),
      fetchSales(),fetchExpenses(),fetchOrders(),fetchSettings(),fetchWasteLog()
    ]);
    setIngs(ig||[]);
    // merge recipe ingredients into recipes
    const riMap={};(ri||[]).forEach(r=>{if(!riMap[r.recipe_id])riMap[r.recipe_id]=[];riMap[r.recipe_id].push({...r,quantity:r.qty||r.quantity||0,qty:r.qty||r.quantity||0});});
    setRecs((rc||[]).map(r=>({...r,ingredients:riMap[r.id]||[]})));
    setSales(sl||[]);setExps(ex||[]);setOrders(od||[]);
    setSett(st||DEF);setWaste(wl||[]);setLoaded(true);
  },[]);

  useEffect(()=>{if(session)loadAll();},[session,loadAll]);

  // Suscripción Realtime + Polling de respaldo (por si el WS falla)
  const lastSeenAt=useRef(new Date().toISOString());
  const knownIds=useRef(new Set());

  const handleNewOrders=useCallback((newOrders)=>{
    if(!newOrders||newOrders.length===0)return;
    const genuinelyNew=newOrders.filter(o=>!knownIds.current.has(o.id));
    if(genuinelyNew.length===0)return;
    genuinelyNew.forEach(o=>knownIds.current.add(o.id));
    if(genuinelyNew[0]?.created_at>lastSeenAt.current) lastSeenAt.current=genuinelyNew[0].created_at;
    setOrders(p=>{
      const existIds=new Set(p.map(x=>x.id));
      const toAdd=genuinelyNew.filter(o=>!existIds.has(o.id));
      return toAdd.length>0?[...toAdd,...p]:p;
    });
    setNewAlertCount(c=>c+genuinelyNew.length);
    // Audio loop por 10 segundos (varias repeticiones para que el cocinero escuche)
    if(alarmRef.current){
      if(alarmTimer.current) clearTimeout(alarmTimer.current);
      alarmRef.current.currentTime=0;
      alarmRef.current.play().catch(()=>{});
      alarmTimer.current=setTimeout(()=>{ if(alarmRef.current){ alarmRef.current.pause(); alarmRef.current.currentTime=0; } },10000);
    }
  },[]);

  useEffect(()=>{
    if(!session)return;

    // Registrar IDs de pedidos ya cargados para no contarlos como nuevos
    setOrders(cur=>{ cur.forEach(o=>knownIds.current.add(o.id)); return cur; });

    // 1. Realtime (WebSocket) — llega instantáneo si el WS está activo
    const ch=supabase
      .channel('admin-new-orders-v2')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'orders'},async(payload)=>{
        const {data}=await supabase
          .from('orders').select('*, order_items(*, recipes(name))')
          .eq('id',payload.new.id).single();
        if(data) handleNewOrders([data]);
      })
      .subscribe((status)=>{
        console.log('[Realtime] orders channel status:',status);
      });

    // 2. Polling fallback — cada 20s verifica si hay pedidos más nuevos que el último conocido
    const poll=setInterval(async()=>{
      const {data}=await supabase
        .from('orders')
        .select('*, order_items(*, recipes(name))')
        .gt('created_at',lastSeenAt.current)
        .order('created_at',{ascending:false});
      if(data&&data.length>0) handleNewOrders(data);
    },20000);

    return()=>{ supabase.removeChannel(ch); clearInterval(poll); };
  },[session,handleNewOrders]);

  const msg=useCallback(m=>{setToast(m);setTimeout(()=>setToast(""),2200);},[]);

  // ═══ Promover pedidos programados para hoy → "new" (cuando el local está abierto) ═══
  const promotedRef=useRef(new Set());
  useEffect(()=>{
    if(!loaded||!orders.length)return;
    const today=td();
    const storeOpen=sett.store_open!==false;
    if(!storeOpen)return;
    const toPromote=orders.filter(o=>o.delivery_date&&o.delivery_date<=today&&o.status===ST.new&&!promotedRef.current.has(o.id));
    if(toPromote.length===0)return;
    toPromote.forEach(o=>promotedRef.current.add(o.id));
    (async()=>{
      for(const o of toPromote){
        await supabase.from('orders').update({delivery_date:null}).eq('id',o.id);
      }
      setOrders(p=>p.map(o=>{
        if(toPromote.find(tp=>tp.id===o.id))return{...o,delivery_date:null};
        return o;
      }));
      msg(`📅 ${toPromote.length} pedido${toPromote.length>1?'s':''} programado${toPromote.length>1?'s':''} activado${toPromote.length>1?'s':''}`);
    })();
  },[loaded,orders,sett.store_open,msg]);

  // ═══ Auto-cancelar pedidos olvidados (de días anteriores sin procesar) ═══
  const cleanedRef=useRef(new Set());
  useEffect(()=>{
    if(!loaded||!orders.length)return;
    const today=td();
    // Pedidos de días anteriores que siguen en new/prep/active (sin delivery_date futuro)
    const stale=orders.filter(o=>
      [ST.new,ST.prep,ST.active].includes(o.status)&&
      o.date<today&&
      (!o.delivery_date||o.delivery_date<today)&&
      !cleanedRef.current.has(o.id)
    );
    if(stale.length===0)return;
    stale.forEach(o=>cleanedRef.current.add(o.id));
    (async()=>{
      for(const o of stale){
        await supabase.from('orders').update({status:ST.cancel}).eq('id',o.id);
      }
      setOrders(p=>p.map(o=>{
        if(stale.find(s=>s.id===o.id))return{...o,status:ST.cancel};
        return o;
      }));
      msg(`🧹 ${stale.length} pedido${stale.length>1?'s':''} vencido${stale.length>1?'s':''} cancelado${stale.length>1?'s':''} automáticamente`);
    })();
  },[loaded,orders,msg]);

  // Recipe cost calculator
  const rc=useCallback(rec=>{
    if(!rec?.ingredients)return 0;
    return rec.ingredients.reduce((s,ri)=>{
      const ig=ings.find(i=>i.id===ri.ingredient_id);
      return s+(ig?(ig.cost||0)*(ri.quantity||0):0);
    },0);
  },[ings]);

  // Computed values
  const low=useMemo(()=>ings.filter(i=>(i.stock||0)<=(i.min_stock||0)),[ings]);
  const actOrd=useMemo(()=>orders.filter(o=>[ST.new,ST.prep,ST.active].includes(o.status)),[orders]);
  const mo=td().slice(0,7)+"-01";
  const tS=useMemo(()=>sales.filter(s=>s.date>=mo).reduce((a,x)=>a+(x.total||0),0),[sales,mo]);
  const tE=useMemo(()=>exps.filter(e=>e.date>=mo).reduce((a,e)=>a+(e.amount||0),0),[exps,mo]);
  const prof=tS-tE;
  // Costo histórico: usa unit_cost guardado en el momento de la venta (snapshot financiero)
  // Si el campo no existe (ventas viejas), cae al costo actual como respaldo
  const tCR=useMemo(()=>sales.filter(s=>s.date>=mo).reduce((a,x)=>{
    if(x.unit_cost!=null&&x.unit_cost>0) return a+(x.unit_cost*(x.qty||1));
    const r=recs.find(r2=>r2.id===x.recipe_id);return a+(r?rc(r)*(x.qty||1):0);
  },0),[sales,recs,rc,mo]);
  // Costo de merma del mes: qty * costo del ingrediente
  const tW=useMemo(()=>waste.filter(w=>w.date>=mo).reduce((a,w)=>{
    const ig=ings.find(i=>i.id===w.ingredient_id);return a+((ig?.cost||0)*(w.qty||0));
  },0),[waste,ings,mo]);
  const mar=tS>0?((tS-tE-tW)/tS*100):0;

  // Move order status
  const moveOrd=async(id,ns,force=false)=>{
    const o=orders.find(x=>x.id===id);if(!o)return;
    if(ns===ST.cancel){
      if([ST.prep,ST.active].includes(o.status)){setOv({type:"cancel",orderId:id,order:o});return;}
      await updateOrderStatus(id,ST.cancel);
      setOrders(p=>p.map(x=>x.id===id?{...x,status:ST.cancel}:x));msg("Cancelado");
      if(o.phone) notifyWhatsApp(o.phone,o.customer||"",ST.cancel,o.id).then(ok=>{if(ok)msg(p=>p+" · 📱 WhatsApp enviado");}).catch(()=>{});
      return;
    }
    if(ns===ST.prep&&o.status===ST.new){
      const items=o.order_items||o.items||[];
      // Verificar si algún ingrediente quedaría en negativo (salvo que se haya forzado)
      if(!force){
        const deficits=[];
        for(const it of items){
          const r=recs.find(x=>x.id===it.recipe_id);if(!r||r.is_combo)continue;
          const qty=it.quantity||it.qty||1;
          for(const ri of (r.ingredients||[])){
            const ing=ings.find(x=>x.id===ri.ingredient_id);if(!ing)continue;
            const after=(ing.stock||0)-(ri.quantity*qty);
            if(after<0)deficits.push({name:ing.name,current:fi(ing.stock||0),needed:fi(ri.quantity*qty),unit:ing.unit,after:fi(after)});
          }
        }
        if(deficits.length>0){setOv({type:"stockWarning",orderId:id,order:o,deficits});return;}
      }
      // Construir mapas para deducción recursiva
      const ingMap={};ings.forEach(i=>{ingMap[i.id]=i;});
      const riMap={};
      // fetchAllRecipeIngredients ya está en memory (recipeIngs no disponible aquí — usamos recs)
      recs.forEach(r=>{riMap[r.id]=(r.ingredients||[]);});
      for(const it of items){
        const r=recs.find(x=>x.id===it.recipe_id);if(!r)continue;
        const qty=it.quantity||it.qty||1;
        if(r.is_combo){
          // Deducción recursiva para combos
          await deductComboStock(r.id,qty,ingMap,riMap);
        } else {
          for(const ri of (r.ingredients||[])){
            await updateIngredientStock(ri.ingredient_id,-(ri.quantity*qty));
          }
        }
      }
      setIngs(prev2=>{const n=[...prev2];items.forEach(it=>{const r=recs.find(x=>x.id===it.recipe_id);if(!r||r.is_combo)return;(r.ingredients||[]).forEach(ri=>{const idx=n.findIndex(x=>x.id===ri.ingredient_id);if(idx>=0)n[idx]={...n[idx],stock:Math.max(0,(n[idx].stock||0)-ri.quantity*(it.quantity||it.qty||1))};});});return n;});
      msg("En preparación · Stock actualizado");
    }
    if(ns===ST.done){
      const items=o.order_items||o.items||[];
      for(const it of items){
        await createSale({date:td(),recipe_id:it.recipe_id,qty:it.quantity||it.qty||1,unit_price:it.unit_price||0,unit_cost:it.unit_cost||0,total:(it.quantity||it.qty||1)*(it.unit_price||0)});
      }
      setSales(prev2=>{const nw=[...prev2];items.forEach(it=>{nw.push({id:uid(),date:td(),recipe_id:it.recipe_id,qty:it.quantity||it.qty||1,unit_price:it.unit_price||0,total:(it.quantity||it.qty||1)*(it.unit_price||0)});});return nw;});
      // Generar cupón para el cliente
      if(o.email){
        const coupon=await createCouponForOrder(o.id,o.email,10);
        if(coupon)msg(`✅ Completado · Cupón ${coupon.code} enviado a ${o.email}`);
        else msg("Completado · Venta registrada");
      } else {
        msg("Completado · Venta registrada");
      }
    }
    if(ns===ST.active)msg("Activo · Listo para entrega");
    await updateOrderStatus(id,ns);
    setOrders(p=>p.map(x=>x.id===id?{...x,status:ns,...(ns===ST.done?{completedAt:new Date().toISOString()}:{})}:x));
    // Notificación WhatsApp al cliente (si tiene teléfono)
    if(o.phone&&[ST.prep,ST.active,ST.done,ST.cancel].includes(ns)){
      notifyWhatsApp(o.phone,o.customer||"",ns,o.id)
        .then(ok=>{ if(ok)msg(prev=>prev+(prev?" · ":"")+"📱 WhatsApp enviado"); })
        .catch(()=>{});
    }
  };

  const confirmCancel=async(id,ret)=>{
    const o=orders.find(x=>x.id===id);if(!o)return;
    if(ret){
      const items=o.order_items||o.items||[];
      for(const it of items){
        const r=recs.find(x=>x.id===it.recipe_id);if(!r)continue;
        for(const ri of(r.ingredients||[])){
          await updateIngredientStock(ri.ingredient_id,ri.quantity*(it.quantity||it.qty||1));
        }
      }
      setIngs(prev2=>{const n=[...prev2];(o.order_items||o.items||[]).forEach(it=>{const r=recs.find(x=>x.id===it.recipe_id);if(!r)return;(r.ingredients||[]).forEach(ri=>{const idx=n.findIndex(x=>x.id===ri.ingredient_id);if(idx>=0)n[idx]={...n[idx],stock:(n[idx].stock||0)+ri.quantity*(it.quantity||it.qty||1)};});});return n;});
      msg("Cancelado · Stock devuelto");
    }else{msg("Cancelado · Desperdicio registrado");}
    await updateOrderStatus(id,ST.cancel);
    setOrders(p=>p.map(x=>x.id===id?{...x,status:ST.cancel}:x));setOv(null);
    if(o.phone) notifyWhatsApp(o.phone,o.customer||"",ST.cancel,o.id).catch(()=>{});
  };

  const addOrd=async(o)=>{
    // This is called from OrdForm - order already saved in the form
    setOrders(p=>[o,...p]);playNotif();msg("Pedido creado");
  };

  // Acuse de recibo: apaga alarma, cierra overlay, navega a pedidos
  const ackOrders=useCallback(()=>{
    if(alarmRef.current){ alarmRef.current.pause(); alarmRef.current.currentTime=0; }
    if(alarmTimer.current){ clearTimeout(alarmTimer.current); alarmTimer.current=null; }
    setNewAlertCount(0);
    setTab('orders');
  },[]);

  if(checking)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",color:"var(--t3)"}}>Cargando...</div>;
  if(!session)return <LoginScreen onLogin={async()=>{const s=await getSession();setSession(s);}}/>;

  return(<div className="app">
    {toast&&<div className="toast">{toast}</div>}
    <div className="hd">
      <div className="hd-l" style={{background:sett.logo_color||DEF.logo_color}}>{sett.logo_letter||DEF.logo_letter}</div>
      <div><div className="hd-t">{sett.biz_name||DEF.biz_name}</div><div className="hd-s">Gestión Operativa</div></div>
      <div className="hd-r">
        <button className="hb" onClick={()=>setTab("settings")}>{I.settings({size:18})}</button>
        <button className="hb" onClick={async()=>{await logout();setSession(null);}} title="Cerrar sesión"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
      </div>
    </div>

    {tab==="home"&&<Home {...{low,tS,tE,tW,prof,mar,tCR,sales,recs,ings,rc,actOrd,sett,waste}} onStock={()=>setTab("stock")} onPurchase={()=>setOv({type:"purchase"})} onOrders={()=>setTab("orders")} onExp={()=>setOv({type:"expenses"})}/>}
    {tab==="stock"&&<Stock {...{ings,setIngs,recs,ov,setOv,msg,sett,loadAll}}/>}
    {tab==="recipes"&&<Recipes {...{recs,setRecs,ings,rc,ov,setOv,msg,loadAll}}/>}
    {tab==="orders"&&<Orders {...{orders,recs,moveOrd,addOrd,ov,setOv,msg,sett}} onUpdateOrder={(id,changes)=>setOrders(p=>p.map(o=>o.id===id?{...o,...changes}:o))}/>}
    {tab==="sales"&&<SalesView {...{sales,setSales,orders,recs,rc,ov,setOv,msg}}/>}
    {tab==="crm"&&<CRM {...{orders,recs,ings,msg}}/>}
    {tab==="waste"&&<Waste {...{waste,orders,recs,ings}}/>}
    {tab==="settings"&&<Settings sett={sett} setSett={setSett} msg={msg} onBack={()=>setTab("home")}/>}

    {ov?.type==="purchase"&&<Purchase {...{ings,setIngs,exps,setExps,sett}} onClose={()=>setOv(null)} msg={msg} loadAll={loadAll}/>}
    {ov?.type==="expenses"&&<Expenses {...{exps,setExps,sett,msg}} onClose={()=>setOv(null)}/>}
    {ov?.type==="cancel"&&<CancelDlg order={ov.order} recs={recs} ings={ings} onClose={()=>setOv(null)} onConfirm={ret=>confirmCancel(ov.orderId,ret)}/>}
    {ov?.type==="stockWarning"&&<StockWarningDlg deficits={ov.deficits} onClose={()=>setOv(null)} onForce={async()=>{setOv(null);await moveOrd(ov.orderId,ST.prep,true);}}/>}

    {/* Overlay bloqueante de nuevos pedidos — z-index 9999, por encima de todo */}
    {newAlertCount>0&&<NewOrderOverlay count={newAlertCount} onAck={ackOrders}/>}

    {/* Hamburger menu overlay */}
    {menuOpen&&<>
      <div onClick={()=>setMenuOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:900}}/>
      <div style={{position:"fixed",bottom:64,right:12,background:"#fff",borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",zIndex:901,padding:"6px 0",minWidth:180,animation:"fadeIn .15s ease"}}>
        {[{id:"stock",icon:I.box,l:"Stock"},{id:"recipes",icon:I.recipe,l:"Recetas"},{id:"sales",icon:I.cart,l:"Ventas"},{id:"waste",icon:I.alert,l:"Mermas"},{id:"crm",icon:I.user,l:"CRM"}].map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"12px 18px",border:"none",background:tab===t.id?"var(--b1,#f5f0eb)":"transparent",color:tab===t.id?"var(--pr,#C45D3E)":"var(--tx,#333)",fontSize:14,fontWeight:tab===t.id?700:500,cursor:"pointer",textAlign:"left"}}>
            {t.icon({size:18})}{t.l}
          </button>
        ))}
      </div>
    </>}

    <nav className="nv">
      {[{id:"home",icon:I.home,l:"Inicio"},{id:"orders",icon:I.orders,l:"Pedidos",badge:orders.filter(o=>o.status===ST.new).length},{id:"purchase",icon:I.truck,l:"Compras",action:()=>setOv({type:"purchase"})},{id:"expenses",icon:I.dollar,l:"Gastos",action:()=>setOv({type:"expenses"})}].map(t=>(
        <button key={t.id} className={`ni ${tab===t.id||(tab==="settings"&&t.id==="home")?"on":""}`} onClick={()=>{if(t.action){t.action();}else{setTab(t.id);}}}>
          {t.badge>0&&<span className="nb">{t.badge}</span>}
          {t.icon({size:20})}{t.l}
        </button>
      ))}
      <button className={`ni ${["stock","recipes","sales","waste","crm"].includes(tab)?"on":""}`} onClick={()=>setMenuOpen(p=>!p)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        Más
      </button>
    </nav>
  </div>);
}
