// src/lib/diagnostico.js
// El diagnostico de la landing (divianco.app/diagnostico): las preguntas, la
// regla del plan y lo que Dico le contesta a cada desafio en cada rubro.
//
// REGLA DE CONTENIDO (la misma de PlatformLanding.jsx): nada que el producto no
// haga hoy. Cada solucion de abajo se apoya en un modulo con implementado:true
// en src/modules/registry.js. Lo que esta en desarrollo (agenda de turnos,
// talles y colores) se dice como "en desarrollo", nunca como hecho.
//
// Los valores (ids) son los mismos que los CHECK de public.diagnosticos (0100,
// 0101) y las listas de platform/functions/diagnostico. Si cambia uno, cambian
// los tres.

import { supabase } from './supabase';
import { PLANES_DIAGNOSTICO } from './planesPlataforma';
import { recomendarPlanV2 } from '../../platform/functions/diagnostico/v2.js';
export { PREGUNTAS_DOLOR, VENTAS_MENSUALES, DECISORES, extrasV2, normalizarWhatsapp, CONSENTIMIENTO_VERSION } from '../../platform/functions/diagnostico/v2.js';

export const VERTICALES = [
  { id: 'gastronomia', label: 'Gastronomía', rubro: 'gastro' },
  { id: 'comercio', label: 'Comercio', rubro: 'retail' },
  { id: 'servicios', label: 'Servicios', rubro: 'barber' },
  { id: 'otro', label: 'Otro rubro', rubro: 'retail' },
];

export const ESTABLECIMIENTOS = {
  gastronomia: [
    { id: 'restaurante', label: 'Restaurante' },
    { id: 'parrilla', label: 'Parrilla' },
    { id: 'cafeteria', label: 'Cafetería' },
    { id: 'panaderia_pasteleria', label: 'Panadería y pastelería' },
    { id: 'bar_cerveceria', label: 'Bar o cervecería' },
    { id: 'dark_kitchen', label: 'Dark kitchen' },
  ],
  comercio: [
    { id: 'indumentaria', label: 'Indumentaria y accesorios' },
    { id: 'almacen_kiosco', label: 'Almacén, kiosco o autoservicio' },
    { id: 'bebidas', label: 'Bebidas y licorería' },
    { id: 'otro_comercio', label: 'Otro comercio' },
  ],
  servicios: [
    { id: 'barberia_peluqueria', label: 'Barbería o peluquería' },
    { id: 'estetica', label: 'Estética, uñas o spa' },
    { id: 'otro_servicio', label: 'Otro servicio' },
  ],
  otro: [],
};

export const CANALES = [
  { id: 'salon', label: 'Salón o local a la calle' },
  { id: 'mostrador', label: 'Mostrador o take away' },
  { id: 'delivery_propio', label: 'Delivery propio' },
  { id: 'apps_delivery', label: 'Apps de delivery' },
  { id: 'catalogo_online', label: 'Catálogo online o WhatsApp' },
];

export const LOCALES = [
  { id: 'uno', label: 'Un local' },
  { id: 'dos_tres', label: 'De 2 a 3 locales' },
  { id: 'cuatro_o_mas', label: '4 locales o más' },
];

export const EQUIPOS = [
  { id: 'hasta_5', label: 'Hasta 5 personas' },
  { id: 'de_6_a_15', label: 'De 6 a 15 personas' },
  { id: 'mas_de_15', label: 'Más de 15 personas' },
];

export const GESTIONES = [
  { id: 'planillas', label: 'Con planillas de cálculo' },
  { id: 'registro_manual', label: 'Con un registro manual' },
  { id: 'otro_sistema', label: 'Con otro sistema de gestión' },
  { id: 'contador', label: 'Lo resuelve el contador a fin de mes' },
  { id: 'sin_control', label: 'Hoy no lo controlo' },
];

