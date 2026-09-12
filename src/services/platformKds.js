// src/services/platformKds.js
// La cocina (migracion 0072). Lo que hay que producir y nada mas.
//
// LA FRONTERA CON PEDIDOS
// `Pedidos` es administrativo: aprobar, rechazar, cobrar, cancelar. El KDS
// recibe SOLO lo aprobado. La frontera es `orders.kitchen_at`: hasta que
// alguien no baja el pedido a cocina, el KDS no lo ve.
//
// Los dos servicios no comparten funciones a proposito. Que el KDS no pueda
// cancelar un pedido no es una carencia: es el limite.

import { supabase } from '../lib/supabase';

// Literal a proposito: check-supabase-columns solo resuelve constantes de
// modulo con string literal.
const COLS_TICKET = 'id, tenant_id, branch_id, status, channel, delivery, delivery_date, customer_name, note, allergy_note, diners, staff_id, resource_id, ticket_number, kitchen_at, ready_at, created_at';
const COLS_ITEM = 'id, order_id, tenant_id, name_snapshot, qty, station, station_id, sector_id, note, ready_at, created_at';

function exigirTenant(tenantId, quien) {
  if (!tenantId) throw new Error(`${quien}: falta tenantId (sin el, la consulta trae otros negocios)`);
}

const MENSAJES = {
  no_sos_miembro: 'No sos parte de este negocio.',
  pedido_de_otro_negocio: 'Ese pedido no es de este negocio.',
  plato_de_otro_negocio: 'Ese plato no es de este negocio.',
  pedido_cancelado: 'El pedido está cancelado.',
  pedido_no_esta_en_cocina: 'Ese pedido todavía no bajó a cocina.',
  falta_tenant: 'Falta el negocio.',
};

function traducir(msg) {
  const codigo = Object.keys(MENSAJES).find(c => String(msg).includes(c));
  return codigo ? MENSAJES[codigo] : msg;
}

/* ─────────────────────────── Lectura ──────────────────────────────── */

/**
 * Los tickets que estan en cocina ahora: bajaron y todavia no se cerraron.
 *
 * Trae los items en la misma consulta. Una consulta por ticket dejaria la
 * pantalla haciendo N+1 pedidos cada vez que refresca, y el KDS refresca cada
 * pocos segundos toda la noche.
 */
export async function fetchTicketsDeCocina(tenantId, { branchId = null } = {}) {
  exigirTenant(tenantId, 'fetchTicketsDeCocina');
  let q = supabase
    .from('orders')
    .select(`${COLS_TICKET}, order_items(${COLS_ITEM}), resources(name), staff(name)`)
    .eq('tenant_id', tenantId)
    .not('kitchen_at', 'is', null)
    .is('ready_at', null);
  if (branchId) q = q.eq('branch_id', branchId);

  const { data, error } = await q.order('kitchen_at');
  if (error) { console.error('fetchTicketsDeCocina:', error.message); return []; }
  const ahora = new Date();
  return (data || []).map(f => normalizarTicket(f, ahora));
}

/**
 * Los que esperan aprobacion: entraron y todavia no bajaron a cocina.
 * El KDS no los muestra; los usa para el aviso de "hay pedidos esperando".
 */
export async function contarEsperandoCocina(tenantId, { branchId = null } = {}) {
  exigirTenant(tenantId, 'contarEsperandoCocina');
  let q = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('kitchen_at', null)
    .in('status', ['pending_review', 'pending_payment', 'new']);
  if (branchId) q = q.eq('branch_id', branchId);

  const { count, error } = await q;
  if (error) { console.error('contarEsperandoCocina:', error.message); return 0; }
  return count || 0;
}

/* ─────────────────────────── Escritura ────────────────────────────── */

/** Aprobar, visto desde la cocina: el pedido baja y arranca el cronometro. */
export async function bajarACocina(tenantId, orderId) {
  exigirTenant(tenantId, 'bajarACocina');
  const { data, error } = await supabase.rpc('bajar_pedido_a_cocina', {
    p_tenant_id: tenantId, p_order_id: orderId,
  });
  if (error) { console.error('bajarACocina:', error.message); return { __error: 'db', message: traducir(error.message) }; }
  return data;
}

/**
 * Marcar un plato. `listo` va explicito y no alterna: en una pantalla tactil
 * de cocina, con las manos ocupadas, el segundo toque accidental no puede
 * significar "el plato volvio a estar pendiente".
 */
export async function marcarPlato(tenantId, itemId, listo = true) {
  exigirTenant(tenantId, 'marcarPlato');
  const { data, error } = await supabase.rpc('marcar_plato', {
    p_tenant_id: tenantId, p_item_id: itemId, p_listo: listo,
  });
  if (error) { console.error('marcarPlato:', error.message); return { __error: 'db', message: traducir(error.message) }; }
  return data;
}

