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
 * El resultado del dia (0103). La sucursal y los dias son los de los tests de
 * platformResultado: el dia con una linea de cada (y ganancia NEGATIVA), el
 * dia real de Crazy Miga del 13/oct y un dia sin movimientos, que es el caso
 * normal de una sucursal recien dada de alta.
 */
const SUCURSAL = { id: 'b', name: 'Casa central', timezone: 'America/Argentina/Buenos_Aires' };

const RESULTADO_COMPLETO = {
  dia: '2026-10-15', ventas: 15000, descuentos: 1000, costo_mercaderia: 3800,
  lineas_sin_costo: 1, tickets: 2, nomina: 8000, horas: 4, merma: 1300,
  gastos_del_dia: 2000, gastos_fijos: 1000, ganancia_neta: -2100,
};

const RESULTADO_CRAZY_MIGA = {
  dia: '2026-10-13', ventas: 151000, descuentos: 0, costo_mercaderia: 43574.6,
  lineas_sin_costo: 0, tickets: 3, nomina: 0, horas: 0, merma: 0,
  gastos_del_dia: 0, gastos_fijos: 0, ganancia_neta: 107425.4,
};

const RESULTADO_VACIO = {
  dia: '2026-10-20', ventas: 0, descuentos: 0, costo_mercaderia: 0,
  lineas_sin_costo: 0, tickets: 0, nomina: 0, horas: 0, merma: 0,
  gastos_del_dia: 0, gastos_fijos: 0, ganancia_neta: 0,
};

// La perdida de 7 cifras: la cifra va sin cortes de linea y a 390px no
// puede desbordar.
const RESULTADO_PERDIDA_GRANDE = {
  dia: '2026-10-18', ventas: 1234567.89, descuentos: 0, costo_mercaderia: 0,
  lineas_sin_costo: 0, tickets: 412, nomina: 0, horas: 120, merma: 0,
  gastos_del_dia: 2469135.78, gastos_fijos: 0, ganancia_neta: -1234567.89,
};

// El preview pinta el primer render (no corre efectos): el `cargar` queda por
// si la muestra se monta en un navegador, y `resultadoInicial` es lo que se ve.
const cargarMuestra = (r) => async () => ({ ok: true, data: r });

/**
 * Cada entrada declara que componente montar, con que props y a que anchos
 * mirarlo. `anchos` son los que de verdad cambian el layout, no una lista de
 * dispositivos: mirar a 1440 y a 1366 no dice nada nuevo.
 */
// Pedidos de Cochi (USD + VES): uno con el envio por confirmar, abierto para
// cargar el costo, y uno ya cerrado con su total final en las dos monedas.
// Cada uno con un origen distinto (catalogo, WhatsApp, telefono): la etiqueta
// del origen se mira en la tarjeta cerrada y en la abierta.
const PEDIDO_BASE = {
  tenant_id: 't', status: 'new', channel: 'catalog', customer_phone: '584141234567', delivery: 'envio',
  delivery_address: 'Av. Francisco de Miranda 100, Caracas', payment: 'efectivo', discount: 0, tip_amount: 0,
  created_at: '2026-11-16T15:10:00Z',
};
const PEDIDOS_COCHI = [
  { ...PEDIDO_BASE, id: 'p1', customer_name: 'Ana Prueba', subtotal: 17, total: 17, delivery_cost: 0, delivery_pending: true,
    fx_rate: 798.5724, fx_currency: 'VES', total_secondary: 13575.73 },
  { ...PEDIDO_BASE, id: 'p2', customer_name: 'Luis Pérez', subtotal: 8.5, total: 11.5, delivery_cost: 3, delivery_pending: false,
    fx_rate: 798.5724, fx_currency: 'VES', total_secondary: 9183.58, created_at: '2026-11-16T14:40:00Z',
    channel: 'manual_whatsapp' },
  { ...PEDIDO_BASE, id: 'p3', customer_name: 'María Fernanda Rodríguez de los Ángeles', status: 'preparing',
    delivery: 'retiro', delivery_address: null, subtotal: 9.5, total: 9.5, delivery_cost: 0, delivery_pending: false,
    fx_rate: 798.5724, fx_currency: 'VES', total_secondary: 7586.44, created_at: '2026-11-16T15:25:00Z',
    channel: 'manual_telefono' },
];

