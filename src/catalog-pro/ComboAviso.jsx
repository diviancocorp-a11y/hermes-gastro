// src/catalog-pro/ComboAviso.jsx
// "¿Lo hacés combo? + Papas fritas por $1": aviso chico, no bloqueante, que
// aparece al agregar de un toque un producto con sugerencia vigente. Suma la
// sugerencia como linea propia (misma que desde la ficha) o se descarta; si
// nadie lo toca se va solo.
import { useEffect } from "react";

const DURACION_MS = 9000;

export default function ComboAviso({ sugerencia, formato, onSumar, onCerrar }) {
  useEffect(() => {
    if (!sugerencia) return undefined;
    const t = setTimeout(onCerrar, DURACION_MS);
    return () => clearTimeout(t);
  }, [sugerencia, onCerrar]);

  if (!sugerencia) return null;
  const { product, unitPrice, qty } = sugerencia;
  return (
    <div className="cp-root cp-combo-aviso" role="status" aria-live="polite" data-testid="combo-aviso">
      <div className="cp-combo-aviso__texto">
        <strong>¿Lo hacés combo?</strong>
        <span>+ {qty > 1 ? `${qty} x ` : ""}{product.name} por {formato(unitPrice * qty)}</span>
      </div>
      <button type="button" className="cp-combo-aviso__sumar" onClick={onSumar}>Sumar</button>
      <button type="button" className="cp-combo-aviso__cerrar" onClick={onCerrar} aria-label="No, gracias">✕</button>
    </div>
  );
}
