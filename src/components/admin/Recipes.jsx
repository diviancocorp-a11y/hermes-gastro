import { useState, useRef } from "react";
import { I, fi, fm } from "../../lib/utils";
import {
  fetchRecipeIngredients,
  fetchAllRecipeIngredients,
  saveRecipeIngredients,
  fetchComboItems,
  saveComboItems,
  upsertRecipe,
  toggleRecipeVisibility,
  archiveRecipe,
  unarchiveRecipe,
  uploadRecipeImage,
} from "../../lib/adminService";

function Recipes({recs,setRecs,ings,rc,ov,setOv,msg,loadAll}){
  const [sr,setSr]=useState("");
  const [showArchived,setShowArchived]=useState(false);
  const active=recs.filter(r=>!r.is_archived);
  const archived=recs.filter(r=>r.is_archived);
  const base=showArchived?archived:active;
  const filt=base.filter(r=>r.name?.toLowerCase().includes(sr.toLowerCase()));

  return(<>
    <div className="s"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div className="st" style={{margin:0}}>Recetas</div>
      {archived.length>0&&<button className="btn bs bsm" onClick={()=>setShowArchived(p=>!p)} style={{color:showArchived?"var(--ac)":"var(--t3)",borderColor:showArchived?"var(--ac)":"var(--b2)"}}>
        📦 Archivadas ({archived.length})
      </button>}
    </div></div>
    <div className="sb">{I.search({size:16})}<input className="fin" placeholder="Buscar..." value={sr} onChange={e=>setSr(e.target.value)}/></div>
    {showArchived&&<div className="ab" style={{margin:"0 16px 8px",background:"var(--yl)",color:"var(--yw)"}}>Mostrando recetas archivadas · No aparecen en el catálogo</div>}
    <div className="s">
      {filt.length===0?<div className="c"><div className="empty"><div className="eic">📋</div><div>{showArchived?"Sin recetas archivadas":"Sin recetas"}</div></div></div>
      :filt.map(r=>{
        const c=rc(r);const m=r.sale_price>0?((r.sale_price-c)/r.sale_price*100):0;
        const bc=m>=50?"var(--gn)":m>=30?"var(--yw)":"var(--rd)";
        return(<div key={r.id} className="c" style={{opacity:r.is_archived?0.6:1}} onClick={()=>setOv({type:"viewR",data:r})}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <div><div style={{fontWeight:700,fontSize:15}}>{r.name}{r.is_archived&&<span style={{marginLeft:6,fontSize:11,background:"var(--rl)",color:"var(--rd)",padding:"1px 6px",borderRadius:8,fontWeight:700}}>ARCHIVADA</span>}</div><div style={{fontSize:12,color:"var(--t3)"}}>{r.category} · {(r.ingredients||[]).length} ins.</div></div>
            <div style={{textAlign:"right",display:"flex",alignItems:"center",gap:8}}>
              <div><div style={{fontWeight:700,fontSize:15}}>${fi(r.sale_price)}</div><div style={{fontSize:12,color:"var(--t3)"}}>C: ${fm(c)}</div></div>
              <button style={{background:"none",border:"none",cursor:"pointer",padding:4}} onClick={async(e)=>{e.stopPropagation();const nv=r.visible===false;const ok=await toggleRecipeVisibility(r.id,nv);if(ok){setRecs(p=>p.map(x=>x.id===r.id?{...x,visible:nv}:x));msg(nv?"Visible en catálogo":"Oculta del catálogo");}else{msg("Error al cambiar visibilidad");}}}>{r.visible!==false?<span style={{color:"var(--gn)"}}>{I.eye({size:14})}</span>:<span style={{color:"var(--t3)"}}>{I.eyeOff({size:14})}</span>}</button>
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
      // Siempre cargar ingredientes frescos desde la DB para evitar datos stale
      if(d.id){const ri=await fetchRecipeIngredients(d.id);d.ingredients=(ri||[]).map(x=>({...x,quantity:x.qty||x.quantity||0,qty:x.qty||x.quantity||0}));}
      if(d.is_combo&&d.id){const ci=await fetchComboItems(d.id);d.comboItems=ci.map(x=>({sub_recipe_id:x.sub_recipe_id,qty:x.qty}));}
      setOv({type:"editR",data:d});
    }}
    onArchive={async(id)=>{await archiveRecipe(id);setRecs(p=>p.map(x=>x.id===id?{...x,is_archived:true}:x));setOv(null);msg("Receta archivada · El historial se conserva");}}
    onUnarchive={async(id)=>{await unarchiveRecipe(id);setRecs(p=>p.map(x=>x.id===id?{...x,is_archived:false}:x));setOv(null);msg("Receta restaurada");}}
    />}
    {ov?.type==="editR"&&<RecForm data={ov.data} ings={ings} recs={recs} onClose={()=>setOv(null)} onSave={async(r)=>{
      const saved=await upsertRecipe({id:r.id,name:r.name,category:r.category,sale_price:r.sale_price,visible:r.visible,image_url:r.image_url,description:r.description,related_ids:r.related_ids||[],is_combo:r.is_combo||false});
      if(saved?.__error==='duplicate'){msg("⚠️ Ya existe una receta activa con ese nombre");return;}
      if(saved){
        await saveRecipeIngredients(saved.id,(r.ingredients||[]).map(ri=>({ingredient_id:ri.ingredient_id,qty:ri.qty||ri.quantity})));
        if(r.is_combo) await saveComboItems(saved.id,(r.comboItems||[]).filter(ci=>ci.sub_recipe_id&&ci.qty>0));
        await loadAll();setOv(null);msg(r.id?"Actualizada":"Creada");
      }
    }}/>}
  </>);
}

function RecDet({r,ings,rc,onClose,onEdit,onArchive,onUnarchive}){
  const c=rc(r);const m=r.sale_price>0?((r.sale_price-c)/r.sale_price*100):0;
  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>{r.name}</h2>{!r.is_archived&&<button onClick={onEdit}>{I.edit({})}</button>}</div><div className="pb">
    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <span className="badge" style={{background:r.visible!==false?"var(--gl)":"var(--rl)",color:r.visible!==false?"var(--gn)":"var(--rd)"}}>{r.visible!==false?"Visible":"Oculto"}</span>
      {r.is_archived&&<span className="badge" style={{background:"var(--rl)",color:"var(--rd)"}}>📦 Archivada</span>}
    </div>
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
    {r.is_archived
      ?(<><div style={{fontSize:12,color:"var(--t3)",marginTop:12,padding:"8px 12px",background:"var(--b2)",borderRadius:8}}>Esta receta está archivada. No aparece en el catálogo pero su historial se conserva.</div>
        <button className="btn bgn" style={{marginTop:12}} onClick={()=>onUnarchive(r.id)}>↩ Restaurar receta</button></>)
      :(<button className="btn bd" style={{marginTop:16}} onClick={()=>{if(window.confirm(`¿Archivar "${r.name}"? No se eliminará el historial de ventas.`))onArchive(r.id);}}>{I.trash({size:16})} Archivar receta</button>)
    }
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
  const addI=()=>{if(!si||!sq)return;const n=Number(sq);s("ingredients",[...f.ingredients,{ingredient_id:si,quantity:n,qty:n}]);setSi("");setSq("");setAd(false);};
  const toggleRel=(id)=>{const cur=f.related_ids||[];s("related_ids",cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]);};
  const otherRecs=(recs||[]).filter(r=>r.id!==f.id&&!r.is_combo);
  const [uploadErr,setUploadErr]=useState("");
  const handleImageUpload=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    setUploadErr("");setUploading(true);
    const result=await uploadRecipeImage(file);
    setUploading(false);
    if(result?.__error){setUploadErr(result.__error);return;}
    if(result)s("image_url",result);
  };
  const addComboItem=()=>setComboItems(p=>[...p,{sub_recipe_id:"",qty:1}]);
  const updCombo=(i,k,v)=>setComboItems(p=>p.map((x,j)=>j===i?{...x,[k]:v}:x));
  const delCombo=(i)=>setComboItems(p=>p.filter((_,j)=>j!==i));

  // Costo total de ingredientes
  const totalCost=(f.ingredients||[]).reduce((s,ri)=>{const ig=ings.find(x=>x.id===ri.ingredient_id);return s+(ig?(ig.cost||0)*(ri.quantity||0):0);},0);
  const profitNeg=!f.is_combo&&totalCost>0&&totalCost>(f.sale_price||0);
  // Receta existente: solo nombre + precio. Nueva: también requiere ingredientes o ser combo
  const isExisting=!!f.id;
  const canSave=f.name&&(f.sale_price||0)>0&&(isExisting||f.is_combo||(f.ingredients||[]).length>0);

  return(<div className="po"><div className="ph"><button onClick={onClose}>{I.back({})}</button><h2>{data?"Editar":"Nueva"} Receta</h2></div><div className="pb">
    <div className="fg"><label className="fl">Nombre</label><input className="fin" value={f.name} onChange={e=>s("name",e.target.value)}/></div>
    <div className="fr"><div className="fg"><label className="fl">Categoría</label><input className="fin" value={f.category} onChange={e=>s("category",e.target.value)} placeholder="Ej: Tortas"/></div>
    <div className="fg"><label className="fl">Precio</label><input className="fin" type="number" value={f.sale_price||""} onChange={e=>s("sale_price",Number(e.target.value))}/></div></div>
    <div className="fg"><label className="fl">Descripción</label><textarea className="fin" value={f.description||""} onChange={e=>s("description",e.target.value)} rows={2} style={{resize:"vertical"}}/></div>
    {/* Image upload */}
    <div className="fg">
      <label className="fl">Imagen</label>
      <div className="img-upload-wrap">
        {f.image_url?<img src={f.image_url} alt="" className="img-preview" loading="lazy" onError={e=>e.target.style.display='none'}/>:null}
        <div className="img-upload-row">
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImageUpload}/>
          <button className="btn bs bsm" onClick={()=>fileRef.current?.click()} disabled={uploading} style={{flex:1}}>
            {uploading?"Subiendo...":f.image_url?`${I.edit({size:13})} Cambiar foto`:`📷 Subir foto`}
          </button>
          {f.image_url&&<button className="btn bd bsm" onClick={()=>s("image_url","")} style={{marginLeft:6}}>✕</button>}
        </div>
        {uploadErr&&<div style={{fontSize:12,color:"var(--rd)",marginTop:6}}>{uploadErr}</div>}
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
    {profitNeg&&<div style={{background:"#FFF8E1",color:"#8D6E00",fontSize:13,padding:"10px 14px",borderRadius:10,marginTop:12,display:"flex",gap:8,alignItems:"flex-start"}}>
      <span style={{fontSize:16}}>⚠️</span>
      <div><strong>Precio por debajo del costo.</strong> El costo de ingredientes (${fm(totalCost)}) supera el precio de venta (${fi(f.sale_price||0)}). Podés guardar igual.</div>
    </div>}
    {!canSave&&<div style={{fontSize:12,color:"var(--t3)",marginTop:10,textAlign:"center"}}>
      {!f.name?"Ingresá un nombre":!(f.sale_price>0)?"Ingresá un precio de venta mayor a 0":!isExisting&&!f.is_combo&&(f.ingredients||[]).length===0?"Agregá al menos un ingrediente":""}
    </div>}
    <button className="btn bp" style={{marginTop:12,opacity:canSave?1:0.5}} disabled={!canSave} onClick={()=>canSave&&onSave({...f,comboItems})}>{I.check({size:18,color:"#fff"})} {data?"Guardar":"Crear"}</button>
  </div></div>);
}

export default Recipes;