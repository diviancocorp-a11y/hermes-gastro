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



/** Sectores y estaciones, como los deja "crear cocina y barra". */
export const SECTORES = [
  {
    id: 'sec-cocina', name: 'Cocina', mode: 'pantalla', umbral_min: 18, orden: 0,
    estaciones: [
      { id: 'e-par', sector_id: 'sec-cocina', name: 'Parrilla', short_name: 'PAR', orden: 0 },
      { id: 'e-pla', sector_id: 'sec-cocina', name: 'Plancha', short_name: 'PLA', orden: 1 },
      { id: 'e-fri', sector_id: 'sec-cocina', name: 'Fríos', short_name: 'FRÍ', orden: 2 },
      { id: 'e-pos', sector_id: 'sec-cocina', name: 'Postres', short_name: 'POS', orden: 3 },
    ],
  },
  {
    id: 'sec-barra', name: 'Barra', mode: 'papel', umbral_min: 5, orden: 1,
    estaciones: [
      { id: 'e-bar', sector_id: 'sec-barra', name: 'Barra', short_name: 'BAR', orden: 0 },
    ],
  },
];

const EST = { Parrilla: 'e-par', Plancha: 'e-pla', 'Fríos': 'e-fri', Postres: 'e-pos', Barra: 'e-bar' };
const SEC = { 'e-bar': 'sec-barra' };

/**
 * Los tickets del KDS. El reloj va FIJO: sin eso la vista previa cambia en
 * cada corrida y dos capturas del mismo diseño no se pueden comparar.
 */
export const AHORA_KDS = new Date('2026-09-11T22:00:00');

const haceMin = (m) => new Date(AHORA_KDS.getTime() - m * 60000).toISOString();

const plato = (o) => {
  const p = {
    id: o.id, order_id: o.order_id, tenant_id: 't',
    qty: 1, station: null, note: null, ready_at: null,
    created_at: '2026-09-11T21:00:00Z', ...o,
  };
  // El id de estacion sale del nombre, como lo hace el trigger 0074 al
  // insertar el item: asi la muestra no puede quedar desfasada del modelo.
  p.station_id = p.station_id || EST[p.station] || null;
  p.sector_id = p.sector_id || SEC[p.station_id] || (p.station_id ? 'sec-cocina' : null);
  return p;
};

const tk = (o) => ({
  tenant_id: 't', branch_id: 'b', status: 'preparing',
  channel: null, delivery: null, delivery_date: null, customer_name: null,
  note: null, allergy_note: null, diners: null, staff_id: null,
  resource_id: null, ready_at: null, created_at: haceMin(90), ...o,
});

