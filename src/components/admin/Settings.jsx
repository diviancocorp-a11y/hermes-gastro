import { useState } from "react";
import { I } from "../../lib/utils";
import { updateSettings, uploadCoverImage, uploadCatImage, uploadLogoImage, resetHistoricalData, downloadServerBackup } from "../../lib/adminService";

const BANNER_COLORS=[{h:"#2D1B0E",l:"Café oscuro"},{h:"#C45D3E",l:"Terracota"},{h:"#3A7D44",l:"Verde"},{h:"#1565C0",l:"Azul"},{h:"#7A2E4A",l:"Borgoña"},{h:"#8D6E00",l:"Dorado"},{h:"#333333",l:"Negro"}];
const DEF={biz_name:"La Nona Pato",logo_letter:"N",logo_color:"#C45D3E",exp_cats:["Materia Prima","Servicios","Packaging","Transporte","Alquiler","Equipamiento","Otros"],ing_cats:["Secos","Frescos","Packaging","Otros"],cat_images:{}};
const CAT_NAMES=["Todos","Primeros Mimos","La Mesa Principal","El Sanguche de la Nona","La Nona Amasó","La Última Mordida","Cocina Consciente"];
const COLORS=[{h:"#C45D3E",l:"Terracota"},{h:"#3A7D44",l:"Verde"},{h:"#1565C0",l:"Azul"},{h:"#7A2E4A",l:"Borgoña"},{h:"#8D6E00",l:"Dorado"},{h:"#2D1B0E",l:"Negro"}];

const SECTIONS=["identity","cover","catImages","banner","storeState","expCats","ingCats","hours","backup","reset"];

