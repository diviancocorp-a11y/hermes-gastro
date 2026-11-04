/**
 * VentasPanel — la pestaña "Ventas" del panel del edificio. ETAPA 4.
 *
 * Contenedor con cuatro solapas, mismo criterio que FinanzasPanel:
 *   - Hoy:      ResultadoDelDia (la ganancia neta del dia de la sucursal,
 *               calculada por la base). Es la solapa por defecto.
 *   - Ventas:   SalesView del legacy (historial + venta manual)
 *   - Resumen:  MonthSummary del legacy (el P&L del mes)
 *   - Clientes: promos del catalogo + CRM
 *
 * Plan (`plan`, el planEfectivo del negocio): sin 'ganancia' la solapa Hoy
 * muestra la venta y bloquea la cuenta; sin 'promos' o sin 'crm' cada uno
 * deja su BloqueoDePlan. El del CRM lleva el dato real: cuantos clientes no
 * compran hace 3 meses. Sin plan (null) no cambia nada.
 *
 * Las pantallas hablan el idioma del legacy; los adaptadores
 * (productosComoRecetas / pedidosParaVentas, en platformSales.js) traducen el
 * modelo del edificio UNA vez, aca en el borde.
 *
 * El costo del mes va SIN el colchon de merma/gastos proyectados
 * (costoBruto, no costoReceta): esos porcentajes son de PRICING. Aplicarlos
 * al P&L ademas de restar los gastos reales es el doble conteo que ya se
 * arreglo en el legacy el 12/jun — la ganancia quedaba subestimada.
 */
import { useEffect, useMemo, useState } from 'react';
import { SalesView } from '../Finance';
import MonthSummary from '../MonthSummary';
import CRM from '../CRM';
import PromosDelCatalogo from './PromosDelCatalogo';
import ResultadoDelDia from './ResultadoDelDia';
import BloqueoDePlan from './BloqueoDePlan';
import { planTieneFuncion } from '../../../modules/planes';
import { contarClientesInactivos } from '../../../modules/clientesInactivos';
import { productosComoRecetas, pedidosParaVentas } from '../../../services/platformSales';
import { pedidosParaCrm } from '../../../services/platformCrm';
import { costoBruto, indexarInsumos } from '../../../services/platformRecipes';

// Clientes vive aca y no como pestania propia: la barra inferior se usa con
// el pulgar y seis items no entran (la razon de FinanzasPanel). Ademas es el
// mismo momento: se mira cuanto se vendio y a quien.
const SOLAPAS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'resumen', label: 'Resumen' },
  { id: 'clientes', label: 'Clientes' },
];

/** El dato del bloqueo del CRM. null mientras se cuenta: no se inventa. */
function textoInactivos(n) {
  if (n === null || n === undefined) return null;
  if (n === 0) return 'Hoy no tenés clientes que hayan dejado de comprar hace más de 3 meses.';
  if (n === 1) return 'Tenés 1 cliente que no compra hace 3 meses.';
  return `Tenés ${n} clientes que no compran hace 3 meses.`;
}

