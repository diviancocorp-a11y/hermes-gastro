// Contrato compartido del front y la edge function. Sin acceso a datos ni secretos.
export const CONSENTIMIENTO_VERSION = 'diagnostico-v2-2026-10-29';
const opciones = filas => filas.map(([id, label]) => ({ id, label }));
const frecuencia = opciones([['ninguno', 'Ninguno'], ['uno_dos', '1 o 2'], ['tres_cinco', 'De 3 a 5'], ['seis_mas', '6 o más'], ['no_se', 'No lo sé']]);
const DESAFIOS_POR_VERTICAL = { gastronomia: ['rentabilidad', 'costos', 'costo_laboral', 'mermas_caja', 'pedidos'], comercio: ['rentabilidad', 'stock', 'costo_laboral', 'mermas_caja', 'pedidos'], servicios: ['rentabilidad', 'turnos', 'costo_laboral', 'stock', 'mermas_caja'], otro: ['rentabilidad', 'stock', 'costo_laboral', 'mermas_caja', 'pedidos'] };
export const PREGUNTAS_DOLOR = {
  rentabilidad: { pregunta: '¿Cuándo sabés cuánto te quedó?', opciones: opciones([['diario', 'Todos los días'], ['fin_mes', 'A fin de mes'], ['nunca', 'Hoy no lo sé'], ['no_se', 'No estoy seguro']]) },
  costos: { pregunta: '¿Cada cuánto revisás tus precios?', opciones: opciones([['semanal', 'Todas las semanas'], ['mensual', 'Una vez al mes'], ['varios_meses', 'Cada varios meses'], ['no_actualizo', 'No los reviso regularmente'], ['no_se', 'No lo sé']]) },
  costo_laboral: { pregunta: '¿Cuántos días por semana no sabés si cubrís los sueldos?', opciones: frecuencia },
  mermas_caja: { pregunta: '¿Qué diferencia suele aparecer en caja por semana?', opciones: opciones([['sin_diferencia', 'No suele haber diferencias'], ['hasta_10000', 'Hasta $10.000'], ['10000_50000', 'Entre $10.000 y $50.000'], ['mas_50000', 'Más de $50.000'], ['no_se', 'No lo sé']]) },
  stock: { pregunta: '¿Cuántas veces al mes te quedás sin algo?', opciones: frecuencia },
  turnos: { pregunta: '¿Cuántos turnos por semana se caen o no vienen?', opciones: frecuencia },
  pedidos: { pregunta: '¿Cuántas veces por semana se pierde o se duplica un pedido?', opciones: frecuencia },
};
export const VENTAS_MENSUALES = opciones([['hasta_1m', 'Hasta $1.000.000'], ['1m_5m', 'Entre $1.000.000 y $5.000.000'], ['5m_15m', 'Entre $5.000.000 y $15.000.000'], ['mas_15m', 'Más de $15.000.000'], ['no_se', 'No lo sé'], ['prefiero_no_responder', 'Prefiero no responder']]);
export const DECISORES = opciones([['yo', 'Yo decido'], ['socios', 'Lo decido con un socio'], ['encargado', 'Soy encargado y lo propongo'], ['otra_persona', 'Decide otra persona']]);
export function recomendarPlanV2({ locales, equipo, gestion_actual }) {
  if (locales === 'dos_tres' || locales === 'cuatro_o_mas') return 'cadena';
  if (equipo === 'de_6_a_15' || equipo === 'mas_de_15' || gestion_actual === 'otro_sistema') return 'local';
  return 'digital';
}
export function extrasV2(r) {
  return { senal: r.senal || null, sistema_nombre: String(r.sistema_nombre || '').trim().slice(0, 80), sistema_costo: r.sistema_costo === '' || r.sistema_costo == null ? null : Number(r.sistema_costo), venta_mensual: r.venta_mensual || null, decisor: r.decisor || null };
}
export function validarExtrasV2(r, extra) {
  if (!DESAFIOS_POR_VERTICAL[r.vertical]?.includes(r.desafio)) return 'La preocupación no corresponde a ese rubro.';
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return 'Faltan los datos del diagnóstico.';
  if (!PREGUNTAS_DOLOR[r.desafio]?.opciones.some(o => o.id === extra.senal)) return 'Elegí el detalle de tu preocupación.';
  if (!VENTAS_MENSUALES.some(o => o.id === extra.venta_mensual)) return 'Elegí un rango de venta o indicá que preferís no responder.';
  if (!DECISORES.some(o => o.id === extra.decisor)) return 'Indicá quién participa de la decisión.';
  if (typeof extra.sistema_nombre !== 'string' || extra.sistema_nombre.length > 80) return 'El nombre del sistema es demasiado largo.';
  if (extra.sistema_costo !== null && (!Number.isFinite(extra.sistema_costo) || extra.sistema_costo < 0 || extra.sistema_costo > 1e9)) return 'Revisá el costo mensual del sistema.';
  return null;
}
export function normalizarWhatsapp(valor) {
  if (typeof valor !== 'string' || !/^\+[\d\s()-]+$/.test(valor.trim())) return null;
  const numero = valor.trim().replace(/[\s()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(numero) ? numero : null;
}