/** Cerrar el ticket: marca lo que falte, sella la hora y lo saca del KDS. */
export async function cerrarTicket(tenantId, orderId) {
  exigirTenant(tenantId, 'cerrarTicket');
  const { data, error } = await supabase.rpc('cerrar_ticket_de_cocina', {
    p_tenant_id: tenantId, p_order_id: orderId,
  });
  if (error) { console.error('cerrarTicket:', error.message); return { __error: 'db', message: traducir(error.message) }; }
  return data;
}

/* ────────────────────── Reglas de la pantalla ─────────────────────── */

/**
 * De donde viene el ticket. No es una columna: se deduce de lo que el pedido
 * ya guarda, porque el mismo dato con otro nombre en otra columna es la forma
 * mas facil de que las dos se contradigan.
 *
 * El orden importa: un pedido programado puede ser ademas de delivery, y lo
 * que la cocina necesita saber primero es que no sale ahora.
 */
export function zonaDelTicket(ticket, ahora = new Date()) {
  const programado = ticket?.delivery_date
    && new Date(ticket.delivery_date).getTime() > ahora.getTime();
  if (programado) return 'programado';
  // `envio` y nada mas. La columna es NOT NULL con default 'retiro' (0012) y
  // el Zod solo acepta esos dos valores, asi que "tiene delivery" es cierto
  // para TODOS los pedidos: con esa condicion cada ticket de mesa salia
  // rotulado Delivery y el nombre de la mesa no aparecia nunca.
  if (ticket?.delivery === 'envio') return 'delivery';
  if (ticket?.resource_id) return 'salon';
  return 'mostrador';
}

/** Minutos que lleva el ticket EN COCINA, no desde que entro el pedido. */
export function minutosEnCocina(ticket, ahora = new Date()) {
  if (!ticket?.kitchen_at) return 0;
  const ms = ahora.getTime() - new Date(ticket.kitchen_at).getTime();
  return Math.max(0, ms / 60000);
}

