// src/catalog-pro/plantillas/PopProductoCard.jsx
// Tarjeta de producto. `v` es la vista armada en PlantillaPop
// ({ raw, id, name, desc, price, oldPrice, img, soldOut, disp, tag }).
// Agregar solo si el producto se puede pedir hoy; si no, una etiqueta.
import PrecioCatalogo from "./PrecioCatalogo";

export default function PopProductoCard({ v, moneda, cantidadDe, grande = false, onAgregar, onQuitar, onAbrir }) {
  const cantidad = cantidadDe?.(v.id) || 0;
  const puede = v.disp.puede && !v.soldOut;
  const etiqueta = v.soldOut ? "AGOTADO" : v.disp.etiqueta;
  const chip = etiqueta
    ? <span className="pop-card__estado">{etiqueta}</span>
    : (v.tag && <span className="pop-card__tag">{v.tag}</span>);
  return (
    <article className={`pop-card${grande ? " pop-card--grande" : ""}${puede ? "" : " pop-card--off"}${v.img ? "" : " pop-card--sinfoto"}`} data-revelar>
      <button type="button" className="pop-card__foto" onClick={() => onAbrir?.(v.raw)} aria-label={`Ver detalle de ${v.name}${etiqueta ? ` (${etiqueta.toLowerCase()})` : ""}`}>
        {v.img
          ? <img src={v.img} alt="" width="480" height="360" loading="lazy" decoding="async" />
          : <span className="pop-card__sinfoto" aria-hidden="true">{Array.from(v.name)[0] || "•"}</span>}
        {v.img && chip}
      </button>
      <div className="pop-card__cuerpo">
        {!v.img && chip}
        <h3 className="pop-card__nombre">{v.name}</h3>
        {v.desc && <p className="pop-card__desc">{v.desc}</p>}
        <div className="pop-card__pie">
          {v.price > 0 && <PrecioCatalogo monto={v.price} viejo={v.oldPrice} moneda={moneda} grande={grande} />}
          {puede && cantidad === 0 && (
            <button type="button" className="pop-btn pop-btn--primario" onClick={() => onAgregar?.(v.raw)} aria-label={`Agregar ${v.name}`}>Agregar</button>
          )}
          {puede && cantidad > 0 && (
            <span className="pop-stepper" role="group" aria-label={`Cantidad de ${v.name}`}>
              <button type="button" className="pop-stepper__b" onClick={() => onQuitar?.(v.raw)} aria-label={`Quitar una unidad de ${v.name}`}>−</button>
              <span className="pop-stepper__n" aria-live="polite">{cantidad}</span>
              <button type="button" className="pop-stepper__b" onClick={() => onAgregar?.(v.raw)} aria-label={`Sumar una unidad de ${v.name}`}>+</button>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