// Carga a mano (Cochi). La carta tiene el nombre largo que no entra, un
// producto con opciones obligatorias (la proteina) y extras con precio, uno
// con opciones solo opcionales y categorias de sobra para el scroll de chips.
const PROTEINA = {
  id: 'g-prot', name: 'Elegí la proteína', type: 'single', required: true,
  choices: [
    { id: 'pollo', label: 'Pollo a la brasa' },
    { id: 'mechada', label: 'Carne mechada' },
    { id: 'cochino', label: 'Cochino frito', price: 1.5 },
  ],
};
const EXTRAS = {
  id: 'g-extras', name: 'Extras', type: 'multiple', required: false, max: 3,
  choices: [
    { id: 'tostones', label: 'Tostones', price: 1.5 },
    { id: 'guayanes', label: 'Queso guayanés', price: 2 },
    { id: 'aguacate', label: 'Aguacate', price: 1 },
    { id: 'ajo', label: 'Salsa de ajo', price: 0.5, max_qty: 3 },
  ],
};
const prod = (o) => ({ active: true, is_archived: false, type: 'product', image_url: null, option_groups: [], ...o });
const CARTA_COCHI = [
  prod({ id: 'b3', name: 'Bandeja 3 carnes', price: 12, category: 'Bandejas', option_groups: [PROTEINA, EXTRAS] }),
  prod({ id: 'bc', name: 'Bandeja criolla con arroz, caraotas, tajadas y huevo frito (para compartir)', price: 18.5, category: 'Bandejas' }),
  prod({ id: 'bi', name: 'Bandeja infantil', price: 7, category: 'Bandejas' }),
  prod({ id: 'ap', name: 'Arepa de pabellón', price: 5.5, category: 'Arepas', option_groups: [EXTRAS] }),
  prod({ id: 'ar', name: 'Arepa reina pepiada', price: 5, category: 'Arepas' }),
  prod({ id: 'ca', name: 'Cachapa con queso de mano', price: 6.5, category: 'Cachapas' }),
  prod({ id: 'te', name: 'Tequeños (6 u.)', price: 5, category: 'Para picar' }),
  prod({ id: 'pa', name: 'Papelón con limón', price: 2, category: 'Bebidas' }),
  prod({ id: 'ma', name: 'Malta', price: 1.5, category: 'Bebidas' }),
  prod({ id: 'qu', name: 'Quesillo', price: 3, category: 'Postres' }),
  // No se cargan: inactivo y servicio con turno.
  prod({ id: 'x1', name: 'Hallaca (temporada)', price: 4, category: 'Arepas', active: false }),
];
const SETTINGS_COCHI = {
  payment_accounts: [
    { id: 'c1', label: 'Pago móvil', banco: 'Banesco', moneda: 'VES', active: true, scope: 'clientes' },
    { id: 'c2', label: 'Zelle', banco: 'Bank of America', moneda: 'USD', active: true },
    { id: 'c3', label: 'Pagos a proveedores', banco: 'Mercantil', moneda: 'VES', active: true, scope: 'proveedores' },
  ],
};
const MONEDA_COCHI = { monedaPrincipal: 'USD', monedaSecundaria: 'VES', tasa: 798.5724, vencida: false, fecha: '2026-11-26' };
const CARRITO_COCHI = [
  { productoId: 'b3', qty: 1, seleccion: [{ groupId: 'g-prot', choiceId: 'pollo', qty: 1 }, { groupId: 'g-extras', choiceId: 'tostones', qty: 1 }] },
  { productoId: 'bi', qty: 2 },
];
const NUEVO_PEDIDO = {
  productos: CARTA_COCHI, settings: SETTINGS_COCHI, moneda: MONEDA_COCHI, tenantSlug: 'cochi', sinPortal: true,
};

