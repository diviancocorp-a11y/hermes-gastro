import { useState, useMemo } from "react";
import { Icon, formatInt, todayISO, generateId, OrderStatus, OrderStatusLabels, OrderStatusColors, OrderStatusBorders, formatOrderCode } from "../../lib/utils";
import { verifyReceipt, getReceiptUrl } from "../../lib/adminService";

function DeliveryBadge({date}){
  if(!date)return null;
  const today=todayISO();
  const tom=new Date();tom.setDate(tom.getDate()+1);const tomStr=tom.toISOString().split("T")[0];
  const past=date<today;
  const label=date===today?"🔴 Para HOY":date===tomStr?"🟡 Para MAÑANA":past?`⚠️ Vencido ${new Date(date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"})}`:`📅 Para el ${new Date(date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"})}`;
  const bg=past?"var(--rl)":date===today?"var(--rl)":date===tomStr?"var(--yl)":"var(--b2)";
  const co=past?"var(--rd)":date===today?"var(--rd)":date===tomStr?"var(--yw)":"var(--t3)";
  return(<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8,background:bg,color:co}}>{label}</span>);
}

function Orders({orders,recipes,moveOrderStatus,addOrder,overlay,setOverlay,showToast,settings,onUpdateOrder}){
  const [fil,setFil]=useState(OrderStatus.new);const [showH,setShowH]=useState(false);const [showSched,setShowSched]=useState(false);const t=todayISO();
  const [histPage,setHistPage]=useState(1);const HIST_PER_PAGE=20;
  const [viewReceipt,setViewReceipt]=useState(null); // order object to view receipt

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
  const scheduled=useMemo(()=>orders.filter(o=>o.delivery_date&&o.status!==OrderStatus.done&&o.status!==OrderStatus.cancel&&(o.delivery_date<=t)).sort((a,b)=>(a.delivery_date||"").localeCompare(b.delivery_date||"")),[orders,t]);
  // Programados futuros (para referencia)
  const scheduledFuture=useMemo(()=>orders.filter(o=>o.delivery_date&&o.status!==OrderStatus.done&&o.status!==OrderStatus.cancel&&o.delivery_date>t).sort((a,b)=>(a.delivery_date||"").localeCompare(b.delivery_date||"")),[orders,t]);

  // Counts: para "new" solo contar pedidos de hoy sin delivery_date
  const cts=useMemo(()=>{const c={};Object.values(OrderStatus).forEach(s=>{
    if(s===OrderStatus.new)c[s]=orders.filter(o=>o.status===s&&o.date===t&&!o.delivery_date).length;
    else if(s===OrderStatus.done||s===OrderStatus.cancel)c[s]=orders.filter(o=>o.status===s&&o.date===t).length;
    else c[s]=orders.filter(o=>o.status===s).length;
  });return c;},[orders,t]);

  // Filtrado: "new" = solo hoy sin delivery_date; "done"/"cancel" = solo hoy; resto = todos
  const filt=useMemo(()=>orders.filter(o=>{
    if(fil===OrderStatus.new)return o.status===fil&&o.date===t&&!o.delivery_date;
    if(fil===OrderStatus.done||fil===OrderStatus.cancel)return o.status===fil&&o.date===t;
    return o.status===fil;
  }).sort((a,b)=>(b.created_at||b.date||"").localeCompare(a.created_at||a.date||"")),[orders,fil,t]);
  const hist=useMemo(()=>orders.filter(o=>(o.status===OrderStatus.done||o.status===OrderStatus.cancel)&&o.date<t).sort((a,b)=>(b.created_at||b.date||"").localeCompare(a.created_at||a.date||"")),[orders,t]);
  const histPaged=useMemo(()=>hist.slice(0,histPage*HIST_PER_PAGE),[hist,histPage]);
  const histGrouped=useMemo(()=>Object.entries(histPaged.reduce((a,o)=>{const d=(o.created_at||o.date||"").split("T")[0];if(!a[d])a[d]=[];a[d].push(o);return a;},{})).sort((a,b)=>b[0].localeCompare(a[0])),[histPaged]);
  const nxt=s=>({[OrderStatus.new]:{l:"Preparar",c:"byw",i:Icon.fire,n:OrderStatus.prep},[OrderStatus.prep]:{l:"Marcar activo",c:"bgn",i:Icon.zap,n:OrderStatus.active},[OrderStatus.active]:{l:"Completar",c:"bbl",i:Icon.check,n:OrderStatus.done}}[s]||null);
  const sfs=[{id:OrderStatus.new,l:"Nuevos",i:Icon.orders,co:"var(--bl)"},{id:OrderStatus.prep,l:"Preparando",i:Icon.fire,co:"var(--yw)"},{id:OrderStatus.active,l:"Activos",i:Icon.zap,co:"var(--gn)"},{id:OrderStatus.done,l:"Listos",i:Icon.check,co:"var(--t3)"},{id:OrderStatus.cancel,l:"Cancel.",i:Icon.x,co:"var(--rd)"}];

  return(<>
    <div className="s"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div className="st" style={{margin:0}}>Pedidos</div><div style={{display:"flex",gap:6}}>
      <button className="btn bs bsm" onClick={()=>setShowSched(true)}>📅 Programados{(scheduled.length+scheduledFuture.length)>0&&<span style={{marginLeft:4,background:"var(--yl)",color:"var(--yw)",borderRadius:8,padding:"0 5px",fontSize:11,fontWeight:700}}>{scheduled.length+scheduledFuture.length}</span>}</button>
      <button className="btn bs bsm" onClick={()=>setShowH(true)}>{Icon.hist({size:14})} Historial</button>
    </div></div></div>
    <div className="sf">{sfs.map(sf=>(<button key={sf.id} className={`sfi ${fil===sf.id?"on":""}`} style={{color:fil===sf.id?sf.co:"var(--t3)",borderColor:fil===sf.id?sf.co:"var(--b2)"}} onClick={()=>setFil(sf.id)}>
      {sf.i({size:14,color:fil===sf.id?sf.co:"var(--t3)"})}{sf.l}{cts[sf.id]>0&&<span className="sfc" style={{background:sf.co+"20",color:sf.co}}>{cts[sf.id]}</span>}
    </button>))}</div>
    <div className="s">
      {filt.length===0?<div className="c"><div className="empty"><div className="eic">{fil===OrderStatus.new?"📋":fil===OrderStatus.prep?"👨‍🍳":fil===OrderStatus.active?"⚡":"✓"}</div><div>No hay pedidos {OrderStatusLabels[fil]?.toLowerCase()}</div></div></div>
      :filt.map(o=>{const act=nxt(o.status);const sc=OrderStatusColors[o.status];const items=o.order_items||o.items||[];
        return(<div key={o.id} className="ocard" style={{borderLeftColor:OrderStatusBorders[o.status]}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700,fontSize:15}}>{o.customer}</span><span style={{fontSize:10,fontWeight:700,color:"var(--t3)",background:"var(--b2)",padding:"1px 6px",borderRadius:6}}>{formatOrderCode(o.id)}</span></div>
              <div style={{fontSize:12,color:"var(--t3)"}}>{new Date(o.created_at||o.date).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}
                {o.phone&&` · ${o.phone}`}{o.delivery&&` · ${o.delivery==="envio"?"Envío":"Retiro"}`}{o.payment&&` · ${o.payment}`}
              </div></div>
            <span className="badge" style={{background:sc?.bg,color:sc?.tx}}>{OrderStatusLabels[o.status]}</span>
          </div>
          {items.map((it,i)=>{const r=recipes.find(x=>x.id===it.recipe_id);return(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:13}}><span>{r?.name||"?"} × {it.quantity||it.qty||1}</span><span style={{fontWeight:600}}>${formatInt((it.quantity||it.qty||1)*(it.unit_price||0))}</span></div>);})}
          {o.delivery_date&&<div style={{marginTop:6}}><DeliveryBadge date={o.delivery_date}/></div>}
          {o.is_gift&&<div style={{fontSize:12,color:"var(--ac)",fontWeight:600,marginTop:4,padding:"4px 8px",background:"var(--al)",borderRadius:6}}>🎁 Pedido regalo{o.gift_note?`: "${o.gift_note}"`:""}</div>}
          {o.note&&<div style={{fontSize:12,color:"var(--t3)",fontStyle:"italic",marginTop:4,padding:"4px 8px",background:"var(--b2)",borderRadius:6}}>💬 {o.note}</div>}
          {/* Comprobante de pago */}
          {o.receipt_url && (
            <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}}>
              {o.receipt_verified ? (
                <span style={{fontSize:12,fontWeight:700,color:"var(--gn,#3A7D44)",padding:"4px 10px",background:"#E8F5E9",borderRadius:8}}>✓ Comprobante verificado</span>
              ) : (
                <>
                  <span style={{fontSize:12,fontWeight:700,color:"#E65100",padding:"4px 10px",background:"#FFF3E0",borderRadius:8,animation:"pulse 2s infinite"}}>📎 Comprobante pendiente</span>
                  <button onClick={()=>setViewReceipt(o)} style={{fontSize:12,fontWeight:700,color:"#fff",background:"var(--ac)",border:"none",borderRadius:8,padding:"4px 12px",cursor:"pointer"}}>Ver y verificar</button>
                </>
              )}
            </div>
          )}
          {(o.payment==="transferencia"||o.payment==="mercadopago")&&!o.receipt_url && (
            <div style={{marginTop:6}}><span style={{fontSize:11,fontWeight:600,color:"var(--rd)",padding:"3px 8px",background:"#FFEBEE",borderRadius:6}}>⚠ Sin comprobante</span></div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 0",borderTop:"1px solid var(--b2)",marginTop:8,fontWeight:700,fontSize:16}}><span>Total</span><span>${formatInt(o.total)}</span></div>
          {act&&<div className="oa">{o.status!==OrderStatus.done&&o.status!==OrderStatus.cancel&&<button className="btn bd" onClick={()=>moveOrderStatus(o.id,OrderStatus.cancel)}>{Icon.x({size:14})} Cancelar</button>}<button className={`btn ${act.c}`} onClick={()=>{moveOrderStatus(o.id,act.n);setFil(act.n);}}>{act.i({size:14,color:"#fff"})} {act.l}</button></div>}
        </div>);
      })}
    </div>
    <button className="fab" onClick={()=>setOverlay({type:"addOrder"})}>{Icon.plus({size:24,color:"#fff"})}</button>
    {overlay?.type==="addOrder"&&<OrdForm recipes={recipes} onClose={()=>setOverlay(null)} onSave={o=>{addOrder(o);setOverlay(null);}}/>}
    {showSched&&<div className="po"><div className="ph"><button onClick={()=>setShowSched(false)}>{Icon.back({})}</button><h2>📅 Programados</h2></div><div className="pb">
      {!storeIsOpen&&scheduled.length>0&&<div className="ab" style={{margin:"0 0 12px",background:"var(--yl)",color:"var(--yw)"}}>El local está cerrado · Los programados de hoy se activan al abrir</div>}
      {scheduled.length>0&&<><div style={{fontSize:12,fontWeight:700,color:"var(--ac)",marginBottom:8}}>Para hoy ({scheduled.length})</div>
      {scheduled.map(o=>{const items=o.order_items||o.items||[];const sc=OrderStatusColors[o.status];
        return(<div key={o.id} className="c" style={{padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div><div style={{fontWeight:700,fontSize:14}}>{o.customer}</div>
              <div style={{fontSize:11,color:"var(--t3)"}}>{items.map(it=>{const r=recipes.find(x=>x.id===it.recipe_id);return r?`${r.name} ×${it.quantity||it.qty||1}`:"";}).filter(Boolean).join(", ")}</div>
              {o.note&&<div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>💬 {o.note}</div>}
            </div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700}}>${formatInt(o.total)}</div><span className="badge" style={{background:sc?.bg,color:sc?.tx}}>{OrderStatusLabels[o.status]}</span></div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <DeliveryBadge date={o.delivery_date}/>
            <span style={{fontSize:11,color:"var(--t3)"}}>{o.phone||""}</span>
          </div>
        </div>);
      })}</>}
      {scheduledFuture.length>0&&<><div style={{fontSize:12,fontWeight:700,color:"var(--t3)",marginBottom:8,marginTop:scheduled.length>0?16:0}}>Próximos días ({scheduledFuture.length})</div>
      {scheduledFuture.map(o=>{const items=o.order_items||o.items||[];const sc=OrderStatusColors[o.status];
        return(<div key={o.id} className="c" style={{padding:12,opacity:0.7}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div><div style={{fontWeight:700,fontSize:14}}>{o.customer}</div>
              <div style={{fontSize:11,color:"var(--t3)"}}>{items.map(it=>{const r=recipes.find(x=>x.id===it.recipe_id);return r?`${r.name} ×${it.quantity||it.qty||1}`:"";}).filter(Boolean).join(", ")}</div>
            </div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700}}>${formatInt(o.total)}</div><span className="badge" style={{background:sc?.bg,color:sc?.tx}}>{OrderStatusLabels[o.status]}</span></div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <DeliveryBadge date={o.delivery_date}/>
            <span style={{fontSize:11,color:"var(--t3)"}}>{o.phone||""}</span>
          </div>
        </div>);
      })}</>}
      {scheduled.length===0&&scheduledFuture.length===0&&<div className="c"><div className="empty"><div className="eic">📅</div><div>No hay pedidos programados</div></div></div>}
    </div></div>}
    {showH&&<div className="po"><div className="ph"><button onClick={()=>{setShowH(false);setHistPage(1);}}>{Icon.back({})}</button><h2>Historial ({hist.length})</h2></div><div className="pb">
      {hist.length===0?<div className="c"><div className="empty"><div className="eic">📜</div><div>Sin historial</div></div></div>
      :<>{histGrouped.map(([d,os])=>(<div key={d}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--t3)",padding:"8px 0 4px"}}>{new Date(d+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</div>
        {os.map(o=>{const sc=OrderStatusColors[o.status];const items=o.order_items||o.items||[];return(<div key={o.id} className="c" style={{padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:700,fontSize:14}}>{o.customer}</div>
            <div style={{fontSize:11,color:"var(--t3)"}}>{items.map(it=>{const r=recipes.find(x=>x.id===it.recipe_id);return r?`${r.name} ×${it.quantity||it.qty||1}`:"";}).filter(Boolean).join(", ")}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700}}>${formatInt(o.total)}</div><span className="badge" style={{background:sc?.bg,color:sc?.tx}}>{OrderStatusLabels[o.status]}</span></div>
          </div></div>);})}
      </div>))}
      {histPaged.length<hist.length&&<button className="btn bs" style={{width:"100%",marginTop:12}} onClick={()=>setHistPage(p=>p+1)}>Cargar más ({hist.length-histPaged.length} restantes)</button>}
      </>}
    </div></div>}

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
              isImg ? <img src={url} alt="Comprobante" style={{maxWidth:"100%",maxHeight:"60vh",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}} />
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

