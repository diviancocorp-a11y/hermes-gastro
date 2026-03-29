import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { I, fi, fm, td, uid, ST, ST_L, ST_C, ST_B, CAT_E, CAT_CO, COLORS, playNotif } from "../lib/utils";
import {
  login, logout, getSession,
  fetchAllRecipes, upsertRecipe, deleteRecipe,
  fetchOrders, updateOrderStatus,
  fetchSettings, updateSettings,
  fetchIngredients, upsertIngredient, deleteIngredient,
  fetchRecipeIngredients, fetchAllRecipeIngredients, saveRecipeIngredients,
  fetchExpenses, createExpense, deleteExpense,
  fetchSales, createSale,
  fetchDashboardStats, updateIngredientStock,
  uploadRecipeImage,
  fetchWasteLog, registerWaste,
  fetchComboItems, saveComboItems, deductComboStock,
  createCouponForOrder, fetchCoupons
} from "../lib/adminService";

const DEF={biz_name:"La Nona Pato",logo_letter:"N",logo_color:"#C45D3E",
  exp_cats:["Materia Prima","Servicios","Packaging","Transporte","Alquiler","Equipamiento","Otros"],
  ing_cats:["Secos","Frescos","Packaging","Otros"]};

// ═══════ MAIN ═══════
export default function Admin(){
  const [session,setSession]=useState(null);const [checking,setChecking]=useState(true);
  const [tab,setTab]=useState("home");
  const [ings,setIngs]=useState([]);const [recs,setRecs]=useState([]);const [sales,setSales]=useState([]);
  const [exps,setExps]=useState([]);const [orders,setOrders]=useState([]);const [sett,setSett]=useState(DEF);
  const [loaded,setLoaded]=useState(false);const [ov,setOv]=useState(null);const [toast,setToast]=useState("");
  const prev=useRef(0);

  useEffect(()=>{getSession().then(s=>{setSession(s);setChecking(false);});},[]);

  // Load all data after login
  const loadAll=useCallback(async()=>{
    const [ig,rc,ri,sl,ex,od,st]=await Promise.all([
      fetchIngredients(),fetchAllRecipes(),fetchAllRecipeIngredients(),
      fetchSales(),fetchExpenses(),fetchOrders(),fetchSettings()
    ]);
    setIngs(ig||[]);
    // merge recipe ingredients into recipes
    const riMap={};(ri||[]).forEach(r=>{if(!riMap[r.recipe_id])riMap[r.recipe_id]=[];riMap[r.recipe_id].push(r);});
    setRecs((rc||[]).map(r=>({...r,ingredients:riMap[r.id]||[]})));
    setSales(sl||[]);setExps(ex||[]);setOrders(od||[]);
    setSett(st||DEF);setLoaded(true);
  },[]);

  useEffect(()=>{if(session)loadAll();},[session,loadAll]);

  // New order notification
  useEffect(()=>{const n=orders.filter(o=>o.status===ST.new).length;if(loaded&&n>prev.current)playNotif();prev.current=n;},[orders,loaded]);

  const msg=useCallback(m=>{setToast(m);setTimeout(()=>setToast(""),2200);},[]);

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
  const tCR=useMemo(()=>sales.filter(s=>s.date>=mo).reduce((a,x)=>{
    const r=recs.find(r2=>r2.id===x.recipe_id);return a+(r?rc(r)*(x.qty||1):0);
  },0),[sales,recs,rc,mo]);
  const mar=tS>0?(prof/tS*100):0;

  // Move order status
  const moveOrd=async(id,ns)=>{
    const o=orders.find(x=>x.id===id);if(!o)return;
    if(ns===ST.cancel){
      if([ST.prep,ST.active].includes(o.status)){setOv({type:"cancel",orderId:id,order:o});return;}
      await updateOrderStatus(id,ST.cancel);
      setOrders(p=>p.map(x=>x.id===id?{...x,status:ST.cancel}:x));msg("Cancelado");return;
    }
    if(ns===ST.prep&&o.status===ST.new){
      const items=o.order_items||o.items||[];
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
        await createSale({date:td(),recipe_id:it.recipe_id,qty:it.quantity||it.qty||1,unit_price:it.unit_price||0,total:(it.quantity||it.qty||1)*(it.unit_price||0)});
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
  };

  const addOrd=async(o)=>{
    // This is called from OrdForm - order already saved in the form
    setOrders(p=>[o,...p]);playNotif();msg("Pedido creado");
  };

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

    {tab==="home"&&<Home {...{low,tS,tE,prof,mar,tCR,sales,recs,ings,rc,actOrd,sett}} onStock={()=>setTab("stock")} onPurchase={()=>setOv({type:"purchase"})} onOrders={()=>setTab("orders")} onExp={()=>setOv({type:"expenses"})}/>}
    {tab==="stock"&&<Stock {...{ings,setIngs,ov,setOv,msg,sett,loadAll}}/>}
    {tab==="recipes"&&<Recipes {...{recs,setRecs,ings,rc,ov,setOv,msg,loadAll}}/>}
    {tab==="orders"&&<Orders {...{orders,recs,moveOrd,addOrd,ov,setOv,msg}}/>}
    {tab==="sales"&&<SalesView {...{sales,setSales,recs,rc,ov,setOv,msg}}/>}
    {tab==="settings"&&<Settings sett={sett} setSett={setSett} msg={msg} onBack={()=>setTab("home")}/>}

    {ov?.type==="purchase"&&<Purchase {...{ings,setIngs,exps,setExps,sett}} onClose={()=>setOv(null)} msg={msg} loadAll={loadAll}/>}
    {ov?.type==="expenses"&&<Expenses {...{exps,setExps,sett,msg}} onClose={()=>setOv(null)}/>}
    {ov?.type==="cancel"&&<CancelDlg order={ov.order} recs={recs} ings={ings} onClose={()=>setOv(null)} onConfirm={ret=>confirmCancel(ov.orderId,ret)}/>}

    <nav className="nv">
      {[{id:"home",icon:I.home,l:"Inicio"},{id:"stock",icon:I.box,l:"Stock"},{id:"recipes",icon:I.recipe,l:"Recetas"},{id:"orders",icon:I.orders,l:"Pedidos",badge:orders.filter(o=>o.status===ST.new).length},{id:"sales",icon:I.cart,l:"Ventas"}].map(t=>(
        <button key={t.id} className={`ni ${tab===t.id||(tab==="settings"&&t.id==="home")?"on":""}`} onClick={()=>setTab(t.id)}>
          {t.badge>0&&<span className="nb">{t.badge}</span>}
          {t.icon({size:20})}{t.l}
        </button>
      ))}
    </nav>
  </div>);
}

// ═══════ LOGIN ═══════
function LoginScreen({onLogin}){
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");
  const [err,setErr]=useState("");const [loading,setLoading]=useState(false);
  const handle=async(e)=>{
    e.preventDefault();setLoading(true);setErr("");
    const res=await login(email,pass);
    setLoading(false);
    if(res.ok){onLogin();}else{setErr(res.msg);}
  };
  return(
    <div className="login-page"><form className="login-form" onSubmit={handle}>
      <div className="login-logo">N</div>
      <h2 className="login-title">Panel de Gestión</h2>
      <p className="login-sub">La Nona Pato</p>
      {err&&<div className="login-err">{err}</div>}
      <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="login-input" required/>
      <input type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} className="login-input" required/>
      <button type="submit" className="login-btn" disabled={loading}>{loading?"Entrando...":"Entrar"}</button>
    </form></div>
  );
}

