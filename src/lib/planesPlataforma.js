// Oferta pública aprobada para la landing y el diagnóstico. No ejecuta cobros.
// Digital: Ricky, 23/oct; solo mensual confirmado 25/oct. Local/Cadena conservan importes.
export const PLANES_COMERCIALES = [
  {
    id: 'digital', nombre: 'Digital', para: 'Para empezar', mensual: 14999, anualPorMes: null,
    descripcion: 'Tu negocio online y la operación en un solo lugar.',
    incluye: ['Catálogo online y pedidos', 'Caja y arqueo', 'Stock, compras y gastos', 'Equipo y resultados de día y mes', 'Recetas y costos en gastronomía'],
    detalle: 'Pago mensual. Herramientas disponibles según tu rubro. Sin IVA.',
  },
  {
    id: 'local', nombre: 'Local', para: 'Un local', mensual: 59000, anualPorMes: 47200,
    descripcion: 'La base de Digital, con soporte para tu operación.',
    incluye: ['Todo lo de Digital', 'Un local', 'Soporte por email y chat'],
    detalle: 'Un local con soporte; o $47.200 por mes pagando el año. Sin IVA.',
  },
  {
    id: 'cadena', nombre: 'Cadena', para: 'Varias sucursales', mensual: 99000, anualPorMes: 79200,
    descripcion: 'Cada local con su operación. Todos con una misma mirada.',
    incluye: ['Todo lo de Local', 'Varias sucursales', 'Consolidado y comparativa', 'Roles por local', 'Soporte por teléfono'],
    detalle: 'Varias sucursales con consolidado; o $79.200 por mes por local pagando el año. Sin IVA.',
  },
];

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
