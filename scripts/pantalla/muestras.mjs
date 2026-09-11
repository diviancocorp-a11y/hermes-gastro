// scripts/pantalla/muestras.mjs
//
// Los datos de muestra de cada pantalla, en UN solo lugar.
//
// POR QUE NO SE INVENTAN EN CADA PREVIEW
// Al mirar Stock la primera vez, los datos eran los del render de Ricky. Eso
// esta bien para comparar contra el render, y mal para todo lo demas: no tenia
// ningun insumo sin minimo, que es el caso REAL del edificio hoy. El caso que
// no esta en la muestra es el que no se mira.
//
// Cada muestra tiene que incluir, ademas de lo bonito:
//   - el caso vacio o sin dato (que hoy es el normal en el edificio)
//   - el nombre largo que no entra
//   - el numero grande que desborda la celda
//
// COMO SE AGREGA UNA PANTALLA
// Un export mas en `MUESTRAS`, con la forma que espera el componente. Si la
// pantalla necesita props que no son datos (callbacks, textos), van en
// `props`; el preview les pone una funcion vacia a las que falten.

const insumo = (o) => ({
  tenant_id: 't', supplier_id: null, is_archived: false,
  category: null, unit: 'u', cost: 0, stock: 0, min_stock: 0, ...o,
});

export const INSUMOS = [
  insumo({ id: '1', name: 'Muzzarella',            category: 'Lácteos',   unit: 'kg', stock: 2.5, min_stock: 8,   cost: 8500 }),
  insumo({ id: '2', name: 'Carne picada especial', category: 'Proteínas', unit: 'kg', stock: 4,   min_stock: 10,  cost: 12000 }),
  insumo({ id: '3', name: 'Papa para bastón',      category: 'Vegetales', unit: 'kg', stock: 11,  min_stock: 20,  cost: 1500 }),
  insumo({ id: '4', name: 'Pan de hamburguesa',    category: 'Secos',     unit: 'u',  stock: 36,  min_stock: 60,  cost: 400 }),
  insumo({ id: '5', name: 'Tomate perita',         category: 'Vegetales', unit: 'kg', stock: 18,  min_stock: 12,  cost: 1300 }),
  insumo({ id: '6', name: 'Cerveza artesanal IPA', category: 'Bebidas',   unit: 'u',  stock: 84,  min_stock: 48,  cost: 2100 }),
  insumo({ id: '7', name: 'Aceite de girasol',     category: 'Secos',     unit: 'L',  stock: 45,  min_stock: 25,  cost: 2700 }),
  insumo({ id: '8', name: 'Caja delivery mediana', category: 'Packaging', unit: 'u',  stock: 320, min_stock: 150, cost: 300 }),
  // El caso REAL del edificio hoy: sin minimo cargado. No se puede medir.
  insumo({ id: '9', name: 'Orégano seco',          category: 'Secos',     unit: 'g',  stock: 400, min_stock: 0,   cost: 12 }),
  // El nombre que no entra y el numero que desborda.
  insumo({ id: '10', name: 'Queso azul de oveja estacionado 9 meses', category: 'Lácteos', unit: 'kg', stock: 1.25, min_stock: 6, cost: 48500 }),
];

/**
 * Cada entrada declara que componente montar, con que props y a que anchos
 * mirarlo. `anchos` son los que de verdad cambian el layout, no una lista de
 * dispositivos: mirar a 1440 y a 1366 no dice nada nuevo.
 */
export const MUESTRAS = {
  stock: {
    modulo: 'src/components/admin/platform/StockPanel.jsx',
    titulo: 'Stock · escritorio',
    // Con la ficha abierta: el panel derecho es la mitad de la pantalla y
    // un render sin seleccion no lo muestra nunca.
    props: { tenantId: 't', insumos: INSUMOS, seleccionadoInicial: '1' },
    anchos: [1340, 900, 560],
  },
  conteo: {
    modulo: 'src/components/admin/platform/ConteoDeDeposito.jsx',
    titulo: 'Conteo de depósito · mobile',
    props: { tenantId: 't', insumos: INSUMOS, cierreEnTexto: 'cierre en 3 h 20 m' },
    anchos: [390],
  },
};
