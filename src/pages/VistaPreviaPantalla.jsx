// src/pages/VistaPreviaPantalla.jsx
// `/vista-previa/:pantalla?tenant=<slug>`: las pantallas del pedido que en vista
// previa no se alcanzan (los pedidos no se envian), con DATOS DE EJEMPLO fijos.
// Sirve para que el disenador de una plantilla exclusiva las vea y las estile.
//
// Solo funciona en vista previa (localhost y *.vercel.app con ?tenant=); en
// cualquier otro host redirige a `/`. No consulta ningun pedido y no escribe nada.
import { useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { esVistaPrevia } from "../lib/vistaPrevia";
import { fetchCatalog } from "../lib/catalogService";
import { resolveTenantSlug } from "../lib/activeTenant";
import { applyTenantHead } from "../lib/tenantHead";
import { fallbackSettings } from "../constants/catalogConstants";
import { MonedaCatalogoProvider, useMoneda } from "../catalog-pro/MonedaCatalogo";
import useMarcaGlobal from "../catalog-pro/plantillas/useMarcaGlobal";
import usePantallasDePlantilla, {
  PantallasDePlantillaContext, useSlugDelTenant,
} from "../catalog-pro/plantillas/pantallasDePlantilla";
import ConfirmationAnimation from "../components/catalog/ConfirmationAnimation";
import OrderSentView from "../components/catalog/OrderSentView";
import { OrderTrackerVista } from "./OrderTracker";
import "../catalog-pro/tokens.css";

const PANTALLAS_VISTA_PREVIA = ["confirmando", "pedido-recibido", "seguimiento"];
const ESTADOS = ["new", "preparing", "active", "completed", "cancelled"];

// Todo lo de abajo es de ejemplo y esta marcado como tal en pantalla.
const ID_EJEMPLO = "00000000-0000-4000-8000-000000AB12CD";
const FORM_EJEMPLO = {
  name: "Cliente de ejemplo", phone: "1100000000", email: "ejemplo@ejemplo.com",
  birth_date: "2000-01-01", // con email y cumple cargados, no se ofrecen las tarjetas que escriben
  delivery: "retiro", payment: "efectivo",
};
const ITEMS_EJEMPLO = [
  { name: "Producto de ejemplo", qty: 2, unit_price: 4500 },
  { name: "Otro producto de ejemplo", qty: 1, unit_price: 3200 },
];
const nada = () => {};

export default function VistaPreviaPantalla() {
  const { pantalla } = useParams();
  if (!esVistaPrevia() || !PANTALLAS_VISTA_PREVIA.includes(pantalla)) return <Navigate to="/" replace />;
  return <Contenido pantalla={pantalla} />;
}

function Contenido({ pantalla }) {
  const [sett, setSett] = useState(fallbackSettings);
  const slug = useSlugDelTenant();
  useMarcaGlobal(sett);
  const decoraciones = usePantallasDePlantilla({ plantilla: sett.catalog_template, slug });

  useEffect(() => {
    let vivo = true;
    (async () => {
      const data = await fetchCatalog();
      if (!vivo || !data) return;
      setSett(data.settings);
      applyTenantHead({ ...data.settings, __slug: await resolveTenantSlug() });
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <MonedaCatalogoProvider settings={sett}>
      <PantallasDePlantillaContext.Provider value={decoraciones}>
        <Pantalla pantalla={pantalla} settings={sett} />
        <div role="note" style={{
          position: "fixed", left: 8, bottom: 8, zIndex: 9999, pointerEvents: "none",
          padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: "rgba(0,0,0,0.75)", color: "#fff", fontFamily: "system-ui, sans-serif",
        }}>
          Vista previa · datos de ejemplo
        </div>
      </PantallasDePlantillaContext.Provider>
    </MonedaCatalogoProvider>
  );
}

function Pantalla({ pantalla, settings }) {
  if (pantalla === "confirmando") return <ConfirmationAnimation />;
  if (pantalla === "pedido-recibido") {
    return <OrderSentView orderId={ID_EJEMPLO} respuesta={null} items={ITEMS_EJEMPLO} form={FORM_EJEMPLO} receiptFile={null} settings={settings} onReset={nada} />;
  }
  return <SeguimientoDeEjemplo />;
}

function SeguimientoDeEjemplo() {
  const { principal } = useMoneda();
  const [params] = useSearchParams();
  // `?estado=new|preparing|active|completed|cancelled` para ver cada paso.
  const pedidoEstado = ESTADOS.includes(params.get("estado")) ? params.get("estado") : "preparing";
  const order = {
    id: ID_EJEMPLO, status: pedidoEstado, delivery: "retiro", currency: principal,
    customer_first_name: "Cliente de ejemplo", is_gift: false, note: null,
    total: ITEMS_EJEMPLO.reduce((s, i) => s + i.qty * i.unit_price, 0),
    total_secondary: null, fx_currency: null,
  };
  return <OrderTrackerVista loading={false} notFound={false} order={order} items={ITEMS_EJEMPLO} />;
}
