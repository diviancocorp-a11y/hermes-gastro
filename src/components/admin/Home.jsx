import { useMemo, useState, lazy, Suspense } from "react";
import { Icon, formatInt, todayISO, OrderStatus } from "../../lib/utils";

const Analytics = lazy(() => import("./Analytics"));

function Home({lowStockIngredients,monthSales,monthExpenses,monthWasteCost,monthProfit,profitMargin,monthProductionCost,wastePct,monthFixedExpenses,monthVariableExpenses,monthGrossMargin,grossMarginPct,sales,orders,recipes,ingredients,calculateRecipeCost,activeOrders,settings,waste,onStock,onPurchase,onOrders,onExp}){
  const [showDetail,setShowDetail]=useState(false);
  // Indicador de calibración: si la merma cargada supera la proyectada, sugerir subir el %
  const projectedWasteCost = (monthProductionCost && wastePct) ? (monthProductionCost - monthProductionCost/(1+wastePct/100)) : 0;
  const wasteOverrun = monthWasteCost > projectedWasteCost * 1.5 && monthWasteCost > 1000;
  const nw=activeOrders.filter(o=>o.status===OrderStatus.new);
  const monthStart=todayISO().slice(0,7)+"-01";
  const top=useMemo(()=>{
    const m={};sales.filter(s=>s.date>=monthStart).forEach(s=>{m[s.recipe_id]=(m[s.recipe_id]||0)+(s.qty||1);});
    return Object.entries(m).map(([id,q])=>({r:recipes.find(x=>x.id===id),q})).filter(x=>x.r).sort((a,b)=>b.q-a.q).slice(0,3);
  },[sales,recipes,monthStart]);

  return(<>
    {nw.length>0&&<div className="ab" style={{background:(settings.logo_color||"#C45D3E")+"18",color:settings.logo_color||"#C45D3E",margin:"0 16px 12px"}} onClick={onOrders}>
      {Icon.orders({size:18})}<span style={{flex:1}}>{nw.length} pedido{nw.length>1?"s":""} nuevo{nw.length>1?"s":""}</span><span style={{fontWeight:700}}>Ver →</span>
    </div>}
    {lowStockIngredients.length>0&&<div className="ab abw" onClick={onStock}>{Icon.alert({size:18})}<span>{lowStockIngredients.length} insumo{lowStockIngredients.length>1?"s":""} con stock bajo</span></div>}

    {/* KPIs principales (vista híbrida: 3 cards grandes + detalle expandible) */}
    <div className="sg">
      <div className="sc f1"><div className="sl">Ventas del mes</div><div className="sv2">${formatInt(monthSales)}</div></div>
      <div className="sc f2"><div className="sl">Resultado neto</div><div className={`sv2 ${monthProfit>=0?"svg2":"svr"}`}>${formatInt(monthProfit)}</div><div className="sd">Margen: {profitMargin.toFixed(1)}%</div></div>
      <div className="sc f3"><div className="sl">Margen bruto</div><div className="sv2">${formatInt(monthGrossMargin||0)}</div><div className="sd">{(grossMarginPct||0).toFixed(1)}% s/ ventas</div></div>
    </div>

    {/* Botón para expandir detalle financiero */}
    <div style={{padding:"0 16px 12px"}}>
      <button onClick={()=>setShowDetail(p=>!p)} style={{width:"100%",padding:"10px 14px",border:"1px solid var(--b2)",background:"var(--b3)",borderRadius:"var(--r)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13,fontWeight:600,color:"var(--t2)"}}>
        <span>📈 Detalle financiero {wastePct!=null&&`· ${wastePct}% merma proyectada`}</span>
        <span style={{transition:"transform .2s",transform:showDetail?"rotate(180deg)":"rotate(0)"}}>▾</span>
      </button>
    </div>

    {showDetail&&<div style={{padding:"0 16px 16px"}}>
      <div className="c" style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:13}}>
          <div>
            <div style={{color:"var(--t3)",fontSize:11,marginBottom:2}}>Costo materia prima (con merma)</div>
            <div style={{fontWeight:700}}>${formatInt(monthProductionCost||0)}</div>
          </div>
          <div>
            <div style={{color:"var(--t3)",fontSize:11,marginBottom:2}}>Margen bruto</div>
            <div style={{fontWeight:700,color:"var(--gn)"}}>${formatInt(monthGrossMargin||0)}</div>
          </div>
          <div>
            <div style={{color:"var(--t3)",fontSize:11,marginBottom:2}}>🏠 Gastos fijos</div>
            <div style={{fontWeight:700,color:"var(--rd)"}}>-${formatInt(monthFixedExpenses||0)}</div>
          </div>
          <div>
            <div style={{color:"var(--t3)",fontSize:11,marginBottom:2}}>📦 Gastos variables</div>
            <div style={{fontWeight:700,color:"var(--rd)"}}>-${formatInt(monthVariableExpenses||0)}</div>
          </div>
          {monthWasteCost>0&&<div style={{gridColumn:"1 / -1"}}>
            <div style={{color:"var(--t3)",fontSize:11,marginBottom:2}}>⚠️ Merma cargada (extra)</div>
            <div style={{fontWeight:700,color:"var(--rd)"}}>-${formatInt(monthWasteCost)}</div>
          </div>}
          <div style={{gridColumn:"1 / -1",borderTop:"1px solid var(--b2)",paddingTop:10,marginTop:4}}>
            <div style={{color:"var(--t3)",fontSize:11,marginBottom:2}}>Resultado neto = Margen bruto − Gastos − Merma</div>
            <div style={{fontWeight:700,fontSize:18,color:monthProfit>=0?"var(--gn)":"var(--rd)"}}>${formatInt(monthProfit)} <span style={{fontSize:12,fontWeight:600}}>({profitMargin.toFixed(1)}%)</span></div>
          </div>
        </div>
        {wasteOverrun&&<div style={{marginTop:12,padding:"8px 12px",background:"#FFF3E0",borderRadius:8,fontSize:12,color:"#8D6E00"}}>
          💡 La merma real cargada supera la proyectada con {wastePct}%. Considerá subir el % en Configuración para que la rentabilidad por producto sea más realista.
        </div>}
      </div>
    </div>}

    {/* Reporte de Mermas del mes */}
    {waste&&waste.length>0&&(()=>{
      const mo2=todayISO().slice(0,7)+"-01";
      const mw=waste.filter(w=>w.date>=mo2);
      if(mw.length===0)return null;
      // Agrupar por motivo
      const byReason={};mw.forEach(w=>{const r=w.reason||"otro";if(!byReason[r])byReason[r]={count:0,cost:0};byReason[r].count+=w.qty||0;const ig=ingredients.find(i=>i.id===w.ingredient_id);byReason[r].cost+=(ig?.cost||0)*(w.qty||0);});
      return(<div className="s"><div className="st">Mermas del mes</div>
        <div className="c" style={{padding:0,overflow:"hidden"}}>
          {Object.entries(byReason).sort((a,b)=>b[1].cost-a[1].cost).map(([reason,data])=>(
            <div key={reason} className="li">
              <div className="lic" style={{background:"var(--rl)",color:"var(--rd)"}}>{reason==="vencimiento"?"📅":reason==="rotura"?"💔":reason==="derrame"?"💧":"⚠️"}</div>
              <div className="lii"><div className="lin" style={{textTransform:"capitalize"}}>{reason}</div><div className="lid">{data.count} unidades</div></div>
              <div className="lir"><div className="lia" style={{color:"var(--rd)"}}>-${formatInt(data.cost)}</div></div>
            </div>
          ))}
        </div>
        <div style={{fontSize:12,color:"var(--t3)",textAlign:"right",padding:"6px 0"}}>Detalle de mermas registradas en stock (insumos descartados).</div>
      </div>);
    })()}

    {/* Analytics avanzado: gráficos antes en pantalla separada, ahora inline */}
    <Suspense fallback={<div className="s"><div className="c" style={{textAlign:"center",padding:20,color:"var(--t3)"}}>Cargando analítica...</div></div>}>
      <Analytics sales={sales} orders={orders} recipes={recipes} calculateRecipeCost={calculateRecipeCost} />
    </Suspense>

    {top.length>0&&<div className="s"><div className="st">Más vendidos</div>
      <div className="c" style={{padding:0,overflow:"hidden"}}>{top.map((t,i)=>{
        const c=calculateRecipeCost(t.r);const rt=t.r.sale_price>0?((t.r.sale_price-c)/t.r.sale_price*100):0;
        return(<div key={t.r.id} className="li">
          <div className="lic" style={{background:["var(--al)","var(--yl)","var(--gl)"][i],color:["var(--ac)","var(--yw)","var(--gn)"][i]}}>#{i+1}</div>
          <div className="lii"><div className="lin">{t.r.name}</div><div className="lid">{t.q} uni · Rent. {rt.toFixed(0)}%</div></div>
          <div className="lir"><div className="lia">${formatInt(t.q*t.r.sale_price)}</div></div>
        </div>);
      })}</div>
    </div>}
  </>);
}

export default Home;