// ═══════ HOME ═══════
function Home({low,tS,tE,prof,mar,tCR,sales,recs,ings,rc,actOrd,sett,onStock,onPurchase,onOrders,onExp}){
  const nw=actOrd.filter(o=>o.status===ST.new);
  const mo=td().slice(0,7)+"-01";
  const top=useMemo(()=>{
    const m={};sales.filter(s=>s.date>=mo).forEach(s=>{m[s.recipe_id]=(m[s.recipe_id]||0)+(s.qty||1);});
    return Object.entries(m).map(([id,q])=>({r:recs.find(x=>x.id===id),q})).filter(x=>x.r).sort((a,b)=>b.q-a.q).slice(0,3);
  },[sales,recs,mo]);

  return(<>
    {nw.length>0&&<div className="ab" style={{background:(sett.logo_color||"#C45D3E")+"18",color:sett.logo_color||"#C45D3E",margin:"0 16px 12px"}} onClick={onOrders}>
      {I.orders({size:18})}<span style={{flex:1}}>{nw.length} pedido{nw.length>1?"s":""} nuevo{nw.length>1?"s":""}</span><span style={{fontWeight:700}}>Ver →</span>
    </div>}
    {low.length>0&&<div className="ab abw" onClick={onStock}>{I.alert({size:18})}<span>{low.length} insumo{low.length>1?"s":""} con stock bajo</span></div>}

    <div style={{display:"flex",gap:10,padding:"0 16px 16px"}}>
      <button onClick={onPurchase} style={{flex:1,padding:"12px 14px",borderRadius:"var(--r)",border:"none",background:"var(--b3)",boxShadow:"var(--sh)",display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontFamily:"'DM Sans'",fontSize:14,fontWeight:700,color:"var(--tx)"}}>
        <div style={{width:36,height:36,borderRadius:10,background:"var(--bll)",display:"flex",alignItems:"center",justifyContent:"center"}}>{I.truck({size:18,color:"var(--bl)"})}</div>Compra
      </button>
      <button onClick={onExp} style={{flex:1,padding:"12px 14px",borderRadius:"var(--r)",border:"none",background:"var(--b3)",boxShadow:"var(--sh)",display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontFamily:"'DM Sans'",fontSize:14,fontWeight:700,color:"var(--tx)"}}>
        <div style={{width:36,height:36,borderRadius:10,background:"var(--rl)",display:"flex",alignItems:"center",justifyContent:"center"}}>{I.dollar({size:18,color:"var(--rd)"})}</div>Gastos
      </button>
    </div>

    <div className="sg">
      <div className="sc f1"><div className="sl">Ventas</div><div className="sv2">${fi(tS)}</div></div>
      <div className="sc f2"><div className="sl">Ganancia</div><div className={`sv2 ${prof>=0?"svg2":"svr"}`}>${fi(prof)}</div><div className="sd">Margen: {mar.toFixed(1)}%</div></div>
      <div className="sc f3"><div className="sl">Costo Insumos</div><div className="sv2">${fi(tCR)}</div><div className="sd">Ref. producción</div></div>
      <div className="sc f4"><div className="sl">Gastos</div><div className="sv2 svr">${fi(tE)}</div></div>
    </div>

    {top.length>0&&<div className="s"><div className="st">Más vendidos</div>
      <div className="c" style={{padding:0,overflow:"hidden"}}>{top.map((t,i)=>{
        const c=rc(t.r);const rt=t.r.sale_price>0?((t.r.sale_price-c)/t.r.sale_price*100):0;
        return(<div key={t.r.id} className="li">
          <div className="lic" style={{background:["var(--al)","var(--yl)","var(--gl)"][i],color:["var(--ac)","var(--yw)","var(--gn)"][i]}}>#{i+1}</div>
          <div className="lii"><div className="lin">{t.r.name}</div><div className="lid">{t.q} uni · Rent. {rt.toFixed(0)}%</div></div>
          <div className="lir"><div className="lia">${fi(t.q*t.r.sale_price)}</div></div>
        </div>);
      })}</div>
    </div>}
  </>);
}

// ═══════ STOCK ═══════
function Stock({ings,setIngs,ov,setOv,msg,sett,loadAll}){
  const [sr,setSr]=useState("");const [fil,setFil]=useState("all");
  const cats=[...new Set(ings.map(i=>i.category).filter(Boolean))];
  const filt=ings.filter(i=>{
    const ms=i.name?.toLowerCase().includes(sr.toLowerCase());
    const mf=fil==="all"||fil==="low"?true:i.category===fil;
    const ml=fil==="low"?(i.stock||0)<=(i.min_stock||0):true;
    return ms&&mf&&ml;
  });
  const tI=ings.reduce((s,i)=>s+(i.cost||0)*(i.stock||0),0);

  return(<>
    <div className="s"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div className="st" style={{margin:0}}>Inventario</div>
      <div style={{fontSize:12,color:"var(--t3)"}}>Inv: <strong>${fi(tI)}</strong></div>
    </div></div>
    <div className="sb">{I.search({size:16})}<input className="fin" placeholder="Buscar..." value={sr} onChange={e=>setSr(e.target.value)}/></div>
    <div className="tabs">
      <button className={`tab ${fil==="all"?"on":""}`} onClick={()=>setFil("all")}>Todos</button>
      <button className={`tab ${fil==="low"?"on":""}`} onClick={()=>setFil("low")}>Bajo</button>
      {cats.slice(0,2).map(c=><button key={c} className={`tab ${fil===c?"on":""}`} onClick={()=>setFil(c)}>{c}</button>)}
    </div>
    <div className="s"><div className="c" style={{padding:0,overflow:"hidden"}}>
      {filt.length===0?<div className="empty"><div className="eic">📦</div><div>Vacío</div></div>
      :filt.map(it=>(<div key={it.id} className="li" onClick={()=>setOv({type:"editIng",data:it})}>
        <div className="lic" style={{background:(it.stock||0)<=(it.min_stock||0)?((it.stock||0)<=0?"var(--rl)":"var(--yl)"):"var(--gl)",color:(it.stock||0)<=(it.min_stock||0)?((it.stock||0)<=0?"var(--rd)":"var(--yw)"):"var(--gn)"}}>
          {(it.stock||0)<=(it.min_stock||0)?I.alert({size:16}):I.check({size:16})}
        </div>
        <div className="lii"><div className="lin">{it.name}</div><div className="lid">{it.category||""} · ${fm(it.cost||0)}/{it.unit}</div></div>
        <div className="lir"><div className="lia">{it.stock||0} {it.unit}</div><div className="lid">min: {it.min_stock||0}</div></div>
      </div>))}
    </div></div>
    <div style={{display:"flex",gap:8,padding:"0 16px 16px"}}>
      <button className="btn bs" style={{flex:1,fontSize:13}} onClick={()=>setOv({type:"waste"})}>⚠️ Registrar Merma</button>
    </div>
    <button className="fab" onClick={()=>setOv({type:"editIng",data:null})}>{I.plus({size:24,color:"#fff"})}</button>
    {ov?.type==="editIng"&&<IngForm data={ov.data} sett={sett} onClose={()=>setOv(null)} onSave={async(it)=>{
      const saved=await upsertIngredient(it);
      if(saved){if(it.id)setIngs(p=>p.map(i=>i.id===it.id?saved:i));else setIngs(p=>[...p,saved]);setOv(null);msg(it.id?"Actualizado":"Agregado");}
    }} onDel={async(id)=>{await deleteIngredient(id);setIngs(p=>p.filter(i=>i.id!==id));setOv(null);msg("Eliminado");}}/>}
    {ov?.type==="waste"&&<WasteForm ings={ings} setIngs={setIngs} msg={msg} onClose={()=>setOv(null)}/>}
  </>);
}

