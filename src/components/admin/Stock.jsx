import { useState } from "react";
import { Icon, formatInt, formatMoney } from "../../lib/utils";
import { upsertIngredient, deleteIngredient, registerWaste } from "../../lib/adminService";
import CatChipsEditor from "../ui/CatChipsEditor";

const DEFAULT_SETTINGS={ing_cats:["Secos","Frescos","Packaging","Otros"]};

function Stock({ingredients,setIngredients,recipes,overlay,setOverlay,showToast,settings,setSettings,loadAll}){
  const [sr,setSr]=useState("");const [fil,setFil]=useState("all");
  const cats=[...new Set(ingredients.map(i=>i.category).filter(Boolean))];
  const filt=ingredients.filter(i=>{
    const ms=i.name?.toLowerCase().includes(sr.toLowerCase());
    const mf=fil==="all"||fil==="lowStockIngredients"?true:i.category===fil;
    const ml=fil==="lowStockIngredients"?(i.stock||0)<=(i.min_stock||0):true;
    return ms&&mf&&ml;
  });
  const tI=ingredients.reduce((s,i)=>s+(i.cost||0)*(i.stock||0),0);

  return(<>
    <div className="s"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div className="st" style={{margin:0}}>Inventario</div>
      <div style={{fontSize:12,color:"var(--t3)"}}>Inv: <strong>${formatInt(tI)}</strong></div>
    </div></div>
    <div className="sb">{Icon.search({size:16})}<input className="fin" placeholder="Buscar..." value={sr} onChange={e=>setSr(e.target.value)}/></div>
    {settings&&setSettings&&<div style={{padding:"0 16px"}}>
      <CatChipsEditor settings={settings} setSettings={setSettings} field="ing_cats" label="Categorías de insumos" icon="📦" showToast={showToast}/>
    </div>}
    <div className="tabs">
      <button className={`tab ${fil==="all"?"on":""}`} onClick={()=>setFil("all")}>Todos</button>
      <button className={`tab ${fil==="lowStockIngredients"?"on":""}`} onClick={()=>setFil("lowStockIngredients")}>Bajo</button>
      {cats.slice(0,2).map(c=><button key={c} className={`tab ${fil===c?"on":""}`} onClick={()=>setFil(c)}>{c}</button>)}
    </div>
    <div className="s"><div className="c" style={{padding:0,overflow:"hidden"}}>
      {filt.length===0?<div className="empty"><div className="eic">📦</div><div>Vacío</div></div>
      :filt.map(it=>(<div key={it.id} className="li" onClick={()=>setOverlay({type:"editIng",data:it})}>
        <div className="lic" style={{background:(it.stock||0)<=(it.min_stock||0)?((it.stock||0)<=0?"var(--rl)":"var(--yl)"):"var(--gl)",color:(it.stock||0)<=(it.min_stock||0)?((it.stock||0)<=0?"var(--rd)":"var(--yw)"):"var(--gn)"}}>
          {(it.stock||0)<=(it.min_stock||0)?Icon.alert({size:16}):Icon.check({size:16})}
        </div>
        <div className="lii"><div className="lin">{it.name}</div><div className="lid">{it.category||""} · ${formatMoney(it.cost||0)}/{it.unit}</div></div>
        <div className="lir"><div className="lia">{it.stock||0} {it.unit}</div><div className="lid">min: {it.min_stock||0}</div></div>
      </div>))}
    </div></div>
    <div style={{display:"flex",gap:8,padding:"0 16px 16px"}}>
      <button className="btn bs" style={{flex:1,fontSize:13}} onClick={()=>setOverlay({type:"waste"})}>⚠️ Registrar Merma</button>
    </div>
    <button className="fab" onClick={()=>setOverlay({type:"editIng",data:null})}>{Icon.plus({size:24,color:"#fff"})}</button>
    {overlay?.type==="editIng"&&<IngForm data={overlay.data} settings={settings} onClose={()=>setOverlay(null)} onSave={async(it)=>{
      const saved=await upsertIngredient(it);
      if(saved?.__error){showToast("Error: "+saved.__error);return;}
      if(saved){if(it.id)setIngredients(p=>p.map(i=>i.id===it.id?saved:i));else setIngredients(p=>[...p,saved]);setOverlay(null);showToast(it.id?"Actualizado":"Agregado");}
      else{showToast("Error al guardar insumo");}
    }} onDel={async(id)=>{
      const usedIn=(recipes||[]).filter(r=>(r.ingredients||[]).some(ri=>ri.ingredient_id===id));
      if(usedIn.length>0){showToast(`No se puede eliminar: está en uso en "${usedIn.map(r=>r.name).join(", ")}"`);return;}
      await deleteIngredient(id);setIngredients(p=>p.filter(i=>i.id!==id));setOverlay(null);showToast("Eliminado");
    }}/>}
    {overlay?.type==="waste"&&<WasteForm ingredients={ingredients} setIngredients={setIngredients} showToast={showToast} onClose={()=>setOverlay(null)}/>}
  </>);
}

