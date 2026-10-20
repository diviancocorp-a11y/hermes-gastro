// src/services/platformResultado.js
// El resultado del dia por sucursal (0103): cuanto se gano hoy.
//
// La cuenta la hace la base (resultado_del_dia), no el front: es una sola
// verdad, se verifica con un select y no depende de que el panel haya bajado
// todas las ventas del tenant. Este archivo solo la trae y la ordena para
// mostrarla. Si alguna vez la UI necesita otra linea, va en la RPC.
//
// Este archivo esta en PLATFORM_PATHS (scripts/check-supabase-columns.mjs).

import { supabase } from '../lib/supabase';

const CAMPOS_NUMERICOS = [
  'ventas', 'descuentos', 'costo_mercaderia', 'nomina', 'horas', 'merma',
  'gastos_del_dia', 'gastos_fijos', 'ganancia_neta',
];

/**
 * Trae el resultado del dia operativo de una sucursal. `dia` es 'YYYY-MM-DD';
 * sin dia, la base usa hoy en la zona horaria (y la hora de corte) de la
 * sucursal: el navegador puede estar en otra.
 */
export async function fetchResultadoDelDia(branchId, dia = null) {
  if (!branchId) return { ok: false, error: 'Falta la sucursal' };
  const { data, error } = await supabase.rpc('resultado_del_dia', {
    p_branch_id: branchId,
    p_day: dia,
  });
  if (error) {
    console.error('fetchResultadoDelDia:', error.message);
    return { ok: false, error: 'No se pudo traer el resultado del día' };
  }
  const fila = Array.isArray(data) ? data[0] : data;
  // Sin fila es que la sucursal no es de un negocio del usuario (la RLS la
  // filtra): no hay resultado que mostrar, no un dia en 0.
  if (!fila) return { ok: false, error: 'No tenés acceso a esta sucursal' };
  return { ok: true, data: normalizarResultado(fila) };
}

/** PostgREST puede mandar numeric como string: todo a Number una vez, aca. */
export function normalizarResultado(fila) {
  const r = { ...fila };
  for (const k of CAMPOS_NUMERICOS) r[k] = Number(r[k]) || 0;
  r.lineas_sin_costo = Number(r.lineas_sin_costo) || 0;
  r.tickets = Number(r.tickets) || 0;
  return r;
}

/**
 * Las lineas de la cuenta, en el orden en que se leen: lo que entro y, abajo,
 * lo que se fue. `monto` va siempre positivo y `signo` dice si suma o resta,
 * asi la UI no tiene que adivinar.
 */
export function lineasDelResultado(r) {
  return [
    { id: 'ventas', label: 'Ventas', monto: r.ventas, signo: 1 },
    { id: 'descuentos', label: 'Descuentos', monto: r.descuentos, signo: -1 },
    { id: 'costo_mercaderia', label: 'Costo de lo vendido', detalle: 'según recetas', monto: r.costo_mercaderia, signo: -1 },
    { id: 'nomina', label: 'Nómina', detalle: horasComoTexto(r.horas), monto: r.nomina, signo: -1 },
    { id: 'merma', label: 'Merma', monto: r.merma, signo: -1 },
    { id: 'gastos_del_dia', label: 'Gastos del día', monto: r.gastos_del_dia, signo: -1 },
    { id: 'gastos_fijos', label: 'Gastos fijos', detalle: 'parte del mes', monto: r.gastos_fijos, signo: -1 },
  ];
}

/**
 * La ganancia que muestra la UI es la de la base. Esto comprueba que las
 * lineas suman eso: si algun dia la RPC suma una linea y la UI no la muestra,
 * el numero de abajo dejaria de cerrar con lo de arriba sin que nadie lo vea.
 */
export function cierraLaCuenta(r) {
  const suma = lineasDelResultado(r).reduce((a, l) => a + l.signo * l.monto, 0);
  return Math.abs(suma - r.ganancia_neta) < 0.005;
}

/** Ganancia sobre ventas, en %. Sin ventas no hay margen (null, no 0). */
export function margenDelDia(r) {
  if (!r.ventas) return null;
  return (r.ganancia_neta / r.ventas) * 100;
}

/**
 * Lo que la cuenta no puede saber y el dueño tiene que leer al lado del
 * numero: un resultado inflado sin aviso es peor que no mostrarlo.
 */
export function avisosDelResultado(r) {
  const avisos = [];
  if (r.lineas_sin_costo > 0) {
    avisos.push(r.lineas_sin_costo === 1
      ? '1 venta sin receta: su costo cuenta 0 y la ganancia queda inflada.'
      : `${r.lineas_sin_costo} ventas sin receta: su costo cuenta 0 y la ganancia queda inflada.`);
  }
  if (r.ventas > 0 && r.horas === 0) {
    avisos.push('Nadie fichó este día: la nómina no entra en la cuenta.');
  }
  return avisos;
}

function horasComoTexto(h) {
  if (!h) return null;
  const redondo = Math.round(h * 10) / 10;
  return `${String(redondo).replace('.', ',')} h fichadas`;
}

/** Corre un dia 'YYYY-MM-DD' n dias, sin pasar por la zona del navegador. */
export function sumarDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}