function WasteForm({ings,setIngs,msg,onClose}){
  const [ingId,setIngId]=useState("");const [qty,setQty]=useState("");const [reason,setReason]=useState("vencimiento");const [note,setNote]=useState("");const [saving,setSaving]=useState(false);
  const reasons=["vencimiento","rotura","prueba","derrame","otro"];
  const save=async()=>{
    if(!ingId||!qty||Number(qty)<=0)return;
    setSaving(true);
    const ok=await registerWaste(ingId,Number(qty),reason,note);
    setSaving(false);
    if(ok){
      setIngs(p=>p.map(i=>i.id===ingId?{...i,stock:Math.max(0,(i.stock||0)-Number(qty))}:i));
      msg(`Merma registrada: ${Number(qty)} ${ings.find(x=>x.id===ingId)?.unit||""}`);
      onClose();
    }
  };
  const ing=ings.find(x=>x.id===ingId);
  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>Registrar Merma</h2></div><div className="pb">
    <div className="waste-banner">⚠️ Este ajuste descuenta stock sin generar una venta. Usá esto para vencimientos, roturas y pruebas.</div>
    <div className="fg"><label className="fl">Insumo</label>
      <select className="fin" value={ingId} onChange={e=>setIngId(e.target.value)}>
        <option value="">Seleccionar insumo...</option>
        {ings.map(i=><option key={i.id} value={i.id}>{i.name} (Stock: {i.stock||0} {i.unit})</option>)}
      </select>
    </div>
    <div className="fr">
      <div className="fg"><label className="fl">Cantidad a descontar ({ing?.unit||"unidad"})</label>
        <input className="fin" type="number" min="0.001" step="0.001" value={qty} onChange={e=>setQty(e.target.value)} placeholder="Ej: 0.5"/>
      </div>
    </div>
    {ingId&&qty&&<div className="waste-preview">
      Stock actual: <strong>{ing?.stock||0} {ing?.unit}</strong> → Nuevo: <strong style={{color:"var(--rd)"}}>{Math.max(0,(ing?.stock||0)-Number(qty))} {ing?.unit}</strong>
    </div>}
    <div className="fg"><label className="fl">Motivo</label>
      <div className="cko" style={{flexWrap:"wrap",gap:6}}>
        {reasons.map(r=><div key={r} className={`ckv ${reason===r?"on":""}`} onClick={()=>setReason(r)} style={{textTransform:"capitalize",flex:"none"}}>{r}</div>)}
      </div>
    </div>
    <div className="fg"><label className="fl">Nota (opcional)</label>
      <input className="fin" value={note} onChange={e=>setNote(e.target.value)} placeholder="Ej: Caja dañada al descargar"/>
    </div>
    <button className="btn bp" style={{width:"100%",marginTop:8}} onClick={save} disabled={saving||!ingId||!qty}>
      {saving?"Guardando...":"⚠️ Confirmar Merma"}
    </button>
  </div></div>);
}

function IngForm({data,onClose,onSave,onDel,sett}){
  const [f,setF]=useState(data||{name:"",unit:"kg",cost:0,stock:0,min_stock:0,category:"Secos"});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>{data?"Editar":"Nuevo"} Insumo</h2>
    {data&&<button onClick={()=>onDel(data.id)} style={{color:"var(--rd)"}}>{I.trash({})}</button>}
  </div><div className="pb">
    <div className="fg"><label className="fl">Nombre</label><input className="fin" value={f.name} onChange={e=>s("name",e.target.value)}/></div>
    <div className="fr"><div className="fg"><label className="fl">Unidad</label><select className="fin" value={f.unit} onChange={e=>s("unit",e.target.value)}>{["kg","g","lt","ml","uni"].map(u=><option key={u}>{u}</option>)}</select></div>
    <div className="fg"><label className="fl">Cat.</label><select className="fin" value={f.category||""} onChange={e=>s("category",e.target.value)}>{(sett?.ing_cats||DEF.ing_cats).map(c=><option key={c}>{c}</option>)}</select></div></div>
    <div className="fg"><label className="fl">Costo/{f.unit}</label><input className="fin" type="number" value={f.cost||""} onChange={e=>s("cost",Number(e.target.value))}/></div>
    <div className="fr"><div className="fg"><label className="fl">Stock</label><input className="fin" type="number" value={f.stock||""} onChange={e=>s("stock",Number(e.target.value))}/></div>
    <div className="fg"><label className="fl">Mín</label><input className="fin" type="number" value={f.min_stock||""} onChange={e=>s("min_stock",Number(e.target.value))}/></div></div>
    <button className="btn bp" style={{marginTop:8}} onClick={()=>f.name&&onSave(f)}>{I.check({size:18,color:"#fff"})} {data?"Guardar":"Agregar"}</button>
  </div></div>);
}

// ═══════ RECIPES ═══════
function Recipes({recs,setRecs,ings,rc,ov,setOv,msg,loadAll}){
  const [sr,setSr]=useState("");
  const filt=recs.filter(r=>r.name?.toLowerCase().includes(sr.toLowerCase()));

  return(<>
    <div className="s"><div className="st">Recetas</div></div>
    <div className="sb">{I.search({size:16})}<input className="fin" placeholder="Buscar..." value={sr} onChange={e=>setSr(e.target.value)}/></div>
    <div className="s">
      {filt.length===0?<div className="c"><div className="empty"><div className="eic">📋</div><div>Sin recetas</div></div></div>
      :filt.map(r=>{
        const c=rc(r);const m=r.sale_price>0?((r.sale_price-c)/r.sale_price*100):0;
        const bc=m>=50?"var(--gn)":m>=30?"var(--yw)":"var(--rd)";
        return(<div key={r.id} className="c" onClick={()=>setOv({type:"viewR",data:r})}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <div><div style={{fontWeight:700,fontSize:15}}>{r.name}</div><div style={{fontSize:12,color:"var(--t3)"}}>{r.category} · {(r.ingredients||[]).length} ins.</div></div>
            <div style={{textAlign:"right",display:"flex",alignItems:"center",gap:8}}>
              <div><div style={{fontWeight:700,fontSize:15}}>${fi(r.sale_price)}</div><div style={{fontSize:12,color:"var(--t3)"}}>C: ${fm(c)}</div></div>
              {r.visible!==false?<span style={{color:"var(--gn)"}}>{I.eye({size:14})}</span>:<span style={{color:"var(--t3)"}}>{I.eyeOff({size:14})}</span>}
            </div>
          </div>
          <div className="pbar"><div className="pfill" style={{width:`${Math.min(m,100)}%`,background:bc}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <span style={{fontSize:11,color:bc,fontWeight:700}}>Rent: {m.toFixed(1)}%</span>
            <span style={{fontSize:11,color:"var(--gn)",fontWeight:700}}>G: ${fm(r.sale_price-c)}</span>
          </div>
        </div>);
      })}
    </div>
    <button className="fab" onClick={()=>setOv({type:"editR",data:null})}>{I.plus({size:24,color:"#fff"})}</button>
    {ov?.type==="viewR"&&<RecDet r={ov.data} ings={ings} rc={rc} onClose={()=>setOv(null)} onEdit={async()=>{
      let d={...ov.data};
      if(d.is_combo&&d.id){const ci=await fetchComboItems(d.id);d.comboItems=ci.map(x=>({sub_recipe_id:x.sub_recipe_id,qty:x.qty}));}
      setOv({type:"editR",data:d});
    }} onDel={async(id)=>{await deleteRecipe(id);setRecs(p=>p.filter(x=>x.id!==id));setOv(null);msg("Eliminada");}}/>}
    {ov?.type==="editR"&&<RecForm data={ov.data} ings={ings} recs={recs} onClose={()=>setOv(null)} onSave={async(r)=>{
      const saved=await upsertRecipe({id:r.id,name:r.name,category:r.category,sale_price:r.sale_price,visible:r.visible,image_url:r.image_url,description:r.description,related_ids:r.related_ids||[],is_combo:r.is_combo||false});
      if(saved){
        await saveRecipeIngredients(saved.id,(r.ingredients||[]).map(ri=>({ingredient_id:ri.ingredient_id,quantity:ri.quantity})));
        if(r.is_combo) await saveComboItems(saved.id,(r.comboItems||[]).filter(ci=>ci.sub_recipe_id&&ci.qty>0));
        await loadAll();setOv(null);msg(r.id?"Actualizada":"Creada");
      }
    }}/>}
  </>);
}

function RecDet({r,ings,rc,onClose,onEdit,onDel}){
  const c=rc(r);const m=r.sale_price>0?((r.sale_price-c)/r.sale_price*100):0;
  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>{r.name}</h2><button onClick={onEdit}>{I.edit({})}</button></div><div className="pb">
    <span className="badge" style={{background:r.visible!==false?"var(--gl)":"var(--rl)",color:r.visible!==false?"var(--gn)":"var(--rd)",marginBottom:12,display:"inline-block"}}>{r.visible!==false?"Visible":"Oculto"}</span>
    <div className="sg" style={{padding:0,marginBottom:16}}>
      <div className="sc"><div className="sl">Venta</div><div className="sv2">${fi(r.sale_price)}</div></div>
      <div className="sc"><div className="sl">Costo</div><div className="sv2 sva">${fm(c)}</div></div>
      <div className="sc"><div className="sl">Ganancia</div><div className="sv2 svg2">${fm(r.sale_price-c)}</div></div>
      <div className="sc"><div className="sl">Rent.</div><div className={`sv2 ${m>=50?"svg2":m>=30?"sva":"svr"}`}>{m.toFixed(1)}%</div></div>
    </div>
    <div className="st">Ingredientes</div>
    <div className="c" style={{padding:"8px 14px"}}>
      <div className="rir" style={{fontWeight:700,color:"var(--t3)",fontSize:11}}><div className="rin">INSUMO</div><div className="riq">CANT.</div><div className="ric">COSTO</div></div>
      {(r.ingredients||[]).map((ri,i)=>{const ig=ings.find(x=>x.id===ri.ingredient_id);if(!ig)return null;
        return(<div key={i} className="rir"><div className="rin">{ig.name}</div><div className="riq">{ri.quantity} {ig.unit}</div><div className="ric">${fm((ig.cost||0)*ri.quantity)}</div></div>);
      })}
      <div className="rir" style={{fontWeight:700,borderTop:"2px solid var(--b2)"}}><div className="rin">TOTAL</div><div className="riq"></div><div className="ric">${fm(c)}</div></div>
    </div>
    <button className="btn bd" style={{marginTop:16}} onClick={()=>onDel(r.id)}>{I.trash({size:16})} Eliminar</button>
  </div></div>);
}