function WasteForm({ingredients,setIngredients,showToast,onClose}){
  const [ingId,setIngId]=useState("");const [qty,setQty]=useState("");const [reason,setReason]=useState("vencimiento");const [note,setNote]=useState("");const [saving,setSaving]=useState(false);
  const reasons=["vencimiento","rotura","prueba","derrame","otro"];
  const save=async()=>{
    if(!ingId||!qty||Number(qty)<=0)return;
    setSaving(true);
    const ok=await registerWaste(ingId,Number(qty),reason,note);
    setSaving(false);
    if(ok){
      setIngredients(p=>p.map(i=>i.id===ingId?{...i,stock:Math.max(0,(i.stock||0)-Number(qty))}:i));
      showToast(`Merma registrada: ${Number(qty)} ${ingredients.find(x=>x.id===ingId)?.unit||""}`);
      onClose();
    }
  };
  const ing=ingredients.find(x=>x.id===ingId);
  return(<div className="po"><div className="ph"><button onClick={onClose}>{Icon.back({})}</button><h2>Registrar Merma</h2></div><div className="pb">
    <div className="waste-banner">⚠️ Este ajuste descuenta stock sin generar una venta. Usá esto para vencimientos, roturas y pruebas.</div>
    <div className="fg"><label className="fl">Insumo</label>
      <select className="fin" value={ingId} onChange={e=>setIngId(e.target.value)}>
        <option value="">Seleccionar insumo...</option>
        {ingredients.map(i=><option key={i.id} value={i.id}>{i.name} (Stock: {i.stock||0} {i.unit})</option>)}
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

function IngForm({data,onClose,onSave,onDel,settings}){
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
  return(<div className="po"><div className="ph"><button onClick={onClose}>{Icon.back({})}</button><h2>{data?"Editar":"Nuevo"} Insumo</h2>
    {data&&<button onClick={()=>onDel(data.id)} style={{color:"var(--rd)"}}>{Icon.trash({})}</button>}
  </div><div className="pb">
    <div className="fg"><label className="fl">Nombre</label><input className="fin" value={f.name} onChange={e=>s("name",e.target.value)}/></div>
    <div className="fr"><div className="fg"><label className="fl">Unidad</label><select className="fin" value={f.unit} onChange={e=>s("unit",e.target.value)}>{["kg","g","lt","ml","uni"].map(u=><option key={u}>{u}</option>)}</select></div>
    <div className="fg"><label className="fl">Cat.</label><select className="fin" value={f.category||""} onChange={e=>s("category",e.target.value)}>{(settings?.ing_cats||DEFAULT_SETTINGS.ing_cats).map(c=><option key={c}>{c}</option>)}</select></div></div>
    <div className="fg"><label className="fl">Costo/{f.unit}</label><input className="fin" type="number" min="0.01" step="0.01" value={f.cost||""} onChange={e=>s("cost",Math.max(0,Number(e.target.value)))}/></div>
    <div className="fr"><div className="fg"><label className="fl">Stock</label><input className="fin" type="number" min="0" step="0.001" value={f.stock||""} onChange={e=>s("stock",Math.max(0,Number(e.target.value)))}/></div>
    <div className="fg"><label className="fl">Mín</label><input className="fin" type="number" min="0" step="0.001" value={f.min_stock||""} onChange={e=>s("min_stock",Math.max(0,Number(e.target.value)))} /></div></div>
    {err&&<div style={{background:"#FFEBEE",color:"var(--rd)",fontSize:13,padding:"8px 12px",borderRadius:8,marginBottom:8}}>⚠️ {err}</div>}
    <button className="btn bp" style={{marginTop:8}} disabled={!canSave} onClick={handleSave}>
      {data?"Guardar Cambios":"Agregar Insumo"}
    </button>
  </div></div>);
}

export default Stock;