function Settings({sett,setSett,msg,onBack}){
  const [s,setS]=useState({...sett});
  const [nc,setNc]=useState("");const [ni,setNi2]=useState("");
  const [uploadingCover,setUploadingCover]=useState(false);
  const [uploadingCat,setUploadingCat]=useState(null);
  const [uploadingLogo,setUploadingLogo]=useState(false);
  const [resetPin,setResetPin]=useState("");
  const [showReset,setShowReset]=useState(false);
  const [resetting,setResetting]=useState(false);
  const [resetConfirm,setResetConfirm]=useState(false);
  const [open,setOpen]=useState({});
  const tog=(k)=>setOpen(p=>({...p,[k]:!p[k]}));
  const set=(k,v)=>setS(p=>({...p,[k]:v}));
  const setCatImg=(name,url)=>setS(p=>({...p,cat_images:{...(p.cat_images||{}),[name]:url}}));
  const toggleCatHidden=(name)=>setS(p=>{const cur=p.hidden_cats||[];return{...p,hidden_cats:cur.includes(name)?cur.filter(x=>x!==name):[...cur,name]};});
  const setCatName=(origName,val)=>setS(p=>({...p,cat_names:{...(p.cat_names||{}),[origName]:val}}));

  const handleCoverFile=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    setUploadingCover(true);
    const result=await uploadCoverImage(file);
    setUploadingCover(false);
    if(result?.__error){msg(result.__error);return;}
    if(result){set("cover_url",result);msg("Imagen cargada ✓");}else{msg("Error al subir imagen");}
  };
  const handleCatFile=async(catName,e)=>{
    const file=e.target.files?.[0];if(!file)return;
    setUploadingCat(catName);
    const result=await uploadCatImage(file,catName);
    setUploadingCat(null);
    if(result?.__error){msg(result.__error);return;}
    if(result){setCatImg(catName,result);msg(`Imagen de "${catName}" cargada ✓`);}else{msg("Error al subir imagen");}
  };
  const handleLogoFile=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    setUploadingLogo(true);
    const result=await uploadLogoImage(file);
    setUploadingLogo(false);
    if(result?.__error){msg(result.__error);return;}
    if(result){set("logo_url",result);msg("Logo cargado ✓");}else{msg("Error al subir logo");}
  };

  return(<>
    <div className="s" style={{paddingTop:4}}><div className="st">Ajustes</div></div>
    <div className="s">

      {/* ── Identidad ── */}
      <div className="c">
        <div onClick={()=>tog("identity")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"2px 0"}}>
          <label className="fl" style={{fontSize:13,fontWeight:700,marginBottom:0,display:"block",cursor:"pointer"}}>🏪 Identidad</label>
          <span style={{fontSize:18,color:"var(--t3)",transition:"transform .2s",transform:open.identity?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </div>
        {open.identity&&<div style={{marginTop:10}}>
        <div className="fg"><label className="fl">Nombre del negocio</label><input className="fin" value={s.biz_name||""} onChange={e=>set("biz_name",e.target.value)}/></div>
        {/* Logo: imagen o letra+color */}
        <div className="fg">
          <label className="fl">Logo</label>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:56,height:56,borderRadius:16,overflow:"hidden",background:s.logo_url?"transparent":(s.logo_color||"#C45D3E"),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:24,fontWeight:700,fontFamily:"'DM Serif Display',serif",flexShrink:0,boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}>
              {s.logo_url?<img src={s.logo_url} alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display='none'}}/>:(s.logo_letter||"N")}
            </div>
            <div style={{flex:1}}>
              <label style={{display:"inline-block",padding:"7px 14px",background:"var(--pr,#C45D3E)",color:"#fff",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"center"}}>
                {uploadingLogo?"Subiendo...":"📷 Subir logo"}
                <input type="file" accept="image/*" style={{display:"none"}} onChange={handleLogoFile} disabled={uploadingLogo}/>
              </label>
              {s.logo_url&&<button className="btn bs bsm" style={{marginLeft:6,fontSize:11}} onClick={()=>set("logo_url","")}>Quitar</button>}
            </div>
          </div>
        </div>
        {!s.logo_url&&<>
          <div className="fg"><label className="fl">Inicial (si no hay imagen)</label><input className="fin" value={s.logo_letter||""} onChange={e=>set("logo_letter",e.target.value.slice(0,2).toUpperCase())} maxLength={2} style={{width:80,textAlign:"center",fontSize:20,fontWeight:700}}/></div>
          <div className="fg"><label className="fl">Color del logo</label><div className="cgrid">{COLORS.map(c=>(<div key={c.h} className={`copt ${s.logo_color===c.h?"on":""}`} style={{background:c.h}} onClick={()=>set("logo_color",c.h)}>{s.logo_letter||"N"}</div>))}</div></div>
        </>}
      </div>}
      </div>

      {/* ── Portada ── */}
      <div className="c">
        <div onClick={()=>tog("cover")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"2px 0"}}>
          <label className="fl" style={{fontSize:13,fontWeight:700,marginBottom:0,display:"block",cursor:"pointer"}}>🖼️ Foto de portada</label>
          <span style={{fontSize:18,color:"var(--t3)",transition:"transform .2s",transform:open.cover?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </div>
        {open.cover&&<div style={{marginTop:10}}>
        {s.cover_url&&<img src={s.cover_url} alt="portada" loading="lazy" style={{width:"100%",height:140,objectFit:"cover",borderRadius:10,marginBottom:10}}/>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <label style={{flex:1,padding:"9px 14px",background:"var(--pr,#C45D3E)",color:"#fff",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",textAlign:"center"}}>
            {uploadingCover?"Subiendo...":"📷 Subir foto"}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleCoverFile} disabled={uploadingCover}/>
          </label>
          {s.cover_url&&<button className="btn bs" style={{fontSize:13}} onClick={()=>set("cover_url","")}>Quitar</button>}
        </div>
        <div className="fg" style={{marginTop:10}}><label className="fl">O pegá una URL de imagen</label><input className="fin" value={s.cover_url||""} onChange={e=>set("cover_url",e.target.value)} placeholder="https://..."/></div>
      </div>}
      </div>

      {/* ── Carátulas de categorías ── */}
      <div className="c">
        <div onClick={()=>tog("catImages")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"2px 0"}}>
          <label className="fl" style={{fontSize:13,fontWeight:700,marginBottom:0,display:"block",cursor:"pointer"}}>🏷️ Carátulas de categorías</label>
          <span style={{fontSize:18,color:"var(--t3)",transition:"transform .2s",transform:open.catImages?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </div>
        {open.catImages&&<div style={{marginTop:10}}>
        <div style={{fontSize:12,color:"var(--t3)",marginBottom:12}}>Imagen, nombre y visibilidad de cada categoría. Usá el ojito para ocultar/mostrar y editá el nombre directamente.</div>
        {CAT_NAMES.map(name=>{
          const img=(s.cat_images||{})[name];
          const isHidden=(s.hidden_cats||[]).includes(name);
          const customName=(s.cat_names||{})[name]||"";
          const isTodos=name==="Todos";
          return(<div key={name} style={{padding:"10px 0",borderBottom:"1px solid var(--b2)",opacity:isHidden?0.45:1,transition:"opacity .2s"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {/* Eye toggle — no aplica a "Todos" */}
              {!isTodos&&<button onClick={()=>toggleCatHidden(name)} style={{background:"none",border:"none",cursor:"pointer",padding:4,flexShrink:0}} title={isHidden?"Mostrar categoría":"Ocultar categoría"}>
                {isHidden?<span style={{color:"var(--t3)"}}>{I.eyeOff({size:16})}</span>:<span style={{color:"var(--gn)"}}>{I.eye({size:16})}</span>}
              </button>}
              <div style={{width:60,height:42,borderRadius:10,overflow:"hidden",background:"var(--b2)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {img?<img src={img} alt={name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :<span style={{fontSize:11,color:"var(--t3)"}}>Sin img</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                {isTodos
                  ?<div style={{fontSize:13,fontWeight:600,color:"var(--tx)"}}>{name}</div>
                  :<input className="fin" value={customName||name} onChange={e=>setCatName(name,e.target.value)} placeholder={name} style={{fontSize:13,fontWeight:600,padding:"4px 8px",marginBottom:0,border:"1px solid var(--b2)",borderRadius:8}}/>
                }
              </div>
              <label style={{padding:"5px 10px",background:"var(--b2)",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",color:"var(--t2)",whiteSpace:"nowrap"}}>
                {uploadingCat===name?"...":"📷"}
                <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleCatFile(name,e)} disabled={uploadingCat===name}/>
              </label>
              {img&&<button onClick={()=>setCatImg(name,"")} style={{background:"none",border:"none",fontSize:14,color:"var(--rd)",cursor:"pointer",padding:4}}>✕</button>}
            </div>
            {isHidden&&<div style={{fontSize:11,color:"var(--rd)",marginTop:4,marginLeft:30}}>Oculta del catálogo</div>}
          </div>);
        })}
      </div>}
      </div>

      {/* ── Banner de anuncios ── */}
      <div className="c">
        <div onClick={()=>tog("banner")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"2px 0"}}>
          <label className="fl" style={{fontSize:13,fontWeight:700,marginBottom:0,display:"block",cursor:"pointer"}}>📢 Banner de anuncios</label>
          <span style={{fontSize:18,color:"var(--t3)",transition:"transform .2s",transform:open.banner?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </div>
        {open.banner&&<div style={{marginTop:10}}>
        <div className="fg"><label className="fl">Mensaje (vacío = oculto)</label><input className="fin" value={s.banner_text||""} onChange={e=>set("banner_text",e.target.value)} placeholder="Ej: 🎂 ¡Pedidos navideños disponibles!"/></div>
        {s.banner_text&&<>
          <label className="fl" style={{marginTop:8}}>Color de fondo</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
            {BANNER_COLORS.map(c=>(
              <div key={c.h} onClick={()=>set("banner_color",c.h)}
                style={{padding:"6px 12px",borderRadius:8,background:c.h,color:"#fff",fontSize:12,cursor:"pointer",fontWeight:s.banner_color===c.h?700:400,outline:s.banner_color===c.h?"2px solid var(--tx)":"none",outlineOffset:2}}>
                {c.l}
              </div>
            ))}
          </div>
          {s.banner_text&&<div style={{marginTop:10,padding:"9px 14px",background:s.banner_color||"#2D1B0E",color:"#fff",borderRadius:8,fontSize:13,fontWeight:600,textAlign:"center"}}>
            {s.banner_text}
          </div>}
        </>}
      </div>}
      </div>

      {/* ── Estado de la tienda ── */}
      <div className="c">
        <div onClick={()=>tog("storeState")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"2px 0"}}>
          <label className="fl" style={{fontSize:13,fontWeight:700,marginBottom:0,display:"block",cursor:"pointer"}}>🚦 Estado de la tienda</label>
          <span style={{fontSize:18,color:"var(--t3)",transition:"transform .2s",transform:open.storeState?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </div>
        {open.storeState&&<div style={{marginTop:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0"}}>
          <div>
            <div style={{fontWeight:600,fontSize:14,color:s.store_open!==false?"#3A7D44":"#C62828"}}>
              {s.store_open!==false?"● Abierta":"● Cerrada"}
            </div>
            <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>{s.store_open!==false?"Los clientes pueden hacer pedidos":"El catálogo es visible pero sin compra"}</div>
          </div>
          <div className={`gift-toggle ${s.store_open!==false?"on":""}`} style={{flexShrink:0}} onClick={()=>set("store_open",s.store_open===false?true:false)}>
            <div className="gift-thumb"/>
          </div>
        </div>
      </div>}
      </div>

      {/* ── Categorías de gastos ── */}
      <div className="c">
        <div onClick={()=>tog("expCats")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"2px 0"}}>
          <label className="fl" style={{fontSize:13,fontWeight:700,marginBottom:0,display:"block",cursor:"pointer"}}>💰 Categorías de gastos</label>
          <span style={{fontSize:18,color:"var(--t3)",transition:"transform .2s",transform:open.expCats?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </div>
        {open.expCats&&<div style={{marginTop:10}}>
        <div className="clist">{(s.exp_cats||[]).map(c=><div key={c} className="ctag">{c}<button onClick={()=>set("exp_cats",(s.exp_cats||[]).filter(x=>x!==c))}>×</button></div>)}</div>
        <div style={{display:"flex",gap:8,marginTop:8}}><input className="fin" placeholder="Nueva..." value={nc} onChange={e=>setNc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&nc.trim()&&(set("exp_cats",[...(s.exp_cats||[]),nc.trim()]),setNc(""))} style={{fontSize:13}}/>
        <button className="btn bs bsm" onClick={()=>nc.trim()&&(set("exp_cats",[...(s.exp_cats||[]),nc.trim()]),setNc(""))}>+</button></div>
      </div>}
      </div>

      {/* ── Categorías de insumos ── */}
      <div className="c">
        <div onClick={()=>tog("ingCats")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"2px 0"}}>
          <label className="fl" style={{fontSize:13,fontWeight:700,marginBottom:0,display:"block",cursor:"pointer"}}>📦 Categorías de insumos</label>
          <span style={{fontSize:18,color:"var(--t3)",transition:"transform .2s",transform:open.ingCats?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </div>
        {open.ingCats&&<div style={{marginTop:10}}>
        <div className="clist">{(s.ing_cats||[]).map(c=><div key={c} className="ctag">{c}<button onClick={()=>set("ing_cats",(s.ing_cats||[]).filter(x=>x!==c))}>×</button></div>)}</div>
        <div style={{display:"flex",gap:8,marginTop:8}}><input className="fin" placeholder="Nueva..." value={ni} onChange={e=>setNi2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ni.trim()&&(set("ing_cats",[...(s.ing_cats||[]),ni.trim()]),setNi2(""))} style={{fontSize:13}}/>
        <button className="btn bs bsm" onClick={()=>ni.trim()&&(set("ing_cats",[...(s.ing_cats||[]),ni.trim()]),setNi2(""))}>+</button></div>
      </div>}
      </div>

      {/* ── Horarios del local ── */}
      <div className="c">
        <div onClick={()=>tog("hours")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"2px 0"}}>
          <label className="fl" style={{fontSize:13,fontWeight:700,marginBottom:0,display:"block",cursor:"pointer"}}>🕐 Horarios del local</label>
          <span style={{fontSize:18,color:"var(--t3)",transition:"transform .2s",transform:open.hours?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </div>
        {open.hours&&<div style={{marginTop:10}}>
        <div style={{fontSize:12,color:"var(--t3)",marginBottom:10}}>Define cuándo el local acepta pedidos. Se usa para validar "Pedir ahora".</div>
        {["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"].map((day,i)=>{
          const hrs=s.store_hours||{};const d=hrs[i]||{open:"",close:"",closed:false};
          const upd=(k,v)=>{const nh={...hrs};nh[i]={...d,[k]:v};set("store_hours",nh);};
          return(<div key={day} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<6?"1px solid var(--b2)":"none"}}>
            <div style={{width:80,fontSize:13,fontWeight:600,color:d.closed?"var(--t3)":"var(--tx)"}}>{day}</div>
            {d.closed?<div style={{flex:1,fontSize:12,color:"var(--t3)",fontStyle:"italic"}}>Cerrado</div>
            :<>
              <input type="time" value={d.open||""} onChange={e=>upd("open",e.target.value)} style={{flex:1,padding:"4px 6px",borderRadius:6,border:"1px solid var(--b2)",fontSize:13,colorScheme:"light"}}/>
              <span style={{fontSize:12,color:"var(--t3)"}}>a</span>
              <input type="time" value={d.close||""} onChange={e=>upd("close",e.target.value)} style={{flex:1,padding:"4px 6px",borderRadius:6,border:"1px solid var(--b2)",fontSize:13,colorScheme:"light"}}/>
            </>}
            <button style={{background:"none",border:"none",fontSize:11,color:d.closed?"var(--gn)":"var(--rd)",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}} onClick={()=>upd("closed",!d.closed)}>{d.closed?"Abrir":"Cerrar"}</button>
          </div>);
        })}
      </div>}
      </div>

      {/* ── Respaldo de clientes ── */}
      <div className="c">
        <div onClick={()=>tog("backup")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"2px 0"}}>
          <label className="fl" style={{fontSize:13,fontWeight:700,marginBottom:0,display:"block",cursor:"pointer"}}>📁 Respaldo de clientes</label>
          <span style={{fontSize:18,color:"var(--t3)",transition:"transform .2s",transform:open.backup?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </div>
        {open.backup&&<div style={{marginTop:10}}>
        <button
          onClick={async()=>{
            const r=await downloadServerBackup();
            if(r.ok) msg("Backup descargado ✓");
            else msg("No hay backup aún o error: "+r.msg);
          }}
          style={{width:"100%",padding:"12px",background:"var(--pr,#C45D3E)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer"}}
        >📥 Descargar backup de clientes</button>
      </div>}
      </div>

      {/* ── Reinicio administrativo ── */}
      <div className="c" style={{border:"1.5px solid #C62828",background:"#FFF5F5"}}>
        <div onClick={()=>tog("reset")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"2px 0"}}>
          <label className="fl" style={{fontSize:13,fontWeight:700,marginBottom:0,display:"block",color:"#C62828",cursor:"pointer"}}>⚠️ Reinicio administrativo</label>
          <span style={{fontSize:18,color:"#C62828",transition:"transform .2s",transform:open.reset?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </div>
        {open.reset&&<div style={{marginTop:10}}>
        <div style={{fontSize:12,color:"#5D4037",marginBottom:12,lineHeight:1.5}}>Reiniciar datos históricos elimina <strong>pedidos, ventas, gastos, compras, mermas, cupones y datos CRM</strong>. No afecta recetas, ingredientes ni configuración.</div>
        {!showReset
          ?<button onClick={()=>setShowReset(true)} style={{width:"100%",padding:"12px",background:"#C62828",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>🗑️ Reiniciar datos históricos</button>
          :<div style={{background:"#FFEBEE",borderRadius:10,padding:14}}>
            <div style={{fontSize:13,fontWeight:600,color:"#C62828",marginBottom:10}}>Ingresá la clave de seguridad para confirmar:</div>
            <div style={{display:"flex",gap:8}}>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={resetPin}
                onChange={e=>setResetPin(e.target.value.replace(/\D/g,"").slice(0,4))}
                placeholder="****"
                style={{flex:1,padding:"10px 14px",border:"1.5px solid #C62828",borderRadius:8,fontSize:18,textAlign:"center",letterSpacing:8,fontWeight:700,background:"#fff"}}
                autoFocus
              />
              <button
                disabled={resetPin!=="4477"||resetting}
                onClick={()=>setResetConfirm(true)}
                style={{padding:"10px 20px",background:resetPin==="4477"?"#C62828":"#ccc",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:resetPin==="4477"?"pointer":"not-allowed",opacity:resetPin==="4477"?1:0.5}}
              >
                {resetting?"...":"Confirmar"}
              </button>
              <button onClick={()=>{setShowReset(false);setResetPin("");setResetConfirm(false);}} style={{padding:"10px 14px",background:"transparent",border:"1.5px solid #C62828",borderRadius:8,fontSize:13,color:"#C62828",cursor:"pointer",fontWeight:600}}>✕</button>
            </div>
            {resetPin.length===4&&resetPin!=="4477"&&<div style={{fontSize:12,color:"#C62828",marginTop:6}}>Clave incorrecta</div>}
            {resetConfirm&&resetPin==="4477"&&!resetting&&(
              <div style={{marginTop:12,padding:12,background:"#fff",borderRadius:8,border:"1.5px solid #C62828"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#C62828",marginBottom:8}}>⚠️ ESTA ACCIÓN ES IRREVERSIBLE</div>
                <div style={{fontSize:12,color:"#5D4037",marginBottom:12}}>Se descargará un <strong>respaldo automático de clientes</strong> (CSV) y luego se borrarán todos los pedidos, ventas, gastos, compras, mermas, cupones y datos de clientes. ¿Estás seguro?</div>
                <div style={{display:"flex",gap:8}}>
                  <button
                    onClick={async()=>{
                      setResetting(true);
                      const result=await resetHistoricalData();
                      setResetting(false);
                      if(result.ok){
                        const bk=result.backup;
                        msg(bk?.count?`✓ Respaldo de ${bk.count} clientes descargado → ${bk.fileName}. Datos eliminados.`:"Datos históricos eliminados ✓");
                        setShowReset(false);setResetPin("");setResetConfirm(false);
                      }else{
                        const bk=result.backup;
                        msg((bk?.count?`Respaldo OK (${bk.count} clientes). `:"")+"Errores: "+result.errors.join(", "));
                      }
                    }}
                    style={{flex:1,padding:"10px",background:"#C62828",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}
                  >
                    Sí, borrar todo
                  </button>
                  <button onClick={()=>setResetConfirm(false)} style={{flex:1,padding:"10px",background:"#fff",color:"#C62828",border:"1.5px solid #C62828",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        }
      </div>}
      </div>

      <button className="btn bp" style={{marginTop:8}} onClick={async()=>{const saved=await updateSettings(s);if(saved){setSett(saved);msg("Guardado ✓");onBack();}else{msg("Error al guardar");}}}>{I.check({size:18,color:"#fff"})} Guardar cambios</button>
    </div>
  </>);
}

export default Settings;