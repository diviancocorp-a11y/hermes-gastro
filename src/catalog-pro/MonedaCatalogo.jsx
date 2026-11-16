// src/catalog-pro/MonedaCatalogo.jsx
// UN lugar para mostrar plata en el catalogo: ficha, carrito, checkout, estado
// del pedido. El provider lee la moneda del tenant (settings.currency /
// secondary_currency) y la tasa vigente UNA vez (useTasaCatalogo); el resto de
// las pantallas pide `useMoneda()` o dibuja <Monto valor={...} />.
//
// Regla de compatibilidad: un tenant SIN moneda secundaria (o sin provider)
// ve exactamente lo de siempre: ARS -> fmtAR, texto plano sin nodos de mas.
// Ningun simbolo ni locale va escrito en un componente: salen de moneda.js.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fmtAR } from "../lib/format";
import { formatearMonto } from "../lib/moneda";
import useTasaCatalogo from "../hooks/useTasaCatalogo";
import { resolveTenantSlug } from "../lib/activeTenant";
import { avisoDeTasa, precioDoble } from "./plantillas/precios";
import "./monto.css";

const SIN_MONEDA = Object.freeze({
  activa: false, principal: "ARS", secundaria: null, tasa: null, cargando: false,
});
const Ctx = createContext(SIN_MONEDA);

/** Texto del monto en la moneda principal. ARS -> fmtAR exacto (lo de siempre). */
export function textoPrincipal(valor, principal) {
  return !principal || principal === "ARS" ? fmtAR(valor) : formatearMonto(valor, principal);
}

/** { principal, secundario, estado } de un monto. Puro: lo usan Monto, el mensaje de WhatsApp y los tests. */
export function montoDoble(valor, { principal, secundaria, tasa } = {}) {
  const d = precioDoble(valor, { principal, secundaria, tasa });
  return { ...d, principal: textoPrincipal(valor, principal) };
}

export function MonedaCatalogoProvider({ settings, children }) {
  const principal = settings?.currency || "ARS";
  const secundaria = settings?.secondary_currency || null;
  const zona = settings?.timezone || undefined;
  const [slug, setSlug] = useState(null);
  useEffect(() => {
    if (!secundaria) return undefined;
    let vivo = true;
    resolveTenantSlug().then((s) => { if (vivo) setSlug(s); }).catch(() => {});
    return () => { vivo = false; };
  }, [secundaria]);
  const { tasa, cargando } = useTasaCatalogo({ slug, principal, secundaria, zona });
  const valor = useMemo(() => ({
    activa: Boolean(secundaria && secundaria !== principal),
    principal, secundaria: secundaria !== principal ? secundaria : null, tasa, cargando,
  }), [principal, secundaria, tasa, cargando]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** { activa, principal, secundaria, tasa, texto(v), doble(v), aviso } */
export function useMoneda() {
  const m = useContext(Ctx);
  return useMemo(() => ({
    ...m,
    texto: (v) => textoPrincipal(v, m.principal),
    doble: (v) => montoDoble(v, m),
    aviso: avisoDeTasa(m.tasa, m),
  }), [m]);
}

/**
 * Monto en pantalla. Sin moneda secundaria devuelve SOLO el texto (sin nodos
 * de mas: el DOM queda igual que con fmtAR). Con secundaria, principal y
 * debajo el equivalente; la tasa vencida lo marca "tasa anterior".
 */
export function Monto({ valor, className = "" }) {
  const { doble } = useMoneda();
  const d = doble(valor);
  if (!d.secundario) return <>{d.principal}</>;
  return (
    <span className={`cp-monto ${className}`.trim()}>
      <span className="cp-monto__p">{d.principal}</span>
      <span className={`cp-monto__s${d.estado === "vencida" ? " cp-monto__s--vieja" : ""}`}>
        {d.secundario}{d.estado === "vencida" ? " · tasa anterior" : ""}
      </span>
    </span>
  );
}

/**
 * Monto de un pedido YA hecho: el secundario es el que se congelo con su tasa
 * (orders.total_secondary), nunca uno recalculado con la tasa de hoy. Sin
 * contexto: la pagina de seguimiento vive fuera del catalogo.
 */
export function MontoCongelado({ valor, principal, secundario = null, monedaSecundaria = null, className = "" }) {
  const p = textoPrincipal(valor, principal);
  if (secundario == null || !monedaSecundaria) return <>{p}</>;
  return (
    <span className={`cp-monto ${className}`.trim()}>
      <span className="cp-monto__p">{p}</span>
      <span className="cp-monto__s">{formatearMonto(secundario, monedaSecundaria)}</span>
    </span>
  );
}

/** Linea de la tasa ("1 USD = Bs. 800,00 · tasa del 16/11/2026"). null si el tenant no tiene secundaria. */
export function AvisoTasa({ className = "" }) {
  const { aviso } = useMoneda();
  if (!aviso) return null;
  return (
    <p className={`cp-aviso-tasa cp-aviso-tasa--${aviso.nivel} ${className}`.trim()} role="note">{aviso.texto}</p>
  );
}
