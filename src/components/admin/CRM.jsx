import { useState, useEffect, useMemo } from "react";
import { I, fi, td } from "../../lib/utils";
import { fetchCustomerStats } from "../../lib/adminService";

function CRM({orders,recs,ings,msg}){
  const [customers,setCustomers]=useState([]);const [loading,setLoading]=useState(true);const [search,setSearch]=useState("");
  const [crmPage,setCrmPage]=useState(1);const CRM_PER_PAGE=30;
  useEffect(()=>{fetchCustomerStats().then(c=>{setCustomers(c);setLoading(false);});},[]);

  // Estadísticas rápidas (memoizado)
  const payMethods=useMemo(()=>{const m={};orders.filter(o=>o.status!=='cancelled').forEach(o=>{const p=o.payment||"otro";m[p]=(m[p]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);},[orders]);
  const totalFacturado=useMemo(()=>customers.reduce((a,c)=>a+c.total,0),[customers]);

  const filt=useMemo(()=>{const q=search.toLowerCase();return customers.filter(c=>!q||(c.name||"").toLowerCase().includes(q)||(c.phone||"").includes(q)||(c.email||"").toLowerCase().includes(q));},[customers,search]);
  const filtPaged=useMemo(()=>filt.slice(0,crmPage*CRM_PER_PAGE),[filt,crmPage]);

  const exportCSV=()=>{
    const header="Nombre,Teléfono,Email,Pedidos,Gasto Total,Última compra\n";
    const rows=filt.map(c=>`"${c.name||""}","${c.phone||""}","${c.email||""}",${c.orders},${c.total},"${c.last_order?new Date(c.last_order).toLocaleDateString("es-AR"):""}"`).join("\n");
    const blob=new Blob([header+rows],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`clientes_${td()}.csv`;a.click();URL.revokeObjectURL(url);
    msg("CSV descargado ✓");
  };

  if(loading)return <div className="s" style={{textAlign:"center",padding:40,color:"var(--t3)"}}>Cargando clientes...</div>;

  return(<>
    <div className="s"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div className="st" style={{margin:0}}>CRM · Clientes</div>
      <button className="btn bs bsm" onClick={exportCSV}>📥 Exportar CSV</button>
    </div></div>

    {/* Stats rápidas */}
    <div style={{display:"flex",gap:10,padding:"0 16px 12px"}}>
      <div className="c" style={{flex:1,padding:12,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700}}>{customers.length}</div><div style={{fontSize:11,color:"var(--t3)"}}>Clientes</div></div>
      <div className="c" style={{flex:1,padding:12,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700}}>${fi(totalFacturado)}</div><div style={{fontSize:11,color:"var(--t3)"}}>Facturado total</div></div>
    </div>

    {/* Método de pago más usado */}
    {payMethods.length>0&&<div className="s"><div className="st" style={{fontSize:14}}>Métodos de pago</div>
      <div className="c" style={{padding:0,overflow:"hidden"}}>{payMethods.map(([method,count])=>{
        const total=payMethods.reduce((a,x)=>a+x[1],0);const pct=total>0?(count/total*100):0;
        const icon=method==="efectivo"?"💵":method==="transferencia"?"🏦":method==="tarjeta"?"💳":"📱";
        return(<div key={method} className="li">
          <div className="lic" style={{background:"var(--b2)",fontSize:16}}>{icon}</div>
          <div className="lii"><div className="lin" style={{textTransform:"capitalize"}}>{method}</div>
            <div style={{height:4,background:"var(--b2)",borderRadius:2,marginTop:4}}><div style={{height:4,background:"var(--ac)",borderRadius:2,width:`${pct}%`}}/></div>
          </div>
          <div className="lir"><div className="lia">{count}</div><div style={{fontSize:11,color:"var(--t3)"}}>{pct.toFixed(0)}%</div></div>
        </div>);
      })}</div>
    </div>}

    {/* Lista de clientes */}
    <div className="s">
      <input className="fin" placeholder="🔍 Buscar cliente..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:12}}/>
      <div style={{fontSize:12,color:"var(--t3)",marginBottom:8}}>{filt.length} cliente{filt.length!==1?"s":""}</div>
      {filt.length===0?<div className="c"><div className="empty"><div className="eic">👥</div><div>Sin clientes registrados</div></div></div>
      :<>{filtPaged.map((c,i)=>(
        <div key={i} className="c" style={{padding:12,marginBottom:6}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>{c.name||"Sin nombre"}</div>
              <div style={{fontSize:12,color:"var(--t3)",marginTop:2}}>
                {c.phone&&<span>📱 {c.phone}</span>}{c.phone&&c.email&&" · "}{c.email&&<span>✉️ {c.email}</span>}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:700,color:"var(--gn)"}}>${fi(c.total)}</div>
              <div style={{fontSize:11,color:"var(--t3)"}}>{c.orders} pedido{c.orders!==1?"s":""}</div>
            </div>
          </div>
          {c.last_order&&<div style={{fontSize:11,color:"var(--t3)",marginTop:4}}>Último: {new Date(c.last_order).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})}</div>}
        </div>
      ))}
      {filtPaged.length<filt.length&&<button className="btn bs" style={{width:"100%",marginTop:8}} onClick={()=>setCrmPage(p=>p+1)}>Cargar más ({filt.length-filtPaged.length} restantes)</button>}
      </>}
    </div>
  </>);
}

export default CRM;