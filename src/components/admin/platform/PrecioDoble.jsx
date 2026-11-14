/**
 * PrecioDoble — precio del producto en la moneda principal y, al lado, su
 * equivalente en la secundaria. Se guarda SOLO el principal (no hay columna
 * nueva): tipear en la secundaria lo convierte con la tasa.
 *
 * Mientras la persona tipea en la secundaria, ese campo muestra lo que tipeo
 * y no el valor recalculado: el redondeo ida y vuelta (Bs. -> USD a 2
 * decimales -> Bs.) lo haria saltar. Al salir del campo vuelve a derivarse.
 *
 * Sin moneda secundaria no renderiza nada extra: el campo de siempre.
 */
import { useState } from 'react';
import { aPrincipal, aSecundaria, formatearMonto } from '../../../lib/moneda';
import { fechaLegible } from '../../../services/platformTasas';

const NOMBRES = { USD: 'dólares', VES: 'bolívares', ARS: 'pesos' };

export default function PrecioDoble({ value, onChange, moneda, inputStyle, labelStyle }) {
  const [textoSec, setTextoSec] = useState(null); // null = el campo no se esta tipeando
  const sec = moneda?.monedaSecundaria || null;

  const principal = (
    <div style={{ flex: 1 }}>
      <label style={labelStyle} htmlFor="pe-price">
        Precio{sec ? ` (${moneda.monedaPrincipal})` : ''}
      </label>
      <input
        id="pe-price" style={inputStyle} type="number" inputMode="decimal" min="0" step="0.01"
        value={value} onChange={e => { setTextoSec(null); onChange(e.target.value); }} placeholder="0"
      />
    </div>
  );
  if (!sec) return principal;

  const hayTasa = moneda.tasa > 0;
  const derivado = hayTasa && value !== '' && value != null ? aSecundaria(value, moneda.tasa) : null;
  // En reposo se ve con el formato de la moneda (4.312,27); al enfocar pasa a
  // forma editable (4312,27) para que el punto de miles no se lea como decimal.
  const editable = derivado == null ? '' : String(derivado).replace('.', ',');
  const enReposo = derivado == null ? '' : derivado.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mostrado = textoSec !== null ? textoSec : enReposo;

  // Texto y no type=number: en un number, "1000," llega vacio al onChange y
  // borraria lo tipeado; ademas quien tipea Bs. usa la coma.
  const alTipear = (txt) => {
    if (!/^\d*[.,]?\d*$/.test(txt)) return;
    setTextoSec(txt);
    if (txt === '') { onChange(''); return; }
    const p = aPrincipal(txt.replace(',', '.'), moneda.tasa);
    if (p != null) onChange(String(p));
  };

  const aviso = !hayTasa
    ? 'Sin tasa cargada: no se puede convertir. Cargala en Configuración → Finanzas → Tasa del día. Podés guardar igual.'
    : moneda.vencida
      ? `La tasa es del ${fechaLegible(moneda.fecha)}: puede estar desactualizada. Podés guardar igual.`
      : `Tasa ${formatearMonto(moneda.tasa, sec).replace(/^Bs\. /, '')} ${sec} por ${moneda.monedaPrincipal}. Se guarda el precio en ${NOMBRES[moneda.monedaPrincipal] || moneda.monedaPrincipal}.`;

  return (
    <>
      {principal}
      <div style={{ flex: 1 }}>
        <label style={labelStyle} htmlFor="pe-price-sec">Precio ({sec})</label>
        <input
          id="pe-price-sec" style={inputStyle} type="text" inputMode="decimal" autoComplete="off"
          value={mostrado} disabled={!hayTasa}
          onChange={e => alTipear(e.target.value)}
          onFocus={() => setTextoSec(editable)}
          onBlur={() => setTextoSec(null)}
          aria-describedby="pe-price-sec-aviso" placeholder="0"
        />
      </div>
      <div
        id="pe-price-sec-aviso" className="pe-precio-aviso" role={hayTasa && !moneda.vencida ? undefined : 'status'}
        data-estado={!hayTasa ? 'sin' : moneda.vencida ? 'vencida' : 'ok'}
      >{aviso}</div>
    </>
  );
}