function RecForm({data,ings,recs,onClose,onSave}){
  const [f,setF]=useState(data||{name:"",category:"",sale_price:0,visible:true,image_url:"",description:"",ingredients:[],related_ids:[],is_combo:false});
  const [ad,setAd]=useState(false);const [si,setSi]=useState("");const [sq,setSq]=useState("");
  const [showRel,setShowRel]=useState(false);
  const [showCombo,setShowCombo]=useState(false);
  const [comboItems,setComboItems]=useState(data?.comboItems||[]);
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef();
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const addI=()=>{if(!si||!sq)return;s("ingredients",[...f.ingredients,{ingredient_id:si,quantity:Number(sq)}]);setSi("");setSq("");setAd(false);};
  const toggleRel=(id)=>{const cur=f.related_ids||[];s("related_ids",cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]);};
  const otherRecs=(recs||[]).filter(r=>r.id!==f.id&&!r.is_combo);
  const handleImageUpload=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    setUploading(true);
    const url=await uploadRecipeImage(file);
    if(url)s("image_url",url);
    setUploading(false);
  };
  const addComboItem=()=>setComboItems(p=>[...p,{sub_recipe_id:"",qty:1}]);
  const updCombo=(i,k,v)=>setComboItems(p=>p.map((x,j)=>j===i?{...x,[k]:v}:x));
  const delCombo=(i)=>setComboItems(p=>p.filter((_,j)=>j!==i));

  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>{data?"Editar":"Nueva"} Receta</h2></div><div className="pb">
    <div className="fg"><label className="fl">Nombre</label><input className="fin" value={f.name} onChange={e=>s("name",e.target.value)}/></div>
    <div className="fr"><div className="fg"><label className="fl">Categoría</label><input className="fin" value={f.category} onChange={e=>s("category",e.target.value)} placeholder="Ej: Tortas"/></div>
    <div className="fg"><label className="fl">Precio</label><input className="fin" type="number" value={f.sale_price||""} onChange={e=>s("sale_price",Number(e.target.value))}/></div></div>
    <div className="fg"><label className="fl">Descripción</label><textarea className="fin" value={f.description||""} onChange={e=>s("description",e.target.value)} rows={2} style={{resize:"vertical"}}/></div>
    {/* Image upload */}
    <div className="fg">
      <label className="fl">Imagen</label>
      <div className="img-upload-wrap">
        {f.image_url?<img src={f.image_url} alt="" className="img-preview" onError={e=>e.target.style.display='none'}/>:null}
        <div className="img-upload-row">
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImageUpload}/>
          <button className="btn bs bsm" onClick={()=>fileRef.current?.click()} disabled={uploading} style={{flex:1}}>
            {uploading?"Subiendo...":f.image_url?`${I.edit({size:13})} Cambiar foto`:`📷 Subir foto`}
          </button>
          {f.image_url&&<button className="btn bd bsm" onClick={()=>s("image_url","")} style={{marginLeft:6}}>✕</button>}
        </div>
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0 8px"}}>
      <label className="fl" style={{margin:0}}>Visible en catálogo</label>
      <button className={`toggle ${f.visible!==false?"on":"off"}`} onClick={()=>s("visible",!f.visible)}/>
    </div>
    {/* Toggle Combo */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 0 12px"}}>
      <div><label className="fl" style={{margin:0}}>Es un Combo</label><div style={{fontSize:11,color:"var(--t3)"}}>Compuesto por otras recetas</div></div>
      <button className={`toggle ${f.is_combo?"on":"off"}`} onClick={()=>s("is_combo",!f.is_combo)}/>
    </div>
    {/* Combo Items */}
    {f.is_combo&&(<div style={{marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <label className="fl" style={{margin:0}}>Sub-recetas ({comboItems.length})</label>
        <button className="btn bs bsm" onClick={addComboItem}>{I.plus({size:14})} +</button>
      </div>
      <div className="c" style={{padding:"4px 14px"}}>
        {comboItems.length===0?<div className="empty" style={{padding:10,fontSize:13}}>Agregá las recetas que forman este combo</div>
        :comboItems.map((ci,i)=>(
          <div key={i} className="fr" style={{alignItems:"center",padding:"4px 0",borderBottom:"1px solid var(--b2)"}}>
            <select className="fin" style={{flex:2,marginBottom:0}} value={ci.sub_recipe_id} onChange={e=>updCombo(i,"sub_recipe_id",e.target.value)}>
              <option value="">Seleccionar...</option>
              {(recs||[]).filter(r=>r.id!==f.id).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input className="fin" type="number" min="1" style={{flex:1,marginBottom:0,marginLeft:6}} placeholder="Cant" value={ci.qty} onChange={e=>updCombo(i,"qty",Number(e.target.value))}/>
            <button style={{background:"none",border:"none",color:"var(--rd)",cursor:"pointer",marginLeft:4}} onClick={()=>delCombo(i)}>{I.trash({size:14})}</button>
          </div>
        ))}
      </div>
    </div>)}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 0 8px"}}><label className="fl" style={{margin:0}}>Ingredientes ({(f.ingredients||[]).length})</label><button className="btn bs bsm" onClick={()=>setAd(true)}>{I.plus({size:14})} +</button></div>
    {ad&&<div className="c" style={{background:"var(--b2)",marginBottom:10}}>
      <div className="fg"><select className="fin" value={si} onChange={e=>setSi(e.target.value)}><option value="">Seleccionar...</option>{ings.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></div>
      <div className="fr"><div className="fg" style={{marginBottom:0}}><input className="fin" type="number" placeholder="Cant." value={sq} onChange={e=>setSq(e.target.value)}/></div>
      <button className="btn bp bsm" onClick={addI} style={{alignSelf:"flex-end"}}>{I.check({size:16,color:"#fff"})}</button></div>
    </div>}
    <div className="c" style={{padding:"4px 14px"}}>
      {(f.ingredients||[]).length===0?<div className="empty" style={{padding:16}}>Sin ingredientes</div>
      :(f.ingredients||[]).map((ri,i)=>{const ig=ings.find(x=>x.id===ri.ingredient_id);
        return(<div key={i} className="rir"><div className="rin">{ig?.name||"?"}</div><div className="riq">{ri.quantity} {ig?.unit||""}</div>
          <button style={{background:"none",border:"none",color:"var(--rd)",cursor:"pointer"}} onClick={()=>s("ingredients",f.ingredients.filter((_,j)=>j!==i))}>{I.trash({size:14})}</button></div>);
      })}
    </div>
    {/* Sugerencias de upselling */}
    <div style={{marginTop:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <label className="fl" style={{margin:0}}>🎯 Sugerencias de venta ({(f.related_ids||[]).length})</label>
        <button className="btn bs bsm" onClick={()=>setShowRel(p=>!p)}>{showRel?"Ocultar":"Elegir"}</button>
      </div>
      {showRel&&<div className="c" style={{padding:"8px 14px",maxHeight:180,overflowY:"auto"}}>
        {otherRecs.length===0?<div className="empty" style={{padding:8}}>No hay otras recetas</div>
        :otherRecs.map(r=>{const sel=(f.related_ids||[]).includes(r.id);
          return(<div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid var(--b2)",cursor:"pointer"}} onClick={()=>toggleRel(r.id)}>
            <div style={{width:20,height:20,borderRadius:6,border:"2px solid",borderColor:sel?"var(--ac)":"var(--b2)",background:sel?"var(--ac)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
              {sel&&I.check({size:12,color:"#fff"})}
            </div>
            <span style={{flex:1,fontSize:14,color:"var(--tx)"}}>{r.name}</span>
            <span style={{fontSize:12,color:"var(--t3)"}}>${fi(r.sale_price)}</span>
          </div>);
        })}
      </div>}
    </div>
    <button className="btn bp" style={{marginTop:16}} onClick={()=>f.name&&onSave({...f,comboItems})}>{I.check({size:18,color:"#fff"})} {data?"Guardar":"Crear"}</button>
  </div></div>);
}

// ═══════ ORDERS ═══════
function Orders({orders,recs,moveOrd,addOrd,ov,setOv,msg}){
  const [fil,setFil]=useState(ST.new);const [showH,setShowH]=useState(false);const t=td();
  const cts=useMemo(()=>{const c={};Object.values(ST).forEach(s=>{c[s]=orders.filter(o=>o.status===s&&(s===ST.done||s===ST.cancel?o.date===t:true)).length;});return c;},[orders,t]);
  const filt=orders.filter(o=>{if(fil===ST.done||fil===ST.cancel)return o.status===fil&&o.date===t;return o.status===fil;}).sort((a,b)=>(b.created_at||b.date||"").localeCompare(a.created_at||a.date||""));
  const hist=orders.filter(o=>(o.status===ST.done||o.status===ST.cancel)&&o.date<t).sort((a,b)=>(b.created_at||b.date||"").localeCompare(a.created_at||a.date||""));
  const nxt=s=>({[ST.new]:{l:"Preparar",c:"byw",i:I.fire,n:ST.prep},[ST.prep]:{l:"Marcar activo",c:"bgn",i:I.zap,n:ST.active},[ST.active]:{l:"Completar",c:"bbl",i:I.check,n:ST.done}}[s]||null);
  const sfs=[{id:ST.new,l:"Nuevos",i:I.orders,co:"var(--bl)"},{id:ST.prep,l:"Preparando",i:I.fire,co:"var(--yw)"},{id:ST.active,l:"Activos",i:I.zap,co:"var(--gn)"},{id:ST.done,l:"Listos",i:I.check,co:"var(--t3)"},{id:ST.cancel,l:"Cancel.",i:I.x,co:"var(--rd)"}];

  return(<>
    <div className="s"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div className="st" style={{margin:0}}>Pedidos</div><button className="btn bs bsm" onClick={()=>setShowH(true)}>{I.hist({size:14})} Historial</button></div></div>
    <div className="sf">{sfs.map(sf=>(<button key={sf.id} className={`sfi ${fil===sf.id?"on":""}`} style={{color:fil===sf.id?sf.co:"var(--t3)",borderColor:fil===sf.id?sf.co:"var(--b2)"}} onClick={()=>setFil(sf.id)}>
      {sf.i({size:14,color:fil===sf.id?sf.co:"var(--t3)"})}{sf.l}{cts[sf.id]>0&&<span className="sfc" style={{background:sf.co+"20",color:sf.co}}>{cts[sf.id]}</span>}
    </button>))}</div>
    <div className="s">
      {filt.length===0?<div className="c"><div className="empty"><div className="eic">{fil===ST.new?"📋":fil===ST.prep?"👨‍🍳":fil===ST.active?"⚡":"✓"}</div><div>No hay pedidos {ST_L[fil]?.toLowerCase()}</div></div></div>
      :filt.map(o=>{const act=nxt(o.status);const sc=ST_C[o.status];const items=o.order_items||o.items||[];
        return(<div key={o.id} className="ocard" style={{borderLeftColor:ST_B[o.status]}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div><div style={{fontWeight:700,fontSize:15}}>{o.customer}</div>
              <div style={{fontSize:12,color:"var(--t3)"}}>{new Date(o.created_at||o.date).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}
                {o.phone&&` · ${o.phone}`}{o.delivery&&` · ${o.delivery==="envio"?"Envío":"Retiro"}`}{o.payment&&` · ${o.payment}`}
              </div></div>
            <span className="badge" style={{background:sc?.bg,color:sc?.tx}}>{ST_L[o.status]}</span>
          </div>
          {items.map((it,i)=>{const r=recs.find(x=>x.id===it.recipe_id);return(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:13}}><span>{r?.name||"?"} × {it.quantity||it.qty||1}</span><span style={{fontWeight:600}}>${fi((it.quantity||it.qty||1)*(it.unit_price||0))}</span></div>);})}
          {o.is_gift&&<div style={{fontSize:12,color:"var(--ac)",fontWeight:600,marginTop:4,padding:"4px 8px",background:"var(--al)",borderRadius:6}}>🎁 Pedido regalo{o.gift_note?`: "${o.gift_note}"`:""}</div>}
          {o.note&&<div style={{fontSize:12,color:"var(--t3)",fontStyle:"italic",marginTop:4,padding:"4px 8px",background:"var(--b2)",borderRadius:6}}>💬 {o.note}</div>}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 0",borderTop:"1px solid var(--b2)",marginTop:8,fontWeight:700,fontSize:16}}><span>Total</span><span>${fi(o.total)}</span></div>
          {act&&<div className="oa">{o.status!==ST.done&&o.status!==ST.cancel&&<button className="btn bd" onClick={()=>moveOrd(o.id,ST.cancel)}>{I.x({size:14})} Cancelar</button>}<button className={`btn ${act.c}`} onClick={()=>moveOrd(o.id,act.n)}>{act.i({size:14,color:"#fff"})} {act.l}</button></div>}
        </div>);
      })}
    </div>
    <button className="fab" onClick={()=>setOv({type:"addOrder"})}>{I.plus({size:24,color:"#fff"})}</button>
    {ov?.type==="addOrder"&&<OrdForm recs={recs} onClose={()=>setOv(null)} onSave={o=>{addOrd(o);setOv(null);}}/>}
    {showH&&<div className="po"><div className="ph"><button onClick={()=>setShowH(false)}>{I.back({})}</button><h2>Historial</h2></div><div className="pb">
      {hist.length===0?<div className="c"><div className="empty"><div className="eic">📜</div><div>Sin historial</div></div></div>
      :Object.entries(hist.reduce((a,o)=>{const d=(o.created_at||o.date||"").split("T")[0];if(!a[d])a[d]=[];a[d].push(o);return a;},{})).sort((a,b)=>b[0].localeCompare(a[0])).map(([d,os])=>(<div key={d}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--t3)",padding:"8px 0 4px"}}>{new Date(d+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</div>
        {os.map(o=>{const sc=ST_C[o.status];const items=o.order_items||o.items||[];return(<div key={o.id} className="c" style={{padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:700,fontSize:14}}>{o.customer}</div>
            <div style={{fontSize:11,color:"var(--t3)"}}>{items.map(it=>{const r=recs.find(x=>x.id===it.recipe_id);return r?`${r.name} ×${it.quantity||it.qty||1}`:"";}).filter(Boolean).join(", ")}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700}}>${fi(o.total)}</div><span className="badge" style={{background:sc?.bg,color:sc?.tx}}>{ST_L[o.status]}</span></div>
          </div></div>);})}
      </div>))}
    </div></div>}
  </>);
}

function OrdForm({recs,onClose,onSave}){
  const [cust,setCust]=useState("");const [ph,setPh]=useState("");const [note,setNote]=useState("");
  const [items,setItems]=useState([{recipe_id:"",qty:1}]);
  const add=()=>setItems(p=>[...p,{recipe_id:"",qty:1}]);
  const upd=(i,k,v)=>setItems(p=>p.map((x,j)=>j===i?{...x,[k]:v}:x));
  const rm=i=>setItems(p=>p.filter((_,j)=>j!==i));
  const tot=items.reduce((s,it)=>{const r=recs.find(x=>x.id===it.recipe_id);return s+(r?(r.sale_price||0)*it.qty:0);},0);
  const ok=cust&&items.some(it=>it.recipe_id&&it.qty>0);

  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>Nuevo Pedido</h2></div><div className="pb">
    <div className="fg"><label className="fl">Cliente</label><input className="fin" value={cust} onChange={e=>setCust(e.target.value)} placeholder="Nombre"/></div>
    <div className="fr"><div className="fg"><label className="fl">Teléfono</label><input className="fin" value={ph} onChange={e=>setPh(e.target.value)}/></div>
    <div className="fg"><label className="fl">Nota</label><input className="fin" value={note} onChange={e=>setNote(e.target.value)}/></div></div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"4px 0 12px"}}><label className="fl" style={{margin:0}}>Productos</label><button className="btn bp bsm" onClick={add}>{I.plus({size:14})} Producto</button></div>
    {items.map((it,i)=>{const r=recs.find(x=>x.id===it.recipe_id);return(<div key={i} className="c" style={{padding:10,marginBottom:8,position:"relative"}}>
      {items.length>1&&<button onClick={()=>rm(i)} style={{position:"absolute",top:6,right:6,background:"none",border:"none",cursor:"pointer",color:"var(--rd)"}}>{I.x({size:14})}</button>}
      <div className="fg" style={{marginBottom:6}}><select className="fin" value={it.recipe_id} onChange={e=>upd(i,"recipe_id",e.target.value)}><option value="">Seleccionar...</option>{recs.filter(r2=>r2.visible!==false).map(r2=><option key={r2.id} value={r2.id}>{r2.name} — ${fi(r2.sale_price)}</option>)}</select></div>
      <div className="fr"><div className="fg" style={{marginBottom:0}}><label className="fl">Cant.</label><input className="fin" type="number" min="1" value={it.qty} onChange={e=>upd(i,"qty",Number(e.target.value))}/></div>
      {r&&<div className="fg" style={{marginBottom:0}}><label className="fl">Sub</label><div style={{padding:"12px 0",fontWeight:700}}>${fi((r.sale_price||0)*it.qty)}</div></div>}</div>
    </div>);})}
    {tot>0&&<div className="c" style={{background:"var(--al)",textAlign:"center",marginTop:8}}><div style={{fontSize:12,fontWeight:600,color:"var(--ac)"}}>TOTAL</div><div style={{fontSize:28,fontWeight:700,fontFamily:"'DM Serif Display',serif",color:"var(--ac)"}}>${fi(tot)}</div></div>}
    <button className="btn bp" style={{marginTop:16}} disabled={!ok} onClick={()=>{if(!ok)return;
      const f=items.filter(it=>it.recipe_id&&it.qty>0).map(it=>{const r=recs.find(x=>x.id===it.recipe_id);return{recipe_id:it.recipe_id,quantity:it.qty,unit_price:r?.sale_price||0,subtotal:(r?.sale_price||0)*it.qty};});
      onSave({id:uid(),customer:cust,phone:ph,note,order_items:f,items:f,total:f.reduce((s,it)=>s+it.subtotal,0),status:ST.new,date:td(),created_at:new Date().toISOString()});
    }}>{I.check({size:18,color:"#fff"})} Crear</button>
  </div></div>);
}

