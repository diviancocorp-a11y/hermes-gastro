import { useState, useMemo } from "react";
import { I, fi, td, uid, ST, ST_L, ST_C, ST_B } from "../../lib/utils";

function DeliveryBadge({date}){
  if(!date)return null;
  const today=td();
  const tom=new Date();tom.setDate(tom.getDate()+1);const tomStr=tom.toISOString().split("T")[0];
  const past=date<today;
  const label=date===today?"🔴 Para HOY":date===tomStr?"🟡 Para MAÑANA":past?`⚠️ Vencido ${new Date(date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"})}`:`📅 Para el ${new Date(date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"})}`;
  const bg=past?"var(--rl)":date===today?"var(--rl)":date===tomStr?"var(--yl)":"var(--b2)";
  const co=past?"var(--rd)":date===today?"var(--rd)":date===tomStr?"var(--yw)":"var(--t3)";
  return(<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8,background:bg,color:co}}>{label}</span>);
}

function Orders({orders,recs,moveOrd,addOrd,ov,setOv,msg,sett}){
  const [fil,setFil]=useState(ST.new);const [showH,setShowH]=useState(false);const [showSched,setShowSched]=useState(false);const t=td();
  const [histPage,setHistPage]=useState(1);const HIST_PER_PAGE=20;

  // Calcular si el local está abierto ahora (misma lógica que Catalog)
  const storeIsOpen=useMemo(()=>{
    if(sett?.store_open===false)return false;
    const hrs=sett?.store_hours;if(!hrs)return true;
    const now=new Date();const dayIdx=(now.getDay()+6)%7;
    const day=hrs[dayIdx];if(!day||day.closed)return false;
    if(!day.open||!day.close)return true;
    const nowMins=now.getHours()*60+now.getMinutes();
    const [oh,om]=day.open.split(":").map(Number);
    const [ch,cm]=day.close.split(":").map(Number);
    return nowMins>=oh*60+om&&nowMins<ch*60+cm;
  },[sett]);

  // Pedidos programados: solo los de HOY (o vencidos) que no estén finalizados
  // Se muestran solo cuando el local está abierto
  const scheduled=useMemo(()=>orders.filter(o=>o.delivery_date&&o.status!==ST.done&&o.status!==ST.cancel&&(o.delivery_date<=t)).sort((a,b)=>(a.delivery_date||"").localeCompare(b.delivery_date||"")),[orders,t]);
  // Programados futuros (para referencia)
  const scheduledFuture=useMemo(()=>orders.filter(o=>o.delivery_date&&o.status!==ST.done&&o.status!==ST.cancel&&o.delivery_date>t).sort((a,b)=>(a.delivery_date||"").localeCompare(b.delivery_date||"")),[orders,t]);

  // Counts: para "new" solo contar pedidos de hoy sin delivery_date
  const cts=useMemo(()=>{const c={};Object.values(ST).forEach(s=>{
    if(s===ST.new)c[s]=orders.filter(o=>o.status===s&&o.date===t&&!o.delivery_date).length;
    else if(s===ST.done||s===ST.cancel)c[s]=orders.filter(o=>o.status===s&&o.date===t).length;
    else c[s]=orders.filter(o=>o.status===s).length;
  });return c;},[orders,t]);

  // Filtrado: "new" = solo hoy sin delivery_date; "done"/"cancel" = solo hoy; resto = todos
  const filt=useMemo(()=>orders.filter(o=>{
    if(fil===ST.new)return o.status===fil&&o.date===t&&!o.delivery_date;
    if(fil===ST.done||fil===ST.cancel)return o.status===fil&&o.date===t;
    return o.status===fil;
  }).sort((a,b)=>(b.created_at||b.date||"").localeCompare(a.created_at||a.date||"")),[orders,fil,t]);
  const hist=useMemo(()=>orders.filter(o=>(o.status===ST.done||o.status===ST.cancel)&&o.date<t).sort((a,b)=>(b.created_at||b.date||"").localeCompare(a.created_at||a.date||"")),[orders,t]);
  const histPaged=useMemo(()=>hist.slice(0,histPage*HIST_PER_PAGE),[hist,histPage]);
  const histGrouped=useMemo(()=>Object.entries(histPaged.reduce((a,o)=>{const d=(o.created_at||o.date||"").split("T")[0];if(!a[d])a[d]=[];a[d].push(o);return a;},{})).sort((a,b)=>b[0].localeCompare(a[0])),[histPaged]);
  const nxt=s=>({[ST.new]:{l:"Preparar",c:"byw",i:I.fire,n:ST.prep},[ST.prep]:{l:"Marcar activo",c:"bgn",i:I.zap,n:ST.active},[ST.active]:{l:"Completar",c:"bbl",i:I.check,n:ST.done}}[s]||null);
  const sfs=[{id:ST.new,l:"Nuevos",i:I.orders,co:"var(--bl)"},{id:ST.prep,l:"Preparando",i:I.fire,co:"var(--yw)"},{id:ST.active,l:"Activos",i:I.zap,co:"var(--gn)"},{id:ST.done,l:"Listos",i:I.check,co:"var(--t3)"},{id:ST.cancel,l:"Cancel.",i:I.x,co:"var(--rd)"}];

  return(<>
    <div className="s"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div className="st" style={{margin:0}}>Pedidos</div><div style={{display:"flex",gap:6}}>
      <button className="btn bs bsm" onClick={()=>setShowSched(true)}>📅 Programados{(scheduled.length+scheduledFuture.length)>0&&<span style={{marginLeft:4,background:"var(--yl)",color:"var(--yw)",borderRadius:8,padding:"0 5px",fontSize:11,fontWeight:700}}>{scheduled.length+scheduledFuture.length}</span>}</button>
      <button className="btn bs bsm" onClick={()=>setShowH(true)}>{I.hist({size:14})} Historial</button>
    </div></div></div>
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
          {o.delivery_date&&<div style={{marginTop:6}}><DeliveryBadge date={o.delivery_date}/></div>}
          {o.is_gift&&<div style={{fontSize:12,color:"var(--ac)",fontWeight:600,marginTop:4,padding:"4px 8px",background:"var(--al)",borderRadius:6}}>🎁 Pedido regalo{o.gift_note?`: "${o.gift_note}"`:""}</div>}
          {o.note&&<div style={{fontSize:12,color:"var(--t3)",fontStyle:"italic",marginTop:4,padding:"4px 8px",background:"var(--b2)",borderRadius:6}}>💬 {o.note}</div>}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 0",borderTop:"1px solid var(--b2)",marginTop:8,fontWeight:700,fontSize:16}}><span>Total</span><span>${fi(o.total)}</span></div>
          {act&&<div className="oa">{o.status!==ST.done&&o.status!==ST.cancel&&<button className="btn bd" onClick={()=>moveOrd(o.id,ST.cancel)}>{I.x({size:14})} Cancelar</button>}<button className={`btn ${act.c}`} onClick={()=>moveOrd(o.id,act.n)}>{act.i({size:14,color:"#fff"})} {act.l}</button></div>}
        </div>);
      })}
    </div>
    <button className="fab" onClick={()=>setOv({type:"addOrder"})}>{I.plus({size:24,color:"#fff"})}</button>
    {ov?.type==="addOrder"&&<OrdForm recs={recs} onClose={()=>setOv(null)} onSave={o=>{addOrd(o);setOv(null);}}/>}
    {showSched&&<div className="po"><div className="ph"><button onClick={()=>setShowSched(false)}>{I.back({})}</button><h2>📅 Programados</h2></div><div className="pb">
      {!storeIsOpen&&scheduled.length>0&&<div className="ab" style={{margin:"0 0 12px",background:"var(--yl)",color:"var(--yw)"}}>El local está cerrado · Los programados de hoy se activan al abrir</div>}
      {scheduled.length>0&&<><div style={{fontSize:12,fontWeight:700,color:"var(--ac)",marginBottom:8}}>Para hoy ({scheduled.length})</div>
      {scheduled.map(o=>{const items=o.order_items||o.items||[];const sc=ST_C[o.status];
        return(<div key={o.id} className="c" style={{padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div><div style={{fontWeight:700,fontSize:14}}>{o.customer}</div>
              <div style={{fontSize:11,color:"var(--t3)"}}>{items.map(it=>{const r=recs.find(x=>x.id===it.recipe_id);return r?`${r.name} ×${it.quantity||it.qty||1}`:"";}).filter(Boolean).join(", ")}</div>
              {o.note&&<div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>💬 {o.note}</div>}
            </div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700}}>${fi(o.total)}</div><span className="badge" style={{background:sc?.bg,color:sc?.tx}}>{ST_L[o.status]}</span></div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <DeliveryBadge date={o.delivery_date}/>
            <span style={{fontSize:11,color:"var(--t3)"}}>{o.phone||""}</span>
          </div>
        </div>);
      })}</>}
      {scheduledFuture.length>0&&<><div style={{fontSize:12,fontWeight:700,color:"var(--t3)",marginBottom:8,marginTop:scheduled.length>0?16:0}}>Próximos días ({scheduledFuture.length})</div>
      {scheduledFuture.map(o=>{const items=o.order_items||o.items||[];const sc=ST_C[o.status];
        return(<div key={o.id} className="c" style={{padding:12,opacity:0.7}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div><div style={{fontWeight:700,fontSize:14}}>{o.customer}</div>
              <div style={{fontSize:11,color:"var(--t3)"}}>{items.map(it=>{const r=recs.find(x=>x.id===it.recipe_id);return r?`${r.name} ×${it.quantity||it.qty||1}`:"";}).filter(Boolean).join(", ")}</div>
            </div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700}}>${fi(o.total)}</div><span className="badge" style={{background:sc?.bg,color:sc?.tx}}>{ST_L[o.status]}</span></div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <DeliveryBadge date={o.delivery_date}/>
            <span style={{fontSize:11,color:"var(--t3)"}}>{o.phone||""}</span>
          </div>
        </div>);
      })}</>}
      {scheduled.length===0&&scheduledFuture.length===0&&<div className="c"><div className="empty"><div className="eic">📅</div><div>No hay pedidos programados</div></div></div>}
    </div></div>}
    {showH&&<div className="po"><div className="ph"><button onClick={()=>{setShowH(false);setHistPage(1);}}>{I.back({})}</button><h2>Historial ({hist.length})</h2></div><div className="pb">
      {hist.length===0?<div className="c"><div className="empty"><div className="eic">📜</div><div>Sin historial</div></div></div>
      :<>{histGrouped.map(([d,os])=>(<div key={d}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--t3)",padding:"8px 0 4px"}}>{new Date(d+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</div>
        {os.map(o=>{const sc=ST_C[o.status];const items=o.order_items||o.items||[];return(<div key={o.id} className="c" style={{padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:700,fontSize:14}}>{o.customer}</div>
            <div style={{fontSize:11,color:"var(--t3)"}}>{items.map(it=>{const r=recs.find(x=>x.id===it.recipe_id);return r?`${r.name} ×${it.quantity||it.qty||1}`:"";}).filter(Boolean).join(", ")}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700}}>${fi(o.total)}</div><span className="badge" style={{background:sc?.bg,color:sc?.tx}}>{ST_L[o.status]}</span></div>
          </div></div>);})}
      </div>))}
      {histPaged.length<hist.length&&<button className="btn bs" style={{width:"100%",marginTop:12}} onClick={()=>setHistPage(p=>p+1)}>Cargar más ({hist.length-histPaged.length} restantes)</button>}
      </>}
    </div></div>}
  </>);
}

