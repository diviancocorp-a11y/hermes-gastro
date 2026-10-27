// Cada fila apunta al alcance existente del rubro: no crea otra oferta.
export const HERRAMIENTAS_RUBROS = {
  gastronomia: [
    { titulo: 'Atender sin idas y vueltas', items: [
      { fila: 0, nombre: 'Catálogo y pedidos', texto: 'Mostrás tu catálogo online y reunís los pedidos de salón, mostrador y delivery en Dico.' },
      { fila: 1, nombre: 'Mesas y comandas', texto: 'Organizás los pedidos del salón por mesa y seguís sus comandas desde el panel.' },
      { fila: 2, nombre: 'Cocina por sector', texto: 'Cada sector de cocina recibe en su pantalla las comandas que le corresponden.' },
    ] },
    { titulo: 'Saber qué queda y cuánto cuesta', items: [
      { fila: 3, nombre: 'Recetas y costo por plato', texto: 'Cargás los ingredientes de cada receta para calcular su costo con los porcentajes de merma y gastos configurados. Ese cálculo no incluye mano de obra.' },
      { fila: 4, nombre: 'Stock, compras y conteos', texto: 'Registrás compras y conteos para mantener las existencias de los ingredientes. También consultás el mínimo configurado para cada insumo.' },
      { fila: 5, nombre: 'Descuento por receta', texto: 'Al completar un pedido, Dico descuenta los insumos de su receta. Recibir el pedido o cobrarlo son acciones distintas.' },
    ] },
    { titulo: 'Entender los números', items: [
      { fila: 6, nombre: 'Caja y arqueo', texto: 'Registrás cobros por medio de pago y revisás el cierre de caja con su arqueo.' },
      { fila: 7, nombre: 'Fichaje y personal', texto: 'Registrás el fichaje del equipo y consultás su costo laboral por día.' },
      { fila: 8, nombre: 'Gastos y resultado del mes', texto: 'Registrás los gastos y consultás el resultado del mes con la información cargada en Dico.' },
      { fila: 9, nombre: 'Resultado diario por sucursal', texto: 'Reunís ventas, costo de las recetas vendidas, personal y gastos para consultar cómo cerró cada día en cada sucursal.' },
    ] },
  ],
  comercio: [
    { titulo: 'Vender en el local y online', items: [
      { fila: 0, nombre: 'Catálogo y pedidos', texto: 'El cliente puede elegir desde el catálogo online; el equipo también registra pedidos de mostrador en el mismo sistema.' },
    ] },
    { titulo: 'Saber qué queda', items: [
      { fila: 1, nombre: 'Stock por artículo', texto: 'Al completar un pedido se descuenta el stock de sus artículos. Recibirlo o preparar la compra todavía no modifica las existencias.' },
      { fila: 7, nombre: 'Avisos de mínimo por artículo', texto: 'El aviso por mínimo de cada artículo está en desarrollo. No se presenta como una función disponible hoy.' },
      { fila: 8, nombre: 'Talles y colores', texto: 'Las variantes de talle y color por artículo están en desarrollo.' },
    ] },
    { titulo: 'Ordenar cobros y números', items: [
      { fila: 2, nombre: 'Caja y arqueo', texto: 'Registrás el cobro por su medio de pago y revisás caja. Completar la venta y registrar su pago son acciones distintas.' },
      { fila: 3, nombre: 'Fichaje y personal', texto: 'Registrás el fichaje y consultás el costo del equipo por día.' },
      { fila: 4, nombre: 'Compras, gastos y resultado', texto: 'Reunís compras y gastos y consultás el resultado del mes con los datos cargados.' },
      { fila: 5, nombre: 'Resultado del día', texto: 'Consultás ventas, personal y gastos del día. El costo de lo vendido por artículo todavía está en desarrollo.' },
      { fila: 6, nombre: 'Costo de lo vendido', texto: 'El cálculo del costo de lo vendido por artículo está en desarrollo; hoy no se promete margen neto por producto.' },
    ] },
  ],
  servicios: [
    { titulo: 'Organizar la atención', items: [
      { fila: 0, nombre: 'Catálogo de servicios', texto: 'Mostrás tus servicios y sus precios en el catálogo online.' },
      { fila: 2, nombre: 'Agenda interna', texto: 'El equipo organiza los turnos desde la agenda del panel. Esta función se distingue de la reserva online del cliente, todavía en desarrollo.' },
      { fila: 11, nombre: 'Reserva online', texto: 'La reserva online del cliente está en desarrollo. La maqueta muestra la experiencia objetivo; no realiza reservas reales.' },
    ] },
    { titulo: 'Registrar cada atención', items: [
      { fila: 1, nombre: 'Ventas de servicios', texto: 'Registrás la venta del servicio realizado y su precio; el cobro se registra aparte.' },
      { fila: 3, nombre: 'Caja y arqueo', texto: 'Registrás cada pago por su medio y revisás el cierre de caja.' },
      { fila: 4, nombre: 'Stock de insumos', texto: 'Consultás los insumos disponibles y sus mínimos. El consumo automático por atención es otra función y sigue en desarrollo.' },
      { fila: 5, nombre: 'Productos que vendés', texto: 'Si también vendés productos, completar el pedido descuenta las unidades de esos artículos.' },
      { fila: 10, nombre: 'Consumo por atención', texto: 'El descuento automático de los insumos usados en cada servicio está en desarrollo.' },
    ] },
    { titulo: 'Entender el negocio', items: [
      { fila: 6, nombre: 'Fichaje y personal', texto: 'Registrás el fichaje y consultás el costo laboral por día.' },
      { fila: 7, nombre: 'Gastos y resultado del mes', texto: 'Registrás los gastos y consultás el resultado mensual con la información cargada.' },
      { fila: 8, nombre: 'Resultado del día', texto: 'Consultás ventas, personal y gastos del día. No incluye un costo automático de insumos por atención.' },
      { fila: 9, nombre: 'Costo de productos vendidos', texto: 'El cálculo del costo de lo vendido por artículo está en desarrollo.' },
    ] },
  ],
};