// ═══════ CANCEL DIALOG ═══════
function CancelDlg({order,recs,ings,onClose,onConfirm}){
  const used=[];const items=order.order_items||order.items||[];
  items.forEach(it=>{const r=recs.find(x=>x.id===it.recipe_id);if(!r)return;
    (r.ingredients||[]).forEach(ri=>{const ig=ings.find(x=>x.id===ri.ingredient_id);if(!ig)return;
      const ex=used.find(u=>u.id===ig.id);if(ex)ex.qty+=ri.quantity*(it.quantity||it.qty||1);
      else used.push({id:ig.id,name:ig.name,unit:ig.unit,qty:ri.quantity*(it.quantity||it.qty||1)});
    });
  });
  return(<div className="modal"><div className="modal-c">
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
      <div style={{width:40,height:40,borderRadius:10,background:"var(--rl)",display:"flex",alignItems:"center",justifyContent:"center"}}>{I.alert({size:20,color:"var(--rd)"})}</div>
      <div><div style={{fontWeight:700,fontSize:16}}>Cancelar pedido</div><div style={{fontSize:12,color:"var(--t3)"}}>de {order.customer}</div></div>
    </div>
    <div style={{fontSize:14,color:"var(--t2)",marginBottom:12}}>Los insumos ya fueron descontados. ¿Qué hacemos?</div>
    {used.length>0&&<div className="c" style={{padding:"8px 12px",marginBottom:16,background:"var(--b2)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>Insumos usados</div>
      {used.map(ig=>(<div key={ig.id} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:13}}><span>{ig.name}</span><span style={{fontWeight:600}}>{ig.qty} {ig.unit}</span></div>))}
    </div>}
    <button className="btn bgn" style={{marginBottom:8}} onClick={()=>onConfirm(true)}>{I.back({size:16,color:"#fff"})} Devolver al stock</button>
    <button className="btn bd" style={{marginBottom:8}} onClick={()=>onConfirm(false)}>{I.trash({size:16})} Registrar desperdicio</button>
    <button className="btn bs" onClick={onClose}>Volver</button>
  </div></div>);
}

