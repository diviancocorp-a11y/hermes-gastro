// Oferta pública aprobada para la landing y el diagnóstico. No ejecuta cobros.
// Digital: Ricky, 23/oct; solo mensual confirmado 25/oct. Local/Cadena conservan importes.
// Nombres Paris, Dante y Magnus: Ricky, 4/nov. Los ids siguen siendo digital,
// local y cadena porque los guardan `plans`, `tenants.plan_id` y los diagnosticos.
export const PLANES_COMERCIALES = [
  {
    id: 'digital', nombre: 'Paris', para: 'Para empezar', mensual: 14999, anualPorMes: null,
    descripcion: 'Tu negocio online y la operación en un solo lugar.',
    incluye: ['Catálogo online y pedidos', 'Avisos de pedidos nuevos', 'Caja y arqueo', 'Stock, compras y gastos', 'Equipo y ventas del día y del mes', 'Recetas y costos en gastronomía'],
    detalle: 'Pago mensual. Herramientas disponibles según tu rubro. Sin IVA.',
  },
  {
    id: 'local', nombre: 'Dante', para: 'Un local', mensual: 59000, anualPorMes: 47200,
    descripcion: 'Sabé cuánto ganás y volvé a vender a los que no vuelven.',
    incluye: ['Todo lo de Paris', 'Ganancia del día', 'Clientes y promos del catálogo', 'Cobros online con Mercado Pago', 'Soporte por email y chat', '14 días de prueba al crear tu cuenta'],
    detalle: 'Un local con soporte; o $47.200 por mes pagando el año. Sin IVA.',
  },
  {
    id: 'cadena', nombre: 'Magnus', para: 'Varias sucursales', mensual: 99000, anualPorMes: 79200,
    descripcion: 'Cada local con su operación. Todos con una misma mirada.',
    incluye: ['Todo lo de Dante', 'Varias sucursales', 'Consolidado y comparativa', 'Roles por local', 'Soporte por teléfono'],
    detalle: 'Varias sucursales con consolidado; o $79.200 por mes por local pagando el año. Sin IVA.',
  },
];

/** El nombre de venta de un plan por su id ('local' -> 'Dante'), o null. */
export const nombreDelPlan = planId => PLANES_COMERCIALES.find(p => p.id === planId)?.nombre || null;

export const pesosDelPlan = importe => `$${importe.toLocaleString('es-AR')}`;

export function precioDelPeriodo(plan, anual) {
  const pagoAnual = anual && plan.anualPorMes !== null;
  return {
    importe: pagoAnual ? plan.anualPorMes * 12 : plan.mensual,
    periodo: pagoAnual ? 'año' : 'mes',
    equivalente: pagoAnual ? plan.anualPorMes : null,
  };
}

export const PLANES_DIAGNOSTICO = Object.fromEntries(PLANES_COMERCIALES.map(plan => [plan.id, {
  nombre: plan.nombre,
  precio: `${pesosDelPlan(plan.mensual)} por mes${plan.id === 'cadena' ? ' por local' : ''}`,
  detalle: plan.detalle,
}]));