// El dolor, en primera persona y con la consecuencia concreta, porque asi lo
// dice el duenio (referencia: el diagnostico de IMAN, 19/oct/2026). Cambia
// segun el rubro: en un comercio no hay recetas y en una barberia lo que se
// pierde es tiempo de agenda. El id es el que se guarda (CHECK de 0101).
const DOLORES = {
  gastronomia: [
    { id: 'rentabilidad', label: 'Vendo bien, pero no sé cuánto me queda', sub: 'Me entero a fin de mes, cuando ya no hay nada que corregir.' },
    { id: 'costos', label: 'Los insumos suben y no sé si mis precios alcanzan', sub: 'Recalculo cada plato a mano, o directamente no recalculo.' },
    { id: 'costo_laboral', label: 'Los sueldos se comen la venta', sub: 'Hay días con mucha gente y poca venta, y no lo veo a tiempo.' },
    { id: 'mermas_caja', label: 'Se pierde mercadería y la caja no cierra', sub: 'Lo que se tira, se regala o falta no queda anotado en ningún lado.' },
    { id: 'pedidos', label: 'Los pedidos me llegan por todos lados', sub: 'Salón, mostrador y WhatsApp, cada uno por su cuenta.' },
  ],
  comercio: [
    { id: 'rentabilidad', label: 'Vendo, pero no sé cuánto gano', sub: 'Compro, vendo y pago; el número final no lo veo nunca.' },
    { id: 'stock', label: 'Me quedo sin mercadería o compro de más', sub: 'El stock lo cuento a ojo, cuando puedo.' },
    { id: 'costo_laboral', label: 'El personal me pesa y no sé cuánto', sub: 'No sé qué parte de la venta se va en sueldos.' },
    { id: 'mermas_caja', label: 'La caja no me cierra', sub: 'Diferencias chicas todos los días que nadie explica.' },
    { id: 'pedidos', label: 'Los pedidos se me desordenan', sub: 'Mostrador y catálogo por WhatsApp, cada uno por su lado.' },
  ],
  servicios: [
    { id: 'rentabilidad', label: 'Trabajo mucho y no sé cuánto gano', sub: 'Cobro todos los días, pero el número del mes no lo veo.' },
    { id: 'turnos', label: 'Coordinar turnos me lleva horas', sub: 'Mensajes de ida y vuelta para cada turno.' },
    { id: 'costo_laboral', label: 'No sé si cada día paga los sueldos', sub: 'Hay días flojos y no sé cuánto me cuestan.' },
    { id: 'stock', label: 'Me quedo sin insumos en el peor momento', sub: 'Me doy cuenta cuando ya no queda.' },
    { id: 'mermas_caja', label: 'La caja no me cierra', sub: 'Efectivo, transferencias y tarjeta no coinciden con lo que cobré.' },
  ],
};
DOLORES.otro = DOLORES.comercio;

export function desafiosDe(vertical) {
  return DOLORES[vertical] || DOLORES.otro;
}

export const URGENCIAS = [
  { id: 'ya', label: 'Ya, es urgente' },
  { id: 'este_mes', label: 'Este mes' },
  { id: 'proximos_meses', label: 'En los próximos meses' },
  { id: 'explorando', label: 'Estoy mirando opciones' },
];

// Se conserva el id historico gratis para compatibilidad con respuestas guardadas.
export const INVERSIONES = [
  { id: 'gratis', label: 'Prefiero evaluar antes de pagar' },
  { id: 'hasta_60k', label: 'Hasta $60.000 por mes' },
  { id: 'hasta_100k', label: 'Hasta $100.000 por mes' },
  { id: 'mas_de_100k', label: 'Más de $100.000 por mes' },
  { id: 'no_se', label: 'Todavía no lo sé' },
];

/** Orden de las preguntas: rubro, y enseguida el dolor (lo que mas importa
 *  y lo que mas engancha); despues lo que cualifica. `establecimiento` se
 *  saltea en "otro". */