// ═══════ EXPENSES ═══════
function Expenses({exps,setExps,sett,msg,onClose}){
  const mo=td().slice(0,7)+"-01";
  const sorted=[...exps].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const tM=exps.filter(e=>e.date>=mo).reduce((s,e)=>s+(e.amount||0),0);
  const byC=exps.filter(e=>e.date>=mo).reduce((a,e)=>{a[e.category||"Otros"]=(a[e.category||"Otros"]||0)+(e.amount||0);return a;},{});
  const [ae,setAe]=useState(false);

  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>Gastos</h2><div style={{fontSize:14,fontWeight:700,color:"var(--rd)"}}>Mes: ${fi(tM)}</div></div><div className="pb">
    {Object.keys(byC).length>0&&<div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto"}}>
      {Object.entries(byC).sort((a,b)=>b[1]-a[1]).map(([c,a])=>(<div key={c} style={{background:"var(--b3)",borderRadius:10,padding:"8px 12px",minWidth:100,boxShadow:"var(--sh)",flexShrink:0}}><div style={{fontSize:10,color:"var(--t3)",fontWeight:600,textTransform:"uppercase"}}>{c}</div><div style={{fontSize:15,fontWeight:700}}>${fi(a)}</div></div>))}
    </div>}
    <button className="btn bp" style={{marginBottom:12}} onClick={()=>setAe(true)}>{I.plus({size:16,color:"#fff"})} Registrar gasto</button>
    <div className="c" style={{padding:0,overflow:"hidden"}}>
      {sorted.length===0?<div className="empty"><div className="eic">💰</div><div>Sin gastos</div></div>
      :sorted.map(e=>(<div key={e.id} className="li">
        <div className="lic" style={{background:"var(--rl)",color:"var(--rd)"}}>{I.dollar({size:16})}</div>
        <div className="lii"><div className="lin">{e.description}</div><div className="lid">{e.date&&new Date(e.date+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"short"})}{e.supplier&&` · ${e.supplier}`}</div></div>
        <div className="lir"><div className="lia" style={{color:"var(--rd)"}}>-${fi(e.amount)}</div></div>
      </div>))}
    </div>
  </div>{ae&&<ExpForm sett={sett} onClose={()=>setAe(false)} onSave={async(e)=>{
    const saved=await createExpense(e);if(saved){setExps(p=>[saved,...p]);setAe(false);msg("Registrado");}else{setAe(false);msg("Error al registrar");}
  }}/>}</div>);
}

