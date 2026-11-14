// src/catalog-pro/plantillas/precios.js
// Precio en la moneda principal del tenant y, si tiene secundaria y hay tasa,
// su equivalente. La moneda y el formato salen de `tenant.currency` /
// `secondary_currency` y de src/lib/moneda.js: ningun simbolo ni locale aca.

import { aSecundaria, formatearMonto } from '../../lib/moneda';

/**
 * @returns {{principal:string, secundario:string|null, estado:'sin-secundaria'|'sin-tasa'|'ok'|'vencida'}}
 */
export function precioDoble(monto, { principal, secundaria, tasa } = {}) {
  const base = formatearMonto(monto, principal);
  if (!secundaria) return { principal: base, secundario: null, estado: 'sin-secundaria' };
  const conv = tasa ? aSecundaria(monto, tasa.rate) : null;
  if (conv == null) return { principal: base, secundario: null, estado: 'sin-tasa' };
  return { principal: base, secundario: formatearMonto(conv, secundaria), estado: tasa.vencida ? 'vencida' : 'ok' };
}

/** Linea de estado de la tasa para el menu (null si no aplica). */
export function avisoDeTasa(tasa, { principal, secundaria } = {}) {
  if (!secundaria) return null;
  if (!tasa) return { nivel: 'aviso', texto: `Los precios base están en ${principal}. La conversión a ${secundaria} no está disponible por ahora.` };
  const [y, m, d] = tasa.fecha.split('-');
  const linea = `1 ${principal} = ${formatearMonto(tasa.rate, secundaria)} · tasa del ${d}/${m}/${y}`;
  return tasa.vencida
    ? { nivel: 'aviso', texto: `Tasa por verificar: ${linea}.` }
    : { nivel: 'info', texto: linea };
}