export const MUESTRAS = {
  'nuevo-pedido-productos': {
    modulo: 'src/components/admin/platform/NuevoPedido.jsx',
    titulo: 'Nuevo pedido · productos (Bandejas, 2 líneas)',
    props: { ...NUEVO_PEDIDO, estadoInicial: { categoria: 'Bandejas', carrito: CARRITO_COCHI } },
    anchos: [390],
  },
  'nuevo-pedido-opciones': {
    modulo: 'src/components/admin/platform/NuevoPedido.jsx',
    titulo: 'Nuevo pedido · opciones obligatorias sin elegir',
    props: {
      ...NUEVO_PEDIDO,
      estadoInicial: {
        carrito: CARRITO_COCHI, productoAbiertoId: 'b3', intentoFicha: true,
        opciones: { 'g-extras': { tostones: 1, ajo: 2 } },
      },
    },
    anchos: [390],
  },
  'nuevo-pedido-datos': {
    modulo: 'src/components/admin/platform/NuevoPedido.jsx',
    titulo: 'Nuevo pedido · datos con errores',
    props: {
      ...NUEVO_PEDIDO,
      estadoInicial: {
        paso: 'datos', carrito: CARRITO_COCHI, intentado: true,
        form: { cliente: 'María Fernanda Rodríguez de los Ángeles', telefono: '0414', entrega: 'envio', pago: 'c1' },
      },
    },
    anchos: [390],
  },
  'pedidos-envio': {
    modulo: 'src/components/admin/platform/OrdersPanel.jsx',
    titulo: 'Pedidos · envío por confirmar (USD + VES)',
    props: {
      orders: PEDIDOS_COCHI, loading: false, tenantId: 't', hayTurnoAbierto: true,
      moneda: { monedaPrincipal: 'USD', monedaSecundaria: 'VES' },
      abiertoId: 'p1',
      itemsIniciales: [{ id: 'i1', name_snapshot: 'Bandeja 3 carnes · Alitas', qty: 1, unit_price: 17, subtotal: 17 }],
    },
    anchos: [390],
  },
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
  comandera: {
    modulo: 'src/components/admin/platform/ComanderaPanel.jsx',
    titulo: 'Comandera · el sector que despacha en papel',
    props: {
      sector: SECTORES[1],
      porImprimir: TICKETS
        .map(t => ({ ...t, order_items: t.order_items.filter(i => i.sector_id === 'sec-barra') }))
        .filter(t => t.order_items.length)
        .slice(0, 2),
      abiertas: TICKETS
        .map(t => ({
          ...t,
          order_items: t.order_items.filter(i => i.sector_id === 'sec-barra'),
          printed_at: t.kitchen_at,
          impresiones: 1,
        }))
        .filter(t => t.order_items.length)
        .slice(2, 4),
      ahoraFijo: AHORA_KDS,
    },
    anchos: [1100, 700],
  },
  // Paris (plan 'digital'): la venta del dia se ve, la ganancia queda en el
  // bloqueo con el CTA a los planes.
  'resultado-dia-paris': {
    modulo: 'src/components/admin/platform/ResultadoDelDia.jsx',
    titulo: 'Ventas · Hoy · Paris sin ganancia',
    props: { sucursal: SUCURSAL, cargar: cargarMuestra(RESULTADO_CRAZY_MIGA), resultadoInicial: RESULTADO_CRAZY_MIGA, verGanancia: false },
    anchos: [390, 900],
  },
  'resultado-dia': {
    modulo: 'src/components/admin/platform/ResultadoDelDia.jsx',
    titulo: 'Ventas · Hoy · día completo con pérdida',
    props: { sucursal: SUCURSAL, cargar: cargarMuestra(RESULTADO_COMPLETO), resultadoInicial: RESULTADO_COMPLETO },
    anchos: [390, 900],
  },
  'resultado-dia-crazy-miga': {
    modulo: 'src/components/admin/platform/ResultadoDelDia.jsx',
    titulo: 'Ventas · Hoy · Crazy Miga 13/oct',
    props: { sucursal: SUCURSAL, cargar: cargarMuestra(RESULTADO_CRAZY_MIGA), resultadoInicial: RESULTADO_CRAZY_MIGA },
    anchos: [390, 900],
  },
  'resultado-dia-perdida-grande': {
    modulo: 'src/components/admin/platform/ResultadoDelDia.jsx',
    titulo: 'Ventas · Hoy · pérdida de 7 cifras',
    props: { sucursal: SUCURSAL, cargar: cargarMuestra(RESULTADO_PERDIDA_GRANDE), resultadoInicial: RESULTADO_PERDIDA_GRANDE },
    anchos: [390],
  },
  'resultado-dia-vacio': {
    modulo: 'src/components/admin/platform/ResultadoDelDia.jsx',
    titulo: 'Ventas · Hoy · sin movimientos',
    props: { sucursal: SUCURSAL, cargar: cargarMuestra(RESULTADO_VACIO), resultadoInicial: RESULTADO_VACIO },
    anchos: [390],
  },
  'resultado-dia-cargando': {
    modulo: 'src/components/admin/platform/ResultadoDelDia.jsx',
    titulo: 'Ventas · Hoy · cargando',
    props: { sucursal: SUCURSAL, cargar: cargarMuestra(RESULTADO_VACIO) },
    anchos: [390],
  },
  conteo: {
    modulo: 'src/components/admin/platform/ConteoDeDeposito.jsx',
    titulo: 'Conteo de depósito · mobile',
    props: { tenantId: 't', insumos: INSUMOS, cierreEnTexto: 'cierre en 3 h 20 m' },
    anchos: [390],
  },
};