function ExpForm({onClose,onSave,sett}){
  const [f,setF]=useState({date:td(),description:"",amount:0,category:"Materia Prima",supplier:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>Registrar Gasto</h2></div><div className="pb">
    <div className="fg"><label className="fl">Descripción</label><input className="fin" value={f.description} onChange={e=>s("description",e.target.value)} placeholder="Ej: Gas"/></div>
    <div className="fr"><div className="fg"><label className="fl">Monto</label><input className="fin" type="number" value={f.amount||""} onChange={e=>s("amount",Number(e.target.value))}/></div>
    <div className="fg"><label className="fl">Fecha</label><input className="fin" type="date" value={f.date} onChange={e=>s("date",e.target.value)}/></div></div>
    <div className="fg"><label className="fl">Categoría</label><select className="fin" value={f.category} onChange={e=>s("category",e.target.value)}>{(sett?.exp_cats||DEF.exp_cats).map(c=><option key={c}>{c}</option>)}</select></div>
    <div className="fg"><label className="fl">Proveedor</label><input className="fin" value={f.supplier} onChange={e=>s("supplier",e.target.value)}/></div>
    <button className="btn bp" onClick={()=>f.description&&f.amount>0&&onSave(f)}>{I.check({size:18,color:"#fff"})} Registrar</button>
  </div></div>);
}

// ═══════ PURCHASE ═══════
function Purchase({ings,setIngs,exps,setExps,sett,onClose,msg,loadAll}){
  const [sup,setSup]=useState("");const [date,setDate]=useState(td());
  const [items,setItems]=useState([]);const [sn,setSn]=useState(false);
  const [ni,setNi]=useState({name:"",unit:"kg",category:"Secos",cost:0,min_stock:0});
  const add=()=>setItems(p=>[...p,{ingredient_id:"",qty:0,unitCost:0}]);
  const upd=(i,k,v)=>setItems(p=>p.map((x,j)=>j===i?{...x,[k]:v}:x));
  const rm=i=>setItems(p=>p.filter((_,j)=>j!==i));
  const sel=(i,id)=>{const ig=ings.find(x=>x.id===id);upd(i,"ingredient_id",id);if(ig)upd(i,"unitCost",ig.cost||0);};

  const cr=async()=>{
    if(!ni.name)return;
    const saved=await upsertIngredient({...ni,stock:0});
    if(saved){setIngs(p=>[...p,saved]);setSn(false);setNi({name:"",unit:"kg",category:"Secos",cost:0,min_stock:0});msg("Insumo: "+saved.name);}
  };

  const tot=items.reduce((s,it)=>s+(it.qty||0)*(it.unitCost||0),0);

  const sub=async()=>{
    const v=items.filter(it=>it.ingredient_id&&it.qty>0);if(!v.length)return;
    // Update stock for each item
    for(const it of v){
      await updateIngredientStock(it.ingredient_id,it.qty);
      if(it.unitCost>0){
        await upsertIngredient({id:it.ingredient_id,cost:it.unitCost});
      }
    }
    // Register as expense if total > 0
    if(tot>0){
      const d=v.map(it=>{const ig=ings.find(x=>x.id===it.ingredient_id);return ig?`${ig.name} x${it.qty}`:"";}).filter(Boolean).join(", ");
      const saved=await createExpense({date,description:`Compra: ${d.slice(0,50)}`,amount:tot,category:"Materia Prima",supplier:sup});
      if(saved)setExps(p=>[saved,...p]);
    }
    await loadAll();msg("Compra registrada");onClose();
  };

  const ic=sett?.ing_cats||DEF.ing_cats;

  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>Registrar Compra</h2></div><div className="pb">
    <div className="fr"><div className="fg"><label className="fl">Proveedor</label><input className="fin" value={sup} onChange={e=>setSup(e.target.value)}/></div>
    <div className="fg"><label className="fl">Fecha</label><input className="fin" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div></div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"4px 0 12px"}}><label className="fl" style={{margin:0}}>Items ({items.length})</label>
      <div style={{display:"flex",gap:6}}><button className="btn bs bsm" onClick={()=>setSn(true)}>{I.plus({size:14})} Nuevo</button><button className="btn bp bsm" onClick={add}>{I.plus({size:14})} Item</button></div>
    </div>
    {sn&&<div className="c" style={{background:"var(--bll)",border:"2px solid var(--bl)",marginBottom:12}}>
      <div style={{fontWeight:700,fontSize:13,color:"var(--bl)",marginBottom:8}}>CREAR INSUMO</div>
      <div className="fg"><input className="fin" placeholder="Nombre" value={ni.name} onChange={e=>setNi(p=>({...p,name:e.target.value}))}/></div>
      <div className="fr"><div className="fg"><label className="fl">Unidad</label><select className="fin" value={ni.unit} onChange={e=>setNi(p=>({...p,unit:e.target.value}))}>{["kg","g","lt","ml","uni"].map(u=><option key={u}>{u}</option>)}</select></div>
      <div className="fg"><label className="fl">Cat.</label><select className="fin" value={ni.category} onChange={e=>setNi(p=>({...p,category:e.target.value}))}>{ic.map(c=><option key={c}>{c}</option>)}</select></div></div>
      <div className="fr"><div className="fg"><label className="fl">$/u</label><input className="fin" type="number" value={ni.cost||""} onChange={e=>setNi(p=>({...p,cost:Number(e.target.value)}))}/></div>
      <div className="fg"><label className="fl">Mín</label><input className="fin" type="number" value={ni.min_stock||""} onChange={e=>setNi(p=>({...p,min_stock:Number(e.target.value)}))}/></div></div>
      <div className="fr"><button className="btn bs" onClick={()=>setSn(false)}>Cancelar</button><button className="btn bp" onClick={cr}>{I.check({size:16,color:"#fff"})} Crear</button></div>
    </div>}
    {items.map((it,i)=>(<div key={i} className="c" style={{padding:12,marginBottom:8,position:"relative"}}>
      <button onClick={()=>rm(i)} style={{position:"absolute",top:8,right:8,background:"none",border:"none",cursor:"pointer",color:"var(--rd)"}}>{I.x({size:16})}</button>
      <div className="fg" style={{marginBottom:8}}><select className="fin" value={it.ingredient_id} onChange={e=>sel(i,e.target.value)}><option value="">Seleccionar...</option>{ings.map(x=><option key={x.id} value={x.id}>{x.name} ({x.unit}) — {x.stock||0}</option>)}</select></div>
      <div className="fr"><div className="fg" style={{marginBottom:0}}><label className="fl">Cant.</label><input className="fin" type="number" value={it.qty||""} onChange={e=>upd(i,"qty",Number(e.target.value))}/></div>
      <div className="fg" style={{marginBottom:0}}><label className="fl">$/u</label><input className="fin" type="number" value={it.unitCost||""} onChange={e=>upd(i,"unitCost",Number(e.target.value))}/></div>
      <div className="fg" style={{marginBottom:0}}><label className="fl">Sub</label><div style={{padding:"12px 0",fontWeight:700}}>${fi((it.qty||0)*(it.unitCost||0))}</div></div></div>
    </div>))}
    {items.length===0&&<div className="c"><div className="empty" style={{padding:20}}><div className="eic">📦</div><div>Tocá "+ Item"</div></div></div>}
    {items.length>0&&<div className="c" style={{background:"var(--al)",textAlign:"center",marginTop:12}}><div style={{fontSize:12,fontWeight:600,color:"var(--ac)"}}>TOTAL</div><div style={{fontSize:28,fontWeight:700,fontFamily:"'DM Serif Display',serif",color:"var(--ac)"}}>${fi(tot)}</div></div>}
    <button className="btn bp" style={{marginTop:16}} onClick={sub}>{I.check({size:18,color:"#fff"})} Confirmar</button>
  </div></div>);
}

