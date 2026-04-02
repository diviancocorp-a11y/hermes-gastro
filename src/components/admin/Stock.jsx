import { useState } from "react";
import { I, fi, fm } from "../../lib/utils";
import { upsertIngredient, deleteIngredient, registerWaste } from "../../lib/adminService";

const DEF={ing_cats:["Secos","Frescos","Packaging","Otros"]};

function Stock({ings,setIngs,recs,ov,setOv,msg,sett,loadAll}){
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
    }} onDel={async(id)=>{
      const usedIn=(recs||[]).filter(r=>(r.ingredients||[]).some(ri=>ri.ingredient_id===id));
      if(usedIn.length>0){msg(`No se puede eliminar: está en uso en "${usedIn.map(r=>r.name).join(", ")}"`);return;}
      await deleteIngredient(id);setIngs(p=>p.filter(i=>i.id!==id));setOv(null);msg("Eliminado");
    }}/>}
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
  const [err,setErr]=useState("");
  const s=(k,v)=>{setErr("");setF(p=>({...p,[k]:v}));};
  const canSave=f.name&&(f.cost||0)>0&&(f.stock||0)>=0;
  const handleSave=()=>{
    if(!f.name){setErr("El nombre es obligatorio.");return;}
    if((f.cost||0)<=0){setErr("El costo debe ser mayor a 0.");return;}
    if((f.stock||0)<0){setErr("El stock no puede ser negativo.");return;}
    onSave(f);
  };
  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>{data?"Editar":"Nuevo"} Insumo</h2>
    {data&&<button onClick={()=>onDel(data.id)} style={{color:"var(--rd)"}}>{I.trash({})}</button>}
  </div><div className="pb">
    <div className="fg"><label className="fl">Nombre</label><input className="fin" value={f.name} onChange={e=>s("name",e.target.value)}/></div>
    <div className="fr"><div className="fg"><label className="fl">Unidad</label><select className="fin" value={f.unit} onChange={e=>s("unit",e.target.value)}>{["kg","g","lt","ml","uni"].map(u=><option key={u}>{u}</option>)}</select></div>
    <div className="fg"><label className="fl">Cat.</label><select className="fin" value={f.category||""} onChange={e=>s("category",e.target.value)}>{(sett?.ing_cats||DEF.ing_cats).map(c=><option key={c}>{c}</option>)}</select></div></div>
    <div className="fg"><label className="fl">Costo/{f.unit}</label><input className="fin" type="number" min="0.01" step="0.01" value={f.cost||""} onChange={e=>s("cost",Math.max(0,Number(e.target.value)))}/></div>
    <div className="fr"><div className="fg"><label className="fl">Stock</label><input className="fin" type="number" min="0" step="0.001" value={f.stock||""} onChange={e=>s("stock",Math.max(0,Number(e.target.value)))}/></div>
    <div className="fg"><label className="fl">Mín</label><input className="fin" type="number" min="0" step="0.001" value={f.min_stock||""} onChange={e=>s("min_stock",Math.max(0,Number(e.target.value)))} /></div></div>
    {err&&<div style={{background:"#FFEBEE",color:"var(--rd)",fontSize:13,padding:"8px 12px",borderRadius:8,marginBottom:8}}>⚠️ {err}</div>}
    <button className="btn bp" style={{marginTop:8}} disabled={!canSave} onClick={handleSave}>{I.check({size:18,color:"#fff"})} {data?"Guardar":"Agregar"}</button>
  </div></div>);
}

export default Stock;
