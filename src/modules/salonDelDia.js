/**
 * Lo que hay que saber del salon AHORA, derivado de lo que ya esta en la base.
 *
 * POR QUE ES UN MODULO Y NO VIVE EN LA PANTALLA
 * Son cuentas con reglas —cuando una mesa esta ocupada, que consumo tiene
 * abierto, cual se esta demorando— y una pantalla no es lugar para probarlas.
 * Aca son funciones puras: reciben filas y la hora, devuelven numeros.
 *
 * LA HORA ENTRA POR PARAMETRO
 * Ninguna funcion llama a `new Date()`. Todo lo que mide tiempo transcurrido
 * recibe `ahora`, asi el mismo dato da el mismo resultado en un test y en la
 * pantalla, y el reloj del panel puede avanzar sin volver a pedir nada.
 *
 * TRES ESTADOS Y UN ORDEN
 * Una mesa con visita abierta esta OCUPADA aunque tambien tenga una reserva
 * para mas tarde: lo que manda es lo que esta pasando, no lo que va a pasar.
 * La reserva vuelve a mandar recien cuando la visita se cierra.
 */

/** Los pedidos que todavia cuentan como plata en la mesa. */
const ABIERTOS = new Set([
  'pending_review', 'pending_payment', 'new', 'preparing', 'active',
]);

/** Las reservas que ocupan la mesa de verdad. */
const RESERVA_EN_CURSO = new Set(['arrived', 'in_service']);
const RESERVA_FUTURA = new Set(['booked', 'confirmed']);

export const ESTADOS_MESA = ['libre', 'reservada', 'ocupada'];

const enMs = (valor) => {
  const t = valor ? new Date(valor).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
};

/**
 * Cuanto hace, en minutos, desde `desde` hasta `ahora`.
 * Devuelve null si no hay fecha: null significa "no se sabe", no "cero".
 */
export function minutosDesde(desde, ahora) {
  const a = enMs(desde);
  const b = enMs(ahora);
  if (a === null || b === null) return null;
  return Math.max(0, Math.round((b - a) / 60000));
}

/** `1 h 52 m`, `41 m`. Sin fecha, un guion: no inventamos un cero. */
export function duracionCorta(minutos) {
  if (minutos === null || minutos === undefined) return '—';
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} m`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`;
}

/**
 * Indexa las filas sueltas por mesa, una sola vez.
 *
 * La pantalla dibuja N mesas y cada una necesita su visita, sus pedidos y sus
 * reservas. Buscarlas con `filter` dentro del map es N*M en cada repintado, y
 * el plano repinta con el reloj.
 */
export function indexarPorMesa({ visitas = [], ordenes = [], reservas = [] } = {}) {
  const visitaDe = new Map();
  for (const v of visitas) {
    // Una mesa tiene una sola visita abierta (indice unico en la 0069). Si
    // llegaran dos, gana la que se abrio primero: es la que tiene la gente.
    const previa = visitaDe.get(v.resource_id);
    if (!previa || enMs(v.opened_at) < enMs(previa.opened_at)) visitaDe.set(v.resource_id, v);
  }

  const ordenesDe = new Map();
  for (const o of ordenes) {
    if (!ABIERTOS.has(o.status)) continue;
    // Un pedido llega a la mesa por la visita o por la mesa directa: en el POS
    // se carga sobre la mesa y todavia puede no haber visita.
    const mesa = o.resource_id
      || visitas.find(v => v.id === o.visit_id)?.resource_id
      || null;
    if (!mesa) continue;
    if (!ordenesDe.has(mesa)) ordenesDe.set(mesa, []);
    ordenesDe.get(mesa).push(o);
  }

  const reservasDe = new Map();
  for (const r of reservas) {
    if (!r.resource_id) continue;
    if (!reservasDe.has(r.resource_id)) reservasDe.set(r.resource_id, []);
    reservasDe.get(r.resource_id).push(r);
  }

  return { visitaDe, ordenesDe, reservasDe };
}

/**
 * Todo lo que la pantalla dibuja de UNA mesa.
 *
 * `consumo` es lo que hay sin cobrar, no lo que se vendio: un pedido ya
 * completado salio de la mesa y no puede seguir sumando a la cuenta abierta.
 */
