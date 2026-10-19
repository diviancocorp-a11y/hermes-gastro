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

export const VERTICALES = [
  { id: 'gastronomia', label: 'Gastronomía', rubro: 'gastro' },
  { id: 'comercio', label: 'Comercio minorista', rubro: 'retail' },
  { id: 'servicios', label: 'Servicios (barbería, peluquería, estética)', rubro: 'barber' },
  { id: 'otro', label: 'Otro rubro', rubro: null },
];

export const ESTABLECIMIENTOS = {
  gastronomia: [
    { id: 'restaurante', label: 'Restaurante' },
    { id: 'parrilla', label: 'Parrilla' },
    { id: 'cafeteria', label: 'Cafetería' },
    { id: 'panaderia_pasteleria', label: 'Panadería y pastelería' },
    { id: 'bar_cerveceria', label: 'Bar o cervecería' },
    { id: 'dark_kitchen', label: 'Dark kitchen (producción solo para delivery)' },
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

// El desafio cambia de forma segun el rubro: en un comercio no hay recetas y en
// una barberia lo que se pierde es tiempo de agenda, no mercaderia.
const DESAFIOS = {
  rentabilidad: 'No tengo visibilidad de la rentabilidad real del negocio',
  costos: 'La suba de insumos afecta mis márgenes',
  costo_laboral: 'El costo laboral es alto en relación con las ventas',
  mermas_caja: 'Tengo pérdidas por merma o diferencias de caja',
  pedidos: 'Los pedidos se desordenan entre canales',
  stock: 'Me quedo sin mercadería o tengo stock inmovilizado',
  turnos: 'Pierdo tiempo coordinando turnos',
};

const DESAFIOS_POR_VERTICAL = {
  gastronomia: ['rentabilidad', 'costos', 'costo_laboral', 'mermas_caja', 'pedidos'],
  comercio: ['rentabilidad', 'stock', 'costo_laboral', 'mermas_caja', 'pedidos'],
  servicios: ['rentabilidad', 'turnos', 'costo_laboral', 'stock', 'mermas_caja'],
  otro: ['rentabilidad', 'stock', 'costo_laboral', 'mermas_caja', 'pedidos'],
};

export function desafiosDe(vertical) {
  return (DESAFIOS_POR_VERTICAL[vertical] || DESAFIOS_POR_VERTICAL.otro)
    .map((id) => ({ id, label: DESAFIOS[id] }));
}

/** Plan recomendado. Cadena = varias sucursales; Local = un local con equipo o
 *  que ya usa un sistema; Digital = el resto. El alta empieza siempre gratis. */
export function planRecomendado({ locales, equipo, gestion_actual: gestion }) {
  if (locales === 'dos_tres' || locales === 'cuatro_o_mas') return 'cadena';
  if (equipo === 'de_6_a_15' || equipo === 'mas_de_15' || gestion === 'otro_sistema') return 'local';
  return 'digital';
}

export const PLANES = {
  digital: { nombre: 'Digital', precio: 'Gratis', detalle: 'Todo el sistema para empezar, sin pagar.' },
  local: { nombre: 'Local', precio: '$59.000 por mes', detalle: 'Un local con soporte; o $47.200 por mes pagando el año. Sin IVA.' },
  cadena: { nombre: 'Cadena', precio: '$99.000 por mes por local', detalle: 'Varias sucursales con consolidado; o $79.200 por mes pagando el año. Sin IVA.' },
};

/** Lo que Dico contesta. `hoy` es lo que el producto ya hace; `pendiente`, lo
 *  que esta en desarrollo y se dice como tal. `pieza` nombra el fragmento de
 *  interfaz que el resultado muestra (lo dibuja la pagina). */
export function solucion(desafio, vertical) {
  const gastro = vertical === 'gastronomia';
  switch (desafio) {
    case 'rentabilidad':
      return {
        titulo: 'Lo que te falta es ver la ganancia, no la venta.',
        hoy: gastro
          ? 'Cerrás la caja y Dico te da el resultado de esa noche: ventas, insumos según tus recetas, nómina y merma.'
          : 'Cerrás la caja y ves en un mismo lugar las ventas, las compras de mercadería, los gastos y los sueldos del día.',
        pieza: 'cierre',
      };
    case 'costos':
      return {
        titulo: 'Tus precios tienen que seguir a tus costos.',
        hoy: 'Cargás la receta de cada plato una vez. Cuando el proveedor sube un insumo, Dico recalcula el costo y te muestra qué margen te queda.',
        pieza: 'receta',
      };
    case 'costo_laboral':
      return {
        titulo: 'Cada turno tiene que pagarse solo.',
        hoy: 'El equipo ficha entrada y salida, y Dico te dice qué parte de la venta se fue en sueldos, turno por turno.',
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
        hoy: 'Salón, mostrador y catálogo online entran al mismo panel, con su estado y su cobro.',
        pieza: 'pedidos',
      };
    case 'stock':
      return {
        titulo: 'El stock tiene que avisarte antes de faltar.',
        hoy: 'Cada venta descuenta lo que usó y Dico avisa cuando algo queda por debajo del mínimo.',
        pendiente: vertical === 'comercio' ? 'Talles y colores por artículo: en desarrollo.' : null,
        pieza: 'stock',
      };
    case 'turnos':
      return {
        titulo: 'La agenda de turnos todavía no está. Lo demás, sí.',
        hoy: 'Hoy Dico te ordena servicios, cobros, caja y personal en un solo lugar.',
        pendiente: 'La agenda de turnos online está en desarrollo; te avisamos cuando salga.',
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

const CLAVE_PENDIENTE = 'dico:diagnostico-pendiente';

/** Guarda el diagnostico (edge function `diagnostico`). Nunca tira: si la red
 *  o la funcion fallan, el resultado se muestra igual y devuelve null. */
export async function guardarDiagnostico(respuestas) {
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
    try { localStorage.setItem(CLAVE_PENDIENTE, data.id); } catch { /* sin storage */ }
    return data.id;
  } catch {
    return null;
  }
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
