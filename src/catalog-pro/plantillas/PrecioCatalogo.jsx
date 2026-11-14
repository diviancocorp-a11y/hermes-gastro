// src/catalog-pro/plantillas/PrecioCatalogo.jsx
// Precio principal y, si el negocio tiene moneda secundaria con tasa, su
// equivalente. Todo el formato sale de precios.js / moneda.js.
import { precioDoble } from "./precios";

export default function PrecioCatalogo({ monto, moneda, viejo = null, grande = false }) {
  const p = precioDoble(monto, moneda);
  const antes = viejo != null ? precioDoble(viejo, moneda).principal : null;
  return (
    <span className={`pop-precio${grande ? " pop-precio--grande" : ""}`}>
      <span className="pop-precio__p">{p.principal}</span>
      {p.secundario && <span className="pop-precio__s">{p.secundario}</span>}
      {antes && <s className="pop-precio__antes"><span className="pop-sr">Antes </span>{antes}</s>}
    </span>
  );
}