function Solapas({ valor, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0' }}>
      {SOLAPAS.map(o => {
        const on = valor === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-current={on ? 'page' : undefined}
            style={{
              flex: 1, minHeight: 44, padding: '9px 6px', borderRadius: 999,
              border: on ? '2px solid var(--ag-accent-border)' : '1px solid var(--ag-line)',
              background: on ? 'var(--ag-accent-soft)' : 'var(--ag-bg-card)',
              color: on ? 'var(--ag-accent-border)' : 'var(--ag-ink-2)',
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

export default function VentasPanel({
  sales, setSales,
  orders, itemsPorPedido,
  products, recetas, ingredients, expenses,
  // Merma cargada a mano (Etapa 6): el resumen la resta como perdida real.
  waste,
  settings, showToast,
  // Los analisis USAR del resumen son gastronomicos (registry).
  permiteUsar = true,
  // Saver del edificio para la venta manual.
  onCrearVenta,
  // Clientes agregados desde los pedidos del tenant (Etapa 5a).
  onFetchClientes,
  // () => {ok, clientes}|{ok:false}: el dato del bloqueo del CRM. Sin esto, o
  // si la consulta falla, el bloqueo va sin numero.
  onFetchClientesConEstado,
  // Guarda settings (las promos del catalogo se prenden y apagan en Clientes).
  onGuardarSettings,
  // La sucursal por defecto ({id, name, timezone}): el resultado del dia es
  // por sucursal. undefined mientras se busca, null si el negocio no tiene
  // ninguna. Sin default a proposito: un `= null` convertiria el "todavia se
  // esta buscando" en "no hay sucursal".
  sucursal,
  // planEfectivo del negocio. null = sin plan = tiene todo.
  plan = null,
}) {
  const [solapa, setSolapa] = useState('hoy');
  const [ov, setOv] = useState(null);

  const tieneCrm = planTieneFuncion(plan, 'crm');
  const tienePromos = planTieneFuncion(plan, 'promos');
  const tieneGanancia = planTieneFuncion(plan, 'ganancia');

  // Sin CRM igual se cuenta a quien se perdio: es el dato del bloqueo. Sale
  // de la misma consulta que usa el CRM (toda la historia), no de los
  // ultimos pedidos que tiene cargados el panel.
  // Con la base caida no se afirma "0 clientes perdidos": sin dato, sin numero.
  const [inactivos, setInactivos] = useState(null);
  useEffect(() => {
    if (tieneCrm || solapa !== 'clientes' || !onFetchClientesConEstado) return undefined;
    let vigente = true;
    Promise.resolve(onFetchClientesConEstado())
      .then(r => { if (vigente) setInactivos(r?.ok ? contarClientesInactivos(r.clientes) : null); })
      .catch(() => { if (vigente) setInactivos(null); });
    return () => { vigente = false; };
  }, [tieneCrm, solapa, onFetchClientesConEstado]);

  const recs = useMemo(
    () => productosComoRecetas(products, recetas),
    [products, recetas]
  );

  const insumosPorId = useMemo(() => indexarInsumos(ingredients), [ingredients]);

  // SalesView muestra los pedidos completados Y las ventas sueltas. Las
  // ventas que complete_order asienta desde un pedido llevan order_id: si se
  // pasaran las dos cosas, cada pedido apareceria dos veces y el total del
  // mes daria el doble.
  const pedidosCompletados = useMemo(
    () => pedidosParaVentas((orders || []).filter(o => o.status === 'completed'), itemsPorPedido),
    [orders, itemsPorPedido]
  );
  const ventasManuales = useMemo(
    () => (sales || []).filter(s => !s.order_id),
    [sales]
  );

  // CRM recalcula tendencias con useMemo sobre `orders`: si el array se
  // rearma en cada render, ese memo no memoiza nada.
  const pedidosCrm = useMemo(() => pedidosParaCrm(orders), [orders]);

  // La venta manual congela el costo de la receta ACTUAL del producto. Sin
  // receta queda 0: el margen de esa venta no se conoce, y un 0 honesto es
  // mejor que un invento.
  const crearVentaConCosto = async (s) => {
    const lineas = recetas?.get?.(s.recipe_id) || [];
    const unitCost = costoBruto(lineas, insumosPorId);
    return onCrearVenta({ ...s, unit_cost: unitCost });
  };

  // Costo del mes para el resumen: receta actual SIN colchon (ver cabecera).
  const costoRecetaMes = (rec) => costoBruto(
    (rec?.ingredients || []).map(l => ({ ingredient_id: l.ingredient_id, qty: l.quantity })),
    insumosPorId
  );

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <Solapas valor={solapa} onChange={setSolapa} />

      {solapa === 'hoy' && <ResultadoDelDia sucursal={sucursal} verGanancia={tieneGanancia} />}

      {solapa === 'ventas' && (
        <SalesView
          sales={ventasManuales}
          setSales={setSales}
          orders={pedidosCompletados}
          recipes={recs}
          overlay={ov}
          setOverlay={setOv}
          showToast={showToast}
          onCreate={crearVentaConCosto}
        />
      )}

      {/* Los bloqueos son h3: con alguno en la solapa, va su h2 para que el
          arbol de encabezados no salte. Solo para lectores: el rotulo visible
          ya es la solapa activa. Sin bloqueos (sin plan) no se agrega nada. */}
      {solapa === 'clientes' && (!tieneCrm || !tienePromos) && (
        <h2 className="ag-sr-only">Clientes</h2>
      )}
      {solapa === 'clientes' && tienePromos && (
        <PromosDelCatalogo settings={settings} onGuardar={onGuardarSettings} showToast={showToast} />
      )}
      {solapa === 'clientes' && !tienePromos && (
        <BloqueoDePlan
          funcion="promos"
          titulo="Promos del catálogo"
          detalle="Elegir qué promos ven tus clientes en el inicio del catálogo"
        />
      )}

      {solapa === 'clientes' && !tieneCrm && (
        <BloqueoDePlan
          funcion="crm"
          titulo="Clientes que dejaron de venir"
          dato={textoInactivos(inactivos)}
          detalle={inactivos === 0 ? 'Que Dico te avise cuando alguno deje de venir' : 'Verlos y escribirles'}
        />
      )}

      {solapa === 'clientes' && tieneCrm && (
        <CRM
          orders={pedidosCrm}
          showToast={showToast}
          onFetchStats={onFetchClientes}
          // El cumple necesita birth_date + edge function, y las promos crean
          // cupones con el shape del legacy. Ninguno existe en el edificio.
          permiteCumple={false}
          permitePromos={false}
        />
      )}

      {solapa === 'resumen' && (
        <MonthSummary
          sales={sales || []}
          expenses={expenses || []}
          orders={orders || []}
          recipes={recs}
          ingredients={ingredients || []}
          waste={waste || []}
          settings={settings || {}}
          calculateRecipeCost={costoRecetaMes}
          permiteUsar={permiteUsar}
          bloqueoDeGanancia={tieneGanancia ? null : (
            <BloqueoDePlan
              funcion="ganancia"
              titulo="La ganancia del mes"
              detalle="Saber cuánto te quedó después del costo de lo vendido, los gastos y la merma, y el análisis del mes"
              encajado
            />
          )}
          onBack={() => setSolapa('ventas')}
        />
      )}
    </div>
  );
}