export const TICKETS = [
  tk({
    id: 't1', titulo: 'Mesa 7', resource_id: 'm7', staff_nombre: 'Lucía',
    diners: 6, ticket_number: 7, kitchen_at: haceMin(19.1),
    allergy_note: 'Alergia: frutos secos',
    order_items: [
      plato({ id: 'i1', order_id: 't1', qty: 2, name_snapshot: 'Milanesa napolitana', note: 'a punto · sin jamón en una', station: 'Plancha' }),
      plato({ id: 'i2', order_id: 't1', name_snapshot: 'Provoleta', note: 'con orégano', station: 'Parrilla' }),
      plato({ id: 'i3', order_id: 't1', name_snapshot: 'Ensalada de estación', station: 'Fríos' }),
    ],
  }),
  tk({
    id: 't2', titulo: 'Pedido 12', staff_nombre: 'Bruno', delivery: 'takeaway',
    ticket_number: 12, kitchen_at: haceMin(11.1),
    order_items: [
      plato({ id: 'i4', order_id: 't2', name_snapshot: 'Bife de chorizo', note: 'jugoso', station: 'Parrilla' }),
      plato({ id: 'i5', order_id: 't2', qty: 2, name_snapshot: 'Papas rústicas', station: 'Plancha' }),
    ],
  }),
  tk({
    id: 't3', titulo: 'Mesa 3', resource_id: 'm3', staff_nombre: 'Nahuel',
    diners: 4, ticket_number: 3, kitchen_at: haceMin(5.1),
    order_items: [
      plato({ id: 'i6', order_id: 't3', qty: 3, name_snapshot: 'Empanadas de carne', station: 'Plancha' }),
      plato({ id: 'i7', order_id: 't3', name_snapshot: 'Asado de tira', note: 'bien cocido', station: 'Parrilla' }),
      plato({ id: 'i8', order_id: 't3', qty: 2, name_snapshot: 'Flan con dulce', note: 'uno sin crema', station: 'Postres' }),
    ],
  }),
  tk({
    id: 't4', titulo: 'Delivery 87', delivery: 'envio', customer_name: 'Retira el cadete',
    ticket_number: 87, kitchen_at: haceMin(2.1), allergy_note: 'Celíaca',
    order_items: [
      plato({ id: 'i9', order_id: 't4', name_snapshot: 'Pollo a la plancha', note: 'sin sal', station: 'Plancha' }),
      plato({ id: 'i10', order_id: 't4', name_snapshot: 'Ensalada césar', note: 'sin croutons', station: 'Fríos' }),
    ],
  }),
  tk({
    id: 't5', titulo: 'Mesa 12', resource_id: 'm12', staff_nombre: 'Sol',
    delivery_date: '2026-09-12', ticket_number: 12, kitchen_at: haceMin(0.77),
    order_items: [
      plato({ id: 'i11', order_id: 't5', qty: 4, name_snapshot: 'Vacío al horno', note: 'dos a punto, dos jugosos', station: 'Parrilla' }),
      plato({ id: 'i12', order_id: 't5', qty: 2, name_snapshot: 'Limonada', note: 'con jengibre', station: 'Barra' }),
    ],
  }),
  tk({
    id: 't6', titulo: 'Pedido 13', staff_nombre: 'Ana', delivery: 'takeaway',
    ticket_number: 13, kitchen_at: haceMin(0.44),
    order_items: [
      plato({ id: 'i13', order_id: 't6', name_snapshot: 'Sándwich de lomo', note: 'completo, sin huevo', station: 'Plancha' }),
    ],
  }),
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
  kds: {
    modulo: 'src/components/admin/platform/KdsPanel.jsx',
    titulo: 'KDS · cocina TV',
    props: {
      tickets: TICKETS.map(t => ({ ...t, order_items: t.order_items.filter(i => i.sector_id === 'sec-cocina') })).filter(t => t.order_items.length),
      estaciones: SECTORES[0].estaciones,
      modo: 'tv', columnas: 5, umbralMin: 18, ahoraFijo: AHORA_KDS,
      nombreDePantalla: 'Cocina · pantalla 1',
    },
    anchos: [1340, 900],
  },
  'kds-tablet': {
    modulo: 'src/components/admin/platform/KdsPanel.jsx',
    titulo: 'KDS · tablet de mesada',
    props: {
      tickets: TICKETS.map(t => ({ ...t, order_items: t.order_items.filter(i => i.sector_id === 'sec-cocina') })).filter(t => t.order_items.length),
      estaciones: SECTORES[0].estaciones,
      modo: 'tablet', umbralMin: 18, ahoraFijo: AHORA_KDS,
    },
    anchos: [1280],
  },
  sectores: {
    modulo: 'src/components/admin/platform/SectoresPanel.jsx',
    titulo: 'Producción · sectores y estaciones',
    props: { sectores: SECTORES, productosSinEstacion: 66 },
    anchos: [980, 560],
  },
  'sectores-vacio': {
    modulo: 'src/components/admin/platform/SectoresPanel.jsx',
    titulo: 'Producción · sin configurar',
    props: { sectores: [], productosSinEstacion: 0 },
    anchos: [980],
  },
  conteo: {
    modulo: 'src/components/admin/platform/ConteoDeDeposito.jsx',
    titulo: 'Conteo de depósito · mobile',
    props: { tenantId: 't', insumos: INSUMOS, cierreEnTexto: 'cierre en 3 h 20 m' },
    anchos: [390],
  },
};
