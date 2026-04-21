import { Icon } from "../../lib/utils";

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
      <div style={{width:40,height:40,borderRadius:10,background:"var(--rl)",display:"flex",alignItems:"center",justifyContent:"center"}}>{Icon.alert({size:20,color:"var(--rd)"})}</div>
      <div><div style={{fontWeight:700,fontSize:16}}>Cancelar pedido</div><div style={{fontSize:12,color:"var(--t3)"}}>de {order.customer}</div></div>
    </div>
    <div style={{fontSize:14,color:"var(--t2)",marginBottom:12}}>Los insumos ya fueron descontados. ¿Qué hacemos?</div>
    {used.length>0&&<div className="c" style={{padding:"8px 12px",marginBottom:16,background:"var(--b2)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>Insumos usados</div>
      {used.map(ig=>(<div key={ig.id} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:13}}><span>{ig.name}</span><span style={{fontWeight:600}}>{ig.qty} {ig.unit}</span></div>))}
    </div>}
    <button className="btn bgn" style={{marginBottom:8}} onClick={()=>onConfirm(true)}>{Icon.back({size:16,color:"#fff"})} Devolver al stock</button>
    <button className="btn bd" style={{marginBottom:8}} onClick={()=>onConfirm(false)}>{Icon.trash({size:16})} Registrar desperdicio</button>
    <button className="btn bs" onClick={onClose}>Volver</button>
  </div></div>);
}

function StockWarningDlg({deficits,onForce,onClose}){
  return(<div className="modal"><div className="modal-c">
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
      <div style={{width:40,height:40,borderRadius:10,background:"#FFF8E1",display:"flex",alignItems:"center",justifyContent:"center"}}>{Icon.alert({size:20,color:"var(--yw)"})}</div>
      <div><div style={{fontWeight:700,fontSize:16}}>Stock insuficiente</div><div style={{fontSize:12,color:"var(--t3)"}}>Algunos insumos quedarán en negativo</div></div>
    </div>
    <div className="c" style={{padding:"8px 12px",marginBottom:16,background:"var(--b2)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>Insumos con déficit</div>
      {deficits.map((d,i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13,borderBottom:"1px solid var(--b2)"}}>
          <span style={{fontWeight:600}}>{d.name}</span>
          <span style={{color:"var(--rd)",fontWeight:700}}>Stock: {d.current} → <strong>{d.after}</strong> {d.unit}</span>
        </div>
      ))}
    </div>
    <div style={{fontSize:13,color:"var(--t3)",marginBottom:16}}>Podés forzar la preparación igualmente. El stock quedará en negativo hasta que registres una compra.</div>
    <button className="btn byw" style={{marginBottom:8}} onClick={onForce}>⚠️ Forzar preparación de todas formas</button>
    <button className="btn bs" onClick={onClose}>Cancelar</button>
  </div></div>);
}

function NewOrderOverlay({count,onAck}){
  return(
    <div onClick={onAck} style={{
      position:"fixed",inset:0,zIndex:9999,
      background:"var(--ac,#C45D3E)",
      display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",
      cursor:"pointer",userSelect:"none",
      padding:32,textAlign:"center"
    }}>
      <div style={{fontSize:80,marginBottom:16,animation:"bounce 0.6s infinite alternate"}}>🦆</div>
      <div style={{fontSize:48,fontWeight:900,color:"#fff",lineHeight:1.1,marginBottom:12,textShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
        ¡{count} PEDIDO{count!==1?"S":""} NUEVO{count!==1?"S":""}!
      </div>
      <div style={{fontSize:18,color:"rgba(255,255,255,0.85)",marginBottom:32,fontWeight:500}}>
        Tocá en cualquier lugar para ver
      </div>
      <div style={{
        background:"rgba(255,255,255,0.25)",
        border:"2px solid rgba(255,255,255,0.6)",
        borderRadius:40,padding:"14px 36px",
        fontSize:18,fontWeight:700,color:"#fff",
        backdropFilter:"blur(4px)"
      }}>
        Ver pedidos →
      </div>
    </div>
  );
}

export { CancelDlg, StockWarningDlg, NewOrderOverlay };