/** El cronometro como lo muestra la pantalla: `19:06`. */
export function cronometro(minutos) {
  const total = Math.max(0, Math.floor(minutos * 60));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * El estado del ticket por su demora. Tres escalones, como el diseño:
 *
 *   en tiempo   verde    va bien
 *   atencion    ambar    se acerca al umbral
 *   demorado    rojo     lo paso
 *
 * "Atencion" arranca al 60% del umbral y no en un valor fijo: con un umbral
 * de 18 minutos avisa a los 11, con uno de 6 avisa a los 3:36. Un valor fijo
 * dejaria sin aviso a las cocinas rapidas, que son las que mas lo necesitan.
 *
 * El 60% sale del render y no de una preferencia: ahi un ticket de 11:06
 * contra un umbral de 18 esta en ambar, y con dos tercios habria quedado
 * verde. El aviso tiene que llegar con tiempo de reaccionar, no cuando ya
 * casi se paso.
 */
export function estadoDeDemora(minutos, umbralMin = 18) {
  const umbral = Number(umbralMin) > 0 ? Number(umbralMin) : 18;
  if (minutos >= umbral) return 'demorado';
  if (minutos >= umbral * 0.6) return 'atencion';
  return 'en-tiempo';
}

/** Cuanto del umbral lleva consumido, de 0 a 1. Es la barra de la tablet. */
export function avanceDeDemora(minutos, umbralMin = 18) {
  const umbral = Number(umbralMin) > 0 ? Number(umbralMin) : 18;
  return Math.min(1, Math.max(0, minutos / umbral));
}

/** Platos marcados sobre el total. Es el `(0/3)` del boton. */
export function platosListos(ticket) {
  const items = ticket?.order_items || [];
  return { listos: items.filter(i => i.ready_at).length, total: items.length };
}

/**
 * Las estaciones del sector, con cuantos TICKETS le tocan a cada una.
 *
 * Recibe las estaciones CONFIGURADAS (0074) y no las deduce de los platos:
 * asi el riel mantiene el orden del circuito de la cocina —caliente primero,
 * postres al final— que es un dato que solo el local sabe. Deducirlas de los
 * platos las ordenaba alfabeticamente y las hacia aparecer y desaparecer
 * segun lo que hubiera en el servicio, que es exactamente lo que no querés de
 * un riel que se toca con la mano sin mirar.
 *
 * Cuenta tickets y no platos porque el numero es una promesa: al tocar
 * "Parrilla 4" tienen que aparecer cuatro tickets. Contando platos, una
 * parrilla con cuatro milanesas del mismo ticket diria 4 y mostraria 1.
 *
 * Una estacion sin trabajo NO se esconde: se muestra en cero. Un riel que
 * cambia de largo durante el servicio obliga a mirar antes de tocar.
 *
 * Los platos sin estacion asignada van a `sin-estacion` y solo aparecen si
 * hay alguno: un plato que nadie ve es un plato que no sale, pero un local
 * con todo configurado no tiene por que cargar con esa fila.
 */
export function estacionesDe(tickets, estaciones = []) {
  const cuenta = new Map(estaciones.map(e => [e.id, 0]));
  let huerfanos = 0;
  let total = 0;

  for (const t of tickets) {
    const suyas = new Set();
    let tieneHuerfano = false;
    for (const i of t.order_items || []) {
      if (i.ready_at) continue;
      if (i.station_id) suyas.add(i.station_id);
      else tieneHuerfano = true;
    }
    if (!suyas.size && !tieneHuerfano) continue;
    total += 1;
    for (const id of suyas) cuenta.set(id, (cuenta.get(id) || 0) + 1);
    if (tieneHuerfano) huerfanos += 1;
  }

  const lista = estaciones.map(e => ({
    id: e.id,
    nombre: e.name,
    corta: e.short_name || null,
    n: cuenta.get(e.id) || 0,
  }));
  if (huerfanos) {
    lista.push({ id: 'sin-estacion', nombre: 'Sin estación', corta: null, n: huerfanos });
  }
  return { total, estaciones: lista };
}

/** Un ticket tiene trabajo en esa estacion si le queda algun plato ahi. */
export function tocaLaEstacion(ticket, estacionId) {
  if (!estacionId || estacionId === 'todas') return true;
  return (ticket.order_items || []).some((i) => {
    if (i.ready_at) return false;
    if (estacionId === 'sin-estacion') return !i.station_id;
    return i.station_id === estacionId;
  });
}

/**
 * Como se llama el ticket en la pantalla y en voz alta.
 *
 * En salon manda la mesa, porque es lo que el mozo pregunta. En el resto, el
 * numero de ticket, que se asigna al bajar a cocina (0073) y se reinicia con
 * el servicio para que siga siendo gritable.
 */
export function tituloDelTicket(ticket, ahora = new Date()) {
  const zona = zonaDelTicket(ticket, ahora);
  if (zona === 'salon' && ticket.resource_nombre) return ticket.resource_nombre;
  const n = ticket.ticket_number;
  if (!n) return 'Sin número';
  if (zona === 'delivery') return `Delivery ${n}`;
  if (zona === 'programado') return `Programado ${n}`;
  return `Pedido ${n}`;
}

/**
 * Aplana los joins que trae la consulta y calcula lo que la pantalla repite.
 *
 * Se hace UNA vez al traer y no en cada render: el KDS repinta cada segundo
 * por el cronometro, y recalcular el titulo de veinte tickets sesenta veces
 * por minuto es trabajo tirado.
 */
export function normalizarTicket(fila, ahora = new Date()) {
  const t = {
    ...fila,
    resource_nombre: fila.resources?.name || null,
    staff_nombre: fila.staff?.name || null,
    order_items: [...(fila.order_items || [])].sort(
      // Lo pendiente arriba: es lo que falta cocinar. Dentro de cada grupo,
      // el orden en que entro al pedido, que es como lo canto el mozo.
      (a, b) => (!!a.ready_at - !!b.ready_at)
        || String(a.created_at || '').localeCompare(String(b.created_at || ''))),
  };
  t.titulo = tituloDelTicket(t, ahora);
  return t;
}

/**
 * La etiqueta que sale por la impresora del pasador, en texto plano.
 *
 * Va como texto y no como HTML porque una termica de 58 mm imprime
 * caracteres, no una pagina: son 32 columnas y un corte. Devolverlo armado
 * aca —y no dentro del componente— permite probarlo sin impresora y sin
 * renderizar nada.
 *
 * @param anchoCols 32 para 58 mm, 48 para 80 mm.
 */
export function etiquetaDePasador(ticket, { anchoCols = 32, ahora = new Date(), timezone } = {}) {
  const linea = (izq, der) => {
    const hueco = Math.max(1, anchoCols - izq.length - der.length);
    return izq + ' '.repeat(hueco) + der;
  };
  const corte = '-'.repeat(anchoCols);
  const zona = zonaDelTicket(ticket, ahora);
  const hora = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone || undefined,
  }).format(ahora);

  const filas = [
    linea(
      (ZONAS_ETIQUETA[zona] || 'TICKET').toLocaleUpperCase('es-AR'),
      ticket.ticket_number ? `TICKET ${ticket.ticket_number}` : ''),
    ticket.titulo || tituloDelTicket(ticket, ahora),
  ];

  const sub = [];
  if (Number(ticket.diners) > 0) sub.push(`${ticket.diners} comensales`);
  if (ticket.staff_nombre) sub.push(ticket.staff_nombre);
  if (sub.length) filas.push(sub.join(' · '));

  // La alergia va ARRIBA de los platos y con marca propia: quien arma la
  // bandeja lee la etiqueta de corrido y esto no puede quedar al final.
  if (ticket.allergy_note) filas.push(corte, `! ${ticket.allergy_note}`);

  filas.push(corte);
  for (const i of ticket.order_items || []) {
    filas.push(`${i.qty}x ${i.name_snapshot}`);
    if (i.note) filas.push(`   ${i.note}`);
  }
  filas.push(corte, linea(ticket.staff_nombre || '', `Listo ${hora}`));

  return filas.join('\n');
}

const ZONAS_ETIQUETA = {
  salon: 'Salón',
  mostrador: 'Mostrador',
  delivery: 'Delivery',
  programado: 'Programado',
};