export const ORDEN_PASOS = [
  'vertical', 'desafio', 'canales', 'escala', 'gestion_actual',
  'venta_mensual', 'urgencia', 'nombre_negocio',
];

/** Plan recomendado. Cadena = varias sucursales; Local = un local con equipo o
 *  que ya usa un sistema; Digital = el resto. Crear la cuenta no contrata el plan. */
export const planRecomendado = recomendarPlanV2;

export const PLANES = PLANES_DIAGNOSTICO;

/** Lo que Dico contesta. `hoy` es lo que el producto ya hace; `pendiente`, lo
 *  que esta en desarrollo y se dice como tal. `pieza` nombra el fragmento de
 *  interfaz que el resultado muestra (lo dibuja la pagina). */
export function solucion(desafio, vertical) {
  const gastro = vertical === 'gastronomia';
  // Lo que todavia no esta se ofrece como desarrollo para el negocio, no como
  // promesa: "lo construimos con vos" (decision de Ricky, 19/oct/2026).
  const aMedida = 'Si tu negocio lo necesita antes, lo desarrollamos con vos.';
  switch (desafio) {
    case 'rentabilidad':
      return {
        titulo: 'Lo que te falta es ver la ganancia, no la venta.',
        // resultado_del_dia (0103, publicado el 20/oct): ventas, costo segun la
        // receta, nomina fichada, merma, gastos del dia y fijos prorrateados.
        // El costo por venta sale de las recetas: fuera de gastronomia el
        // resultado del dia no lo tiene y la pantalla lo avisa.
        hoy: gastro
          ? 'Al terminar el día, Dico te da la ganancia neta de esa noche: ventas, el costo de cada plato según tus recetas, las horas fichadas, la merma y los gastos. Por sucursal.'
          : 'Dico arma el resultado de cada mes con tus ventas, tus compras y tus gastos. Y cada día te muestra ventas, horas fichadas y gastos.',
        pendiente: gastro ? null : 'El costo de lo vendido por artículo, para que el resultado del día lo descuente, está en desarrollo.',
        aMedida: gastro ? null : aMedida,
        pieza: 'cierre',
      };
    case 'costos':
      return {
        titulo: 'Tus precios tienen que seguir a tus costos.',
        hoy: 'Cargás la receta de cada plato una vez. Cuando cambia el costo de un insumo, Dico recalcula el plato y te muestra qué margen te queda.',
        pieza: 'receta',
      };
    case 'costo_laboral':
      return {
        titulo: 'Cada día tiene que pagar sus sueldos.',
        hoy: 'El equipo ficha entrada y salida, y Dico te dice qué parte de la venta del día se fue en personal, día por día.',
        pieza: 'turno',
      };
    case 'mermas_caja':
      return {
        titulo: 'Lo que se pierde, primero hay que verlo.',
        hoy: gastro
          ? 'Cada merma queda asentada y el arqueo compara lo declarado con lo registrado: la diferencia aparece sola.'
          : 'El arqueo compara lo declarado con lo registrado al cerrar la caja: la diferencia aparece sola.',
        pieza: 'arqueo',
      };
    case 'pedidos':
      return {
        titulo: 'Un solo lugar para todos tus pedidos.',
        hoy: gastro
          ? 'Salón, mostrador y catálogo online entran al mismo panel, con su estado y su cobro.'
          : 'Mostrador y catálogo online entran al mismo panel, con su estado y su cobro.',
        pieza: 'pedidos',
      };
    case 'stock':
      return {
        titulo: 'El stock tiene que avisarte antes de faltar.',
        hoy: vertical === 'servicios'
          ? 'Cargás lo que comprás y lo que usás, y Dico te marca en el panel lo que quedó por debajo del mínimo. Los productos que vendés bajan solos con cada venta.'
          : 'Cada venta descuenta el artículo del stock y cargás compras y conteos en el mismo lugar.',
        pendiente: vertical === 'servicios'
          ? 'Que cada servicio descuente los insumos que usa está en desarrollo.'
          : 'El mínimo por artículo con aviso, y los talles y colores, están en desarrollo.',
        aMedida,
        pieza: 'stock',
      };
    case 'turnos':
      return {
        titulo: 'Tus turnos, ordenados en una agenda.',
        hoy: 'Dico tiene agenda para organizar turnos, profesionales y horarios. Al configurar tu negocio revisamos la disponibilidad y el alcance de las reservas online.',
        pieza: 'cierre',
      };
    default:
      return null;
  }
}

