// src/lib/moneda.js
// Doble moneda: el precio vive en la moneda principal del negocio (USD para
// Cochi) y la secundaria (VES) se calcula con la tasa. Puro, sin React.
//
// `rate` = unidades de la secundaria por 1 de la principal (Bs. por dolar).
// No toca fmtAR (src/lib/format.js): ese sigue siendo el "$ es-AR" de siempre.

/** UNICO lugar del redondeo: 2 decimales, mitad hacia arriba (en valor
 *  absoluto), tolerante al error binario (1.005 -> 1.01). */
export function redondear(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const signo = x < 0 ? -1 : 1;
  return signo * Math.round((Math.abs(x) + Number.EPSILON) * 100) / 100;
}

const tasaValida = (rate) => Number.isFinite(Number(rate)) && Number(rate) > 0;

/** Monto en la principal -> secundaria. Sin tasa valida devuelve null. */
export function aSecundaria(monto, rate) {
  return tasaValida(rate) ? redondear(Number(monto) * Number(rate)) : null;
}

/** Monto en la secundaria (ej. lo que tipeo alguien en Bs.) -> principal. */
export function aPrincipal(monto, rate) {
  return tasaValida(rate) ? redondear(Number(monto) / Number(rate)) : null;
}

const FORMATOS = {
  USD: { locale: 'en-US', prefijo: '$' },
  VES: { locale: 'es-VE', prefijo: 'Bs. ' },
};

/** Formato por moneda: USD "$9.00", VES "Bs. 7.985,72", ARS como fmtAR ("$1.234,5"). */
export function formatearMonto(monto, moneda) {
  const n = Number(monto || 0);
  if (moneda === 'ARS') return '$' + n.toLocaleString('es-AR');
  const f = FORMATOS[moneda];
  if (!f) return `${moneda || ''} ${redondear(n).toFixed(2)}`.trim();
  const txt = Math.abs(redondear(n)).toLocaleString(f.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
  return (n < 0 ? '-' : '') + f.prefijo + txt;
}

const dia = (d, zona) => new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const aDias = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };

/**
 * ¿La tasa quedo vieja? Cuenta dias calendario en la zona del negocio entre
 * la vigencia ('YYYY-MM-DD' o Date) y hoy; vencida si pasan mas de `maxDias`.
 * Default 3: el BCV no publica sabados ni domingos, y un feriado se suma.
 */
export function tasaVencida(fechaVigencia, hoy = new Date(), zona = 'America/Caracas', maxDias = 3) {
  if (!fechaVigencia) return true;
  const desde = typeof fechaVigencia === 'string' ? fechaVigencia.slice(0, 10) : dia(fechaVigencia, zona);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return true;
  return aDias(dia(hoy, zona)) - aDias(desde) > maxDias;
}