// ═══════ SALES ═══════
function SalesView({sales,setSales,recs,rc,ov,setOv,msg}){
  const mo=td().slice(0,7)+"-01";
  const sorted=[...sales].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const gr=sorted.reduce((a,s)=>{if(!a[s.date])a[s.date]=[];a[s.date].push(s);return a;},{});
  const tM=sales.filter(s=>s.date>=mo).reduce((a,x)=>a+(x.total||0),0);

  return(<>
    <div className="s"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div className="st" style={{margin:0}}>Ventas</div><div style={{fontSize:14,fontWeight:700,color:"var(--gn)"}}>Mes: ${fi(tM)}</div></div></div>
    <div className="s">
      {Object.entries(gr).map(([d,its])=>{const dt=its.reduce((a,i)=>a+(i.total||0),0);
        return(<div key={d}><div style={{display:"flex",justifyContent:"space-between",padding:"8px 4px 4px",fontSize:12,fontWeight:700,color:"var(--t3)"}}><span>{new Date(d+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"})}</span><span>${fi(dt)}</span></div>
          <div className="c" style={{padding:0,overflow:"hidden"}}>{its.map(s=>{const r=recs.find(x=>x.id===s.recipe_id);
            return(<div key={s.id} className="li"><div className="lic" style={{background:"var(--gl)",color:"var(--gn)"}}>{I.cart({size:16})}</div>
              <div className="lii"><div className="lin">{r?.name||"?"}</div><div className="lid">{s.qty||1} × ${fi(s.unit_price||0)}</div></div>
              <div className="lir"><div className="lia" style={{color:"var(--gn)"}}>${fi(s.total)}</div></div>
            </div>);
          })}</div>
        </div>);
      })}
      {sales.length===0&&<div className="c"><div className="empty"><div className="eic">🛒</div><div>Sin ventas</div></div></div>}
    </div>
    <button className="fab" onClick={()=>setOv({type:"addSale"})}>{I.plus({size:24,color:"#fff"})}</button>
    {ov?.type==="addSale"&&<SaleForm recs={recs} onClose={()=>setOv(null)} onSave={async(s)=>{
      const saved=await createSale(s);if(saved){setSales(p=>[saved,...p]);setOv(null);msg("Registrada");}
    }}/>}
  </>);
}

function SaleForm({recs,onClose,onSave}){
  const [ri,setRi]=useState("");const [q,setQ]=useState(1);const [p,setP]=useState(0);const [d,setD]=useState(td());
  const r=recs.find(x=>x.id===ri);
  useEffect(()=>{if(r)setP(r.sale_price||0);},[r]);

  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>Registrar Venta</h2></div><div className="pb">
    <div className="fg"><label className="fl">Producto</label><select className="fin" value={ri} onChange={e=>setRi(e.target.value)}><option value="">Seleccionar...</option>{recs.map(r2=><option key={r2.id} value={r2.id}>{r2.name} — ${fi(r2.sale_price)}</option>)}</select></div>
    <div className="fg"><label className="fl">Fecha</label><input className="fin" type="date" value={d} onChange={e=>setD(e.target.value)}/></div>
    <div className="fr"><div className="fg"><label className="fl">Cant.</label><input className="fin" type="number" min="1" value={q} onChange={e=>setQ(Number(e.target.value))}/></div>
    <div className="fg"><label className="fl">$/u</label><input className="fin" type="number" value={p||""} onChange={e=>setP(Number(e.target.value))}/></div></div>
    {ri&&q>0&&p>0&&<div className="c" style={{background:"var(--gl)",textAlign:"center",marginTop:8}}><div style={{fontSize:12,color:"var(--gn)",fontWeight:600}}>TOTAL</div><div style={{fontSize:28,fontWeight:700,color:"var(--gn)",fontFamily:"'DM Serif Display',serif"}}>${fi(q*p)}</div></div>}
    <button className="btn bp" style={{marginTop:12}} onClick={()=>ri&&q>0&&p>0&&onSave({date:d,recipe_id:ri,qty:q,unit_price:p,total:q*p})}>{I.check({size:18,color:"#fff"})} Registrar</button>
  </div></div>);
}

// ═══════ SETTINGS ═══════
function Settings({sett,setSett,msg,onBack}){
  const [s,setS]=useState({...sett});const [nc,setNc]=useState("");const [ni,setNi2]=useState("");
  const set=(k,v)=>setS(p=>({...p,[k]:v}));

  return(<>
    <div className="s" style={{paddingTop:4}}><div className="st">Ajustes</div></div>
    <div className="s">
      <div className="c"><div className="fg"><label className="fl">Nombre</label><input className="fin" value={s.biz_name||""} onChange={e=>set("biz_name",e.target.value)}/></div>
      <div className="fg"><label className="fl">Inicial</label><input className="fin" value={s.logo_letter||""} onChange={e=>set("logo_letter",e.target.value.slice(0,2).toUpperCase())} maxLength={2} style={{width:80,textAlign:"center",fontSize:20,fontWeight:700}}/></div>
      <div className="fg"><label className="fl">Color</label><div className="cgrid">{COLORS.map(c=>(<div key={c.h} className={`copt ${s.logo_color===c.h?"on":""}`} style={{background:c.h}} onClick={()=>set("logo_color",c.h)}>{s.logo_letter||"N"}</div>))}</div></div></div>

      <div className="c"><label className="fl">Categorías de gastos</label>
        <div className="clist">{(s.exp_cats||[]).map(c=><div key={c} className="ctag">{c}<button onClick={()=>set("exp_cats",(s.exp_cats||[]).filter(x=>x!==c))}>×</button></div>)}</div>
        <div style={{display:"flex",gap:8,marginTop:8}}><input className="fin" placeholder="Nueva..." value={nc} onChange={e=>setNc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&nc.trim()&&(set("exp_cats",[...(s.exp_cats||[]),nc.trim()]),setNc(""))} style={{fontSize:13}}/>
        <button className="btn bs bsm" onClick={()=>nc.trim()&&(set("exp_cats",[...(s.exp_cats||[]),nc.trim()]),setNc(""))}>+</button></div>
      </div>

      <div className="c"><label className="fl">Categorías de insumos</label>
        <div className="clist">{(s.ing_cats||[]).map(c=><div key={c} className="ctag">{c}<button onClick={()=>set("ing_cats",(s.ing_cats||[]).filter(x=>x!==c))}>×</button></div>)}</div>
        <div style={{display:"flex",gap:8,marginTop:8}}><input className="fin" placeholder="Nueva..." value={ni} onChange={e=>setNi2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ni.trim()&&(set("ing_cats",[...(s.ing_cats||[]),ni.trim()]),setNi2(""))} style={{fontSize:13}}/>
        <button className="btn bs bsm" onClick={()=>ni.trim()&&(set("ing_cats",[...(s.ing_cats||[]),ni.trim()]),setNi2(""))}>+</button></div>
      </div>

      <button className="btn bp" style={{marginTop:8}} onClick={async()=>{const saved=await updateSettings(s);if(saved){setSett(saved);msg("Guardado");onBack();}else{msg("Error al guardar");}}}>{I.check({size:18,color:"#fff"})} Guardar</button>
    </div>
  </>);
}
