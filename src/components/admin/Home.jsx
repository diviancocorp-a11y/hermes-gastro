import { useMemo } from "react";
import { Icon, formatInt, todayISO, OrderStatus } from "../../lib/utils";

function Home({lowStockIngredients,monthSales,monthExpenses,monthWasteCost,monthProfit,profitMargin,monthProductionCost,sales,recipes,ingredients,calculateRecipeCost,activeOrders,settings,waste,onStock,onPurchase,onOrders,onExp}){
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

    <div className="sg">
      <div className="sc f1"><div className="sl">Ventas</div><div className="sv2">${formatInt(monthSales)}</div></div>
      <div className="sc f2"><div className="sl">Ganancia</div><div className={`sv2 ${monthProfit>=0?"svg2":"svr"}`}>${formatInt(monthProfit)}</div><div className="sd">Margen: {profitMargin.toFixed(1)}%</div></div>
      <div className="sc f3"><div className="sl">Costo Insumos</div><div className="sv2">${formatInt(monthProductionCost)}</div><div className="sd">Ref. producción</div></div>
      <div className="sc f4"><div className="sl">Gastos</div><div className="sv2 svr">${formatInt(monthExpenses)}</div></div>
      {monthWasteCost>0&&<div className="sc" style={{background:"#FFF3E0"}}><div className="sl">⚠️ Merma</div><div className="sv2 svr">${formatInt(monthWasteCost)}</div><div className="sd">Pérdida en insumos</div></div>}
    </div>

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
        <div style={{fontSize:12,color:"var(--t3)",textAlign:"right",padding:"6px 0"}}>Rentabilidad = Ventas - Gastos - Merma</div>
      </div>);
    })()}

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