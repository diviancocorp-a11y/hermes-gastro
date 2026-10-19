// src/lib/format.js
// Formato de moneda canonico (Sprint 3). Antes habia 4 implementaciones:
// fmtAR (catalog-pro), formatMoney/formatInt (lib/utils, admin), fmt local
// en monthReport e inlines sueltos. Este es el unico lugar para "$ es-AR".
//
//   fmtAR(1234.5)  -> "$1.234,5"   (entero o decimal, como venga)
//
// Para el admin siguen existiendo formatInt/formatMoney en lib/utils.jsx
// (formatos con reglas propias de decimales) — consolidarlos del todo es
// trabajo del refactor de Sprint 5.
export const fmtAR = (n) => "$" + Number(n || 0).toLocaleString("es-AR");

// Lo inverso: un monto tipeado a mano, en formato argentino, a numero.
//
//   parseMontoAR('1.500,50') -> 1500.5     punto de miles, coma decimal
//   parseMontoAR('12.500')   -> 12500      el punto con 3 cifras es de miles
//   parseMontoAR('1500.5')   -> 1500.5     teclado que solo trae punto
//   parseMontoAR('1,2,3')    -> NaN        ambiguo: no se adivina
//
// Number('1500,50') da NaN (y con `|| 0`, cero) y Number('12.500') da 12.5:
// abrir la caja con "1500,50" guardaba 0. Lo que no se entiende devuelve NaN
// para que la pantalla no deje confirmar; el vacio tambien, y cada pantalla
// decide si el vacio vale 0.
export function parseMontoAR(valor) {
  const s = String(valor ?? '').replace(/[\s$]/g, '');
  if (/^\d+$/.test(s)) return Number(s);
  // Coma decimal, con o sin puntos de miles bien agrupados.
  const coma = s.match(/^(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/);
  if (coma) return Number(`${coma[1].replace(/\./g, '')}.${coma[2]}`);
  // Solo puntos de miles: 12.500, 1.250.000.
  if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  // Un punto con 1 o 2 cifras es decimal.
  if (/^\d+\.\d{1,2}$/.test(s)) return Number(s);
  return NaN;
}
