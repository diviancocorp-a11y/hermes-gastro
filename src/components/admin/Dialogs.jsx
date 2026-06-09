import { useState } from "react";
import { Icon } from "../../lib/utils";
import { useConfirm } from "../ConfirmSlideProvider";
import SlideToConfirm from "../SlideToConfirm";

function CancelDlg({ order = {}, recs = [], ings = [], onClose, onConfirm }) {
  // ¿El pedido ya consumió insumos? Solo PREP/READY/ACTIVE descontaron stock.
  // Si está en NEW, no se descontó nada → solo slide directo para cancelar.
  const consumed = !!order.status && order.status !== "new" && order.status !== "cancelled";
  const [pickedStock, setPickedStock] = useState(null); // true = devolver stock, false = merma. Solo aplica si consumed.

  // Calcula los insumos usados (puede estar vacío si no hay datos enriquecidos)
  const used = [];
  const items = order.order_items || order.items || [];
  items.forEach(it => {
    const r = recs.find(x => x.id === it.recipe_id);
    if (!r) return;
    (r.ingredients || r.recipe_ingredients || []).forEach(ri => {
      const ig = ings.find(x => x.id === ri.ingredient_id);
      if (!ig) return;
      const qty = (ri.quantity || ri.qty || 0) * (it.quantity || it.qty || 1);
      const ex = used.find(u => u.id === ig.id);
      if (ex) ex.qty += qty;
      else used.push({ id: ig.id, name: ig.name, unit: ig.unit, qty });
    });
  });

  // Decidir qué mostrar:
  //   - NEW (sin consumir): slide directo.
  //   - PREP+ y pickedStock == null: mostrar elección stock/merma.
  //   - PREP+ y pickedStock != null: mostrar slide específico.
  const showSlide = !consumed || pickedStock !== null;
  const slideLabel = !consumed ? "Deslizá para cancelar"
    : pickedStock === true ? "Deslizá para cancelar y devolver al stock"
    : "Deslizá para cancelar y registrar merma";
  const slideSuccessLabel = "Pedido cancelado ✓";

  const handleConfirmSlide = async () => {
    // En NEW, returnToStock no aplica → pasamos false (sin devolución).
    onConfirm(consumed ? !!pickedStock : false);
  };

  return (
    <>
      <div className="ag-modal-backdrop open" onClick={onClose} />
      <div className="ag-modal-sheet open" role="dialog" aria-label="Cancelar pedido">
        <header className="ag-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--ag-c-orders-soft)',
              color: 'var(--ag-c-orders)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3>Cancelar pedido</h3>
              <p>de {order.customer || 'cliente'}</p>
            </div>
          </div>
          <button type="button" className="ag-modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        <div className="ag-modal-body">
          {/* Intro distinta según consumido o no */}
          <p style={{ fontSize: 13.5, color: 'var(--ag-ink-2)', margin: '0 0 14px' }}>
            {consumed
              ? 'Los insumos ya fueron descontados. ¿Qué hacemos con ellos?'
              : 'El pedido todavía no consumió insumos. Vas a cancelar sin afectar el stock.'}
          </p>

          {consumed && used.length > 0 && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--ag-bg-soft)',
              borderRadius: 10,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ag-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Insumos usados
              </div>
              {used.map(ig => (
                <div key={ig.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--ag-ink)' }}>{ig.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--ag-ink)' }}>{ig.qty} {ig.unit}</span>
                </div>
              ))}
            </div>
          )}

          {/* Paso 1 (solo PREP+): elegir destino de los insumos */}
          {consumed && pickedStock === null && (
            <>
              <button
                type="button"
                className="ag-btn-primary"
                style={{ width: '100%', marginBottom: 8, background: 'var(--ag-c-sales)' }}
                onClick={() => setPickedStock(true)}
              >
                ↺ Devolver al stock
              </button>
              <button
                type="button"
                className="ag-btn-primary"
                style={{ width: '100%', marginBottom: 8, background: 'var(--ag-c-orders)' }}
                onClick={() => setPickedStock(false)}
              >
                🗑 Registrar como merma
              </button>
              <button
                type="button"
                className="ag-btn-ghost"
                style={{ width: '100%' }}
                onClick={onClose}
              >Volver</button>
            </>
          )}

          {/* Paso 2 (NEW directo o PREP+ ya eligió): slide para confirmar */}
          {showSlide && (
            <>
              {consumed && pickedStock !== null && (
                <div style={{ marginBottom: 10, padding: "8px 12px", background: "var(--ag-bg-soft)", borderRadius: 8, fontSize: 12, color: "var(--ag-ink-2)" }}>
                  Vas a cancelar y <strong>{pickedStock ? "devolver los insumos al stock" : "registrar como merma"}</strong>.
                </div>
              )}
              <SlideToConfirm
                danger
                label={slideLabel}
                loadingLabel="Cancelando…"
                successLabel={slideSuccessLabel}
                onConfirm={handleConfirmSlide}
              />
              <button
                type="button"
                className="ag-btn-ghost"
                style={{ marginTop: 10, width: '100%', padding: 10, fontSize: 12.5, color: 'var(--ag-ink-3)' }}
                onClick={consumed && pickedStock !== null ? () => setPickedStock(null) : onClose}
              >{consumed && pickedStock !== null ? "← Volver atrás" : "Cancelar"}</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function StockWarningDlg({ deficits = [], onForce, onClose }) {
  return (
    <>
      <div className="ag-modal-backdrop open" onClick={onClose} />
      <div className="ag-modal-sheet open" role="dialog" aria-label="Stock insuficiente">
        <header className="ag-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--ag-c-stock-soft)',
              color: 'var(--ag-c-stock)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3>Stock insuficiente</h3>
              <p>Algunos insumos quedarán en negativo</p>
            </div>
          </div>
          <button type="button" className="ag-modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        <div className="ag-modal-body">
          <div style={{
            padding: '10px 12px',
            background: 'var(--ag-bg-soft)',
            borderRadius: 10,
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ag-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Insumos con déficit ({deficits.length})
            </div>
            {deficits.map((d, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', fontSize: 12.5,
                borderTop: i === 0 ? 'none' : '1px solid var(--ag-line)',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--ag-ink)' }}>{d.name}</span>
                <span style={{ color: 'var(--ag-c-orders)', fontWeight: 700 }}>
                  {d.current} → <strong>{d.after}</strong> {d.unit}
                </span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--ag-ink-3)', margin: '0 0 14px', lineHeight: 1.4 }}>
            Podés forzar la preparación igualmente. El stock quedará en negativo hasta que registres una compra.
          </p>

          <button
            type="button"
            className="ag-btn-primary"
            style={{ width: '100%', marginBottom: 8, background: 'var(--ag-c-stock)' }}
            onClick={onForce}
          >⚠ Forzar preparación</button>
          <button
            type="button"
            className="ag-btn-ghost"
            style={{ width: '100%' }}
            onClick={onClose}
          >Cancelar</button>
        </div>
      </div>
    </>
  );
}

function NewOrderOverlay({count,onAck}){
  const [closing,setClosing]=useState(false);
  const ack=()=>{ if(closing) return; setClosing(true); setTimeout(onAck,300); };
  return(
    <div onClick={ack} style={{
      position:"fixed",inset:0,zIndex:9999,
      background:"#F59E0B",
      display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",
      cursor:"pointer",userSelect:"none",
      padding:32,textAlign:"center",
      opacity:closing?0:1,transition:"opacity 0.3s ease"
    }}>
      <style>{`@keyframes hg-no-rise{0%{transform:translateY(24px);opacity:0}100%{transform:translateY(0);opacity:1}}@keyframes hg-no-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}`}</style>
      <img src="/brand/hermes-logo-on-light.png" alt="" aria-hidden="true" style={{
        width:240,maxWidth:"72%",marginBottom:22,
        filter:"brightness(0) invert(1)",
        animation:"hg-no-rise 0.5s ease-out, hg-no-pulse 1.3s ease-in-out 0.5s infinite"
      }}/>
      <div style={{fontSize:46,fontWeight:900,color:"#fff",lineHeight:1.05,marginBottom:10,textShadow:"0 2px 8px rgba(0,0,0,0.18)"}}>
        ¡{count} PEDIDO{count!==1?"S":""} NUEVO{count!==1?"S":""}!
      </div>
      <div style={{fontSize:17,color:"rgba(255,255,255,0.9)",marginBottom:30,fontWeight:500}}>
        Tocá en cualquier lugar para ver
      </div>
      <div style={{
        background:"rgba(255,255,255,0.25)",
        border:"2px solid rgba(255,255,255,0.6)",
        borderRadius:40,padding:"14px 36px",
        fontSize:18,fontWeight:700,color:"#fff"
      }}>
        Ver pedidos →
      </div>
    </div>
  );
}

export { CancelDlg, StockWarningDlg, NewOrderOverlay };
