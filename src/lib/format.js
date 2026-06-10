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