export function estadoDeMesa(recurso, indice, ahora) {
  const { visitaDe, ordenesDe, reservasDe } = indice;
  const visita = visitaDe.get(recurso.id) || null;
  const ordenes = ordenesDe.get(recurso.id) || [];
  const reservas = reservasDe.get(recurso.id) || [];

  const consumo = ordenes.reduce((suma, o) => suma + (Number(o.total) || 0), 0);
  const ultimoPedido = ordenes.reduce((max, o) => {
    const t = enMs(o.created_at);
    return t !== null && (max === null || t > max) ? t : max;
  }, null);
  const primerPedido = ordenes.reduce((min, o) => {
    const t = enMs(o.created_at);
    return t !== null && (min === null || t < min) ? t : min;
  }, null);

  const enCurso = reservas.some(r => RESERVA_EN_CURSO.has(r.status));
  const proxima = reservas
    .filter(r => RESERVA_FUTURA.has(r.status))
    .sort((a, b) => (enMs(a.starts_at) ?? 0) - (enMs(b.starts_at) ?? 0))[0] || null;

  let estado = 'libre';
  if (visita || enCurso || ordenes.length > 0) estado = 'ocupada';
  else if (proxima) estado = 'reservada';

  return {
    recurso,
    estado,
    visita,
    ordenes,
    consumo,
    // Cuantas personas hay sentadas. Sin dato en la visita, la mesa entera:
    // una mesa ocupada no puede contar cero lugares usados.
    ocupantes: estado === 'ocupada'
      ? (Number(visita?.party_size) || Number(recurso.capacity) || 0)
      : 0,
    proximaReserva: proxima,
    // Desde cuando esta ocupada. La visita es la fuente buena, pero en el POS
    // se carga un pedido sobre la mesa sin abrir visita: ahi el reloj arranca
    // con el primer pedido. Sin ninguna de las dos, null y la pantalla escribe
    // un guion en vez de un cero que seria mentira.
    abiertaHace: visita
      ? minutosDesde(visita.opened_at, ahora)
      : (primerPedido !== null ? minutosDesde(primerPedido, ahora) : null),
    // Sin pedidos, el reloj corre desde que se abrio la mesa: una mesa que
    // lleva 40 minutos sin pedir nada es exactamente el caso que hay que ver.
    sinPedirHace: ordenes.length
      ? minutosDesde(ultimoPedido, ahora)
      : (visita ? minutosDesde(visita.opened_at, ahora) : null),
  };
}

/**
 * Los cuatro numeros de la cabecera.
 *
 * La capacidad se mide en LUGARES, no en horas: en el salon lo que se ve es
 * cuanta gente entra y cuanta hay. Las horas vendidas son de la agenda de una
 * barberia, donde el recurso se vende por tiempo.
 */
export function panoramaDelSalon(recursos = [], datos = {}, ahora = Date.now()) {
  const activos = recursos.filter(r => r.active !== false);
  const indice = indexarPorMesa(datos);
  const mesas = activos.map(r => estadoDeMesa(r, indice, ahora));

  const lugares = activos.reduce((s, r) => s + (Number(r.capacity) || 0), 0);
  const ocupados = mesas.reduce((s, m) => s + m.ocupantes, 0);
  const ocupadas = mesas.filter(m => m.estado === 'ocupada');
  const reservadas = mesas.filter(m => m.estado === 'reservada');

  const proxima = reservadas
    .map(m => m.proximaReserva)
    .filter(Boolean)
    .sort((a, b) => (enMs(a.starts_at) ?? 0) - (enMs(b.starts_at) ?? 0))[0] || null;

  // La que mas tiempo lleva abierta. Con empate gana la primera del plano, que
  // es estable: la lista llega ordenada y no se reordena sola en cada tick.
  const demorada = ocupadas.reduce((peor, m) => (
    (m.abiertaHace ?? 0) > (peor?.abiertaHace ?? -1) ? m : peor
  ), null);

  return {
    mesas,
    lugares,
    ocupados,
    // Sin mesas cargadas el porcentaje es 0 y no NaN: la barra tiene que
    // dibujarse igual el primer dia del negocio.
    capacidadPct: lugares > 0 ? Math.round((ocupados / lugares) * 100) : 0,
    mesasOcupadas: ocupadas.length,
    mesasTotales: activos.length,
    mesasLibres: mesas.filter(m => m.estado === 'libre').length,
    mesasReservadas: reservadas.length,
    proximaReserva: proxima,
    consumoAbierto: mesas.reduce((s, m) => s + m.consumo, 0),
    demorada,
  };
}