function OrdForm({recs,onClose,onSave}){
  const [cust,setCust]=useState("");const [ph,setPh]=useState("");const [note,setNote]=useState("");
  const [delivDate,setDelivDate]=useState("");
  const [items,setItems]=useState([{recipe_id:"",qty:1}]);
  const add=()=>setItems(p=>[...p,{recipe_id:"",qty:1}]);
  const upd=(i,k,v)=>setItems(p=>p.map((x,j)=>j===i?{...x,[k]:v}:x));
  const rm=i=>setItems(p=>p.filter((_,j)=>j!==i));
  const tot=items.reduce((s,it)=>{const r=recs.find(x=>x.id===it.recipe_id);return s+(r?(r.sale_price||0)*it.qty:0);},0);
  const ok=cust&&items.some(it=>it.recipe_id&&it.qty>0);
  const todayStr=td();

  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>Nuevo Pedido</h2></div><div className="pb">
    <div className="fg"><label className="fl">Cliente</label><input className="fin" value={cust} onChange={e=>setCust(e.target.value)} placeholder="Nombre"/></div>
    <div className="fr"><div className="fg"><label className="fl">Teléfono</label><input className="fin" value={ph} onChange={e=>setPh(e.target.value)}/></div>
    <div className="fg"><label className="fl">Nota</label><input className="fin" value={note} onChange={e=>setNote(e.target.value)}/></div></div>
    <div className="fg"><label className="fl">📅 Fecha de entrega</label><input className="fin" type="date" value={delivDate} min={todayStr} onChange={e=>setDelivDate(e.target.value)} style={{colorScheme:"light"}}/></div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"4px 0 12px"}}><label className="fl" style={{margin:0}}>Productos</label><button className="btn bp bsm" onClick={add}>{I.plus({size:14})} Producto</button></div>
    {items.map((it,i)=>{const r=recs.find(x=>x.id===it.recipe_id);return(<div key={i} className="c" style={{padding:10,marginBottom:8,position:"relative"}}>
      {items.length>1&&<button onClick={()=>rm(i)} style={{position:"absolute",top:6,right:6,background:"none",border:"none",cursor:"pointer",color:"var(--rd)"}}>{I.x({size:14})}</button>}
      <div className="fg" style={{marginBottom:6}}><select className="fin" value={it.recipe_id} onChange={e=>upd(i,"recipe_id",e.target.value)}><option value="">Seleccionar...</option>{recs.filter(r2=>r2.visible!==false&&!r2.is_archived).map(r2=><option key={r2.id} value={r2.id}>{r2.name} — ${fi(r2.sale_price)}</option>)}</select></div>
      <div className="fr"><div className="fg" style={{marginBottom:0}}><label className="fl">Cant.</label><input className="fin" type="number" min="1" value={it.qty} onChange={e=>upd(i,"qty",Number(e.target.value))}/></div>
      {r&&<div className="fg" style={{marginBottom:0}}><label className="fl">Sub</label><div style={{padding:"12px 0",fontWeight:700}}>${fi((r.sale_price||0)*it.qty)}</div></div>}</div>
    </div>);})}
    {tot>0&&<div className="c" style={{background:"var(--al)",textAlign:"center",marginTop:8}}><div style={{fontSize:12,fontWeight:600,color:"var(--ac)"}}>TOTAL</div><div style={{fontSize:28,fontWeight:700,fontFamily:"'DM Serif Display',serif",color:"var(--ac)"}}>${fi(tot)}</div></div>}
    <button className="btn bp" style={{marginTop:16}} disabled={!ok} onClick={()=>{if(!ok)return;
      const f=items.filter(it=>it.recipe_id&&it.qty>0).map(it=>{const r=recs.find(x=>x.id===it.recipe_id);return{recipe_id:it.recipe_id,quantity:it.qty,unit_price:r?.sale_price||0,subtotal:(r?.sale_price||0)*it.qty};});
      onSave({id:uid(),customer:cust,phone:ph,note,delivery_date:delivDate||null,order_items:f,items:f,total:f.reduce((s,it)=>s+it.subtotal,0),status:ST.new,date:td(),created_at:new Date().toISOString()});
    }}>{I.check({size:18,color:"#fff"})} Crear</button>
  </div></div>);
}

export default Orders;
export { DeliveryBadge };