function OrdForm({recipes,onClose,onSave}){
  const [cust,setCust]=useState("");const [ph,setPh]=useState("");const [note,setNote]=useState("");
  const [delivDate,setDelivDate]=useState("");
  const [items,setItems]=useState([{recipe_id:"",qty:1}]);
  const add=()=>setItems(p=>[...p,{recipe_id:"",qty:1}]);
  const upd=(i,k,v)=>setItems(p=>p.map((x,j)=>j===i?{...x,[k]:v}:x));
  const rm=i=>setItems(p=>p.filter((_,j)=>j!==i));
  const tot=items.reduce((s,it)=>{const r=recipes.find(x=>x.id===it.recipe_id);return s+(r?(r.sale_price||0)*it.qty:0);},0);
  const ok=cust&&items.some(it=>it.recipe_id&&it.qty>0);
  const todayStr=todayISO();

  return(<div className="po"><div className="ph"><button onClick={onClose}>{Icon.back({})}</button><h2>Nuevo Pedido</h2></div><div className="pb">
    <div className="fg"><label className="fl">Cliente</label><input className="fin" value={cust} onChange={e=>setCust(e.target.value)} placeholder="Nombre"/></div>
    <div className="fr"><div className="fg"><label className="fl">Teléfono</label><input className="fin" value={ph} onChange={e=>setPh(e.target.value)}/></div>
    <div className="fg"><label className="fl">Nota</label><input className="fin" value={note} onChange={e=>setNote(e.target.value)}/></div></div>
    <div className="fg"><label className="fl">📅 Fecha de entrega</label><input className="fin" type="date" value={delivDate} min={todayStr} onChange={e=>setDelivDate(e.target.value)} style={{colorScheme:"light"}}/></div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"4px 0 12px"}}><label className="fl" style={{margin:0}}>Productos</label><button className="btn bp bsm" onClick={add}>{Icon.plus({size:14})} Producto</button></div>
    {items.map((it,i)=>{const r=recipes.find(x=>x.id===it.recipe_id);return(<div key={i} className="c" style={{padding:10,marginBottom:8,position:"relative"}}>
      {items.length>1&&<button onClick={()=>rm(i)} style={{position:"absolute",top:6,right:6,background:"none",border:"none",cursor:"pointer",color:"var(--rd)"}}>{Icon.x({size:14})}</button>}
      <div className="fg" style={{marginBottom:6}}><select className="fin" value={it.recipe_id} onChange={e=>upd(i,"recipe_id",e.target.value)}><option value="">Seleccionar...</option>{recipes.filter(r2=>r2.visible!==false&&!r2.is_archived).map(r2=><option key={r2.id} value={r2.id}>{r2.name} — ${formatInt(r2.sale_price)}</option>)}</select></div>
      <div className="fr"><div className="fg" style={{marginBottom:0}}><label className="fl">Cant.</label><input className="fin" type="number" min="1" value={it.qty} onChange={e=>upd(i,"qty",Number(e.target.value))}/></div>
      {r&&<div className="fg" style={{marginBottom:0}}><label className="fl">Sub</label><div style={{padding:"12px 0",fontWeight:700}}>${formatInt((r.sale_price||0)*it.qty)}</div></div>}</div>
    </div>);})}
    {tot>0&&<div className="c" style={{background:"var(--al)",textAlign:"center",marginTop:8}}><div style={{fontSize:12,fontWeight:600,color:"var(--ac)"}}>TOTAL</div><div style={{fontSize:28,fontWeight:700,fontFamily:"'DM Serif Display',serif",color:"var(--ac)"}}>${formatInt(tot)}</div></div>}
    <button className="btn bp" style={{marginTop:16}} disabled={!ok} onClick={()=>{if(!ok)return;
      const f=items.filter(it=>it.recipe_id&&it.qty>0).map(it=>{const r=recipes.find(x=>x.id===it.recipe_id);return{recipe_id:it.recipe_id,quantity:it.qty,unit_price:r?.sale_price||0,subtotal:(r?.sale_price||0)*it.qty};});
      onSave({id:generateId(),customer:cust,phone:ph,note,delivery_date:delivDate||null,order_items:f,items:f,total:f.reduce((s,it)=>s+it.subtotal,0),status:OrderStatus.new,date:todayISO(),created_at:new Date().toISOString()});
    }}>{Icon.check({size:18,color:"#fff"})} Crear</button>
  </div></div>);
}

export default Orders;
export { DeliveryBadge };