/** Datos para precargar el alta: el rubro del registry y el nombre. */
export function paramsDelAlta({ vertical, nombre_negocio: nombre }, id) {
  const q = new URLSearchParams();
  if (nombre) q.set('negocio', nombre.slice(0, 80));
  const rubro = VERTICALES.find((v) => v.id === vertical)?.rubro;
  if (rubro) q.set('rubro', rubro);
  if (id) q.set('d', id);
  return q.toString();
}

/** Eventos de analitica al mostrar una pregunta. `antes` y `ahora` son
 *  { paso, idx }; `antes` es null si no venia de otra pregunta. Volver a un
 *  paso anterior marca el atras del paso que se dejo. */
export function eventosDePaso(antes, ahora, version = 1) {
  const prefijo = version === 2 ? 'diagnostico-v2' : 'diagnostico';
  const eventos = [`${prefijo}-paso-${ahora.paso}`];
  if (antes && ahora.idx < antes.idx) eventos.push(`${prefijo}-atras-${antes.paso}`);
  return eventos;
}

const CLAVE_PENDIENTE = 'dico:diagnostico-pendiente';

/** Guarda el diagnostico (edge function `diagnostico`). Nunca tira: si la red
 *  o la funcion fallan, el resultado se muestra igual y devuelve null. */
export async function guardarDiagnostico(respuestas, { conToken = false } = {}) {
  try {
    const { data, error } = await supabase.functions.invoke('diagnostico', {
      body: {
        ...respuestas,
        plan_recomendado: planRecomendado(respuestas),
        origen: (typeof window !== 'undefined'
          ? (window.location.search || document.referrer || '')
          : '').slice(0, 200),
      },
    });
    if (error || !data?.id) return null;
    return conToken ? { id: data.id, token: data.contacto_token || null } : data.id;
  } catch {
    return null;
  }
}

/** Recuerda el id para vincularlo despues del alta. Lo llama la pagina
 *  DESPUES de confirmar que la respuesta es la del ultimo envio (una respuesta
 *  vieja que llega tarde no tiene que pisar el id bueno). */
export function recordarDiagnosticoPendiente(id) {
  try { if (id) localStorage.setItem(CLAVE_PENDIENTE, id); } catch { /* sin storage */ }
}

/** Despues del alta: ata el diagnostico al negocio nuevo. Silencioso. */
export async function vincularDiagnosticoPendiente(idDeLaUrl) {
  let id = idDeLaUrl || null;
  try { id = id || localStorage.getItem(CLAVE_PENDIENTE); } catch { /* sin storage */ }
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  try {
    const { data } = await supabase.rpc('vincular_diagnostico', { p_diagnostico: id });
    try { localStorage.removeItem(CLAVE_PENDIENTE); } catch { /* sin storage */ }
    return data === true;
  } catch {
    return false;
  }
}

/** Solo adjunta contacto con la capacidad recibida al guardar ese diagnostico. */
export async function guardarContactoDiagnostico({ id, token, nombre, whatsapp, consentimiento }) {
  try {
    const { data, error } = await supabase.functions.invoke('diagnostico', { body: { accion: 'contacto', id, token, nombre, whatsapp, consentimiento } });
    return !error && data?.ok === true;
  } catch { return false; }
}
