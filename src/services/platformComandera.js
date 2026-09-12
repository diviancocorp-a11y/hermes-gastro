// src/services/platformComandera.js
// El sector que trabaja con papel (migracion 0075).
//
// POR QUE ESTO EXISTE
// Un sector en modo `papel` no tiene KDS. Su trabajo tiene que SALIR del
// sistema como comanda impresa y VOLVER como "listo" desde otro lado. Sin
// estas dos mitades, elegir "comandera" en Produccion no hacia nada.
//
// LA RESTRICCION QUE DEFINE TODO EL DISEÑO
// Una termica USB imprime desde la maquina en la que esta enchufada, y el
// navegador solo puede mandarle a la impresora PREDETERMINADA de ese equipo.
// De ahi sale que la comandera sea una pantalla: no es una pantalla para
// mirar —nadie la lee— es la pagina que hay que dejar abierta en la
// computadora que tiene la impresora del sector. Con dos sectores en papel
// son dos equipos, uno por impresora.
//
// Si mas adelante aparece una termica de RED, un solo equipo puede mandarle a
// varias y esta restriccion desaparece sin tocar el modelo.
//
// IMPRIMIR DOS VECES ES COCINAR DOS VECES
// Por eso la impresion se ANOTA en la base y no en el navegador: recargar la
// pagina, abrirla en otra pestania o cambiar de equipo no puede reimprimir el
// servicio entero. Y la reimpresion deliberada sale marcada como tal, para
// que nadie arme el plato de nuevo.

import { supabase } from '../lib/supabase';
import { zonaDelTicket, tituloDelTicket, normalizarTicket } from './platformKds';

const COLS_TICKET = 'id, tenant_id, branch_id, status, channel, delivery, delivery_date, customer_name, note, allergy_note, diners, staff_id, resource_id, ticket_number, kitchen_at, ready_at, created_at';
const COLS_ITEM = 'id, order_id, tenant_id, name_snapshot, qty, station, station_id, sector_id, note, ready_at, created_at';

const MENSAJES = {
  no_sos_miembro: 'No sos parte de este negocio.',
  pedido_no_esta_en_cocina: 'Ese pedido todavía no bajó a cocina.',
  sector_de_otro_negocio: 'Ese sector no es de este negocio.',
  pedido_de_otro_negocio: 'Ese pedido no es de este negocio.',
  falta_tenant: 'Falta el negocio.',
};

function traducir(msg) {
  const codigo = Object.keys(MENSAJES).find(c => String(msg).includes(c));
  return codigo ? MENSAJES[codigo] : msg;
}

function exigirTenant(tenantId, quien) {
  if (!tenantId) throw new Error(`${quien}: falta tenantId (sin el, la consulta trae otros negocios)`);
}

/* ─────────────────────────── Lectura ──────────────────────────────── */

/**
 * Lo que este sector todavia no imprimio.
 *
 * Dos consultas y no una: la RPC decide QUE pedidos entran —eso no se puede
 * preguntar desde el cliente sin traerse la tabla de impresiones entera— y la
 * segunda trae los platos. Con dos o tres pedidos en cola, que es el caso
 * real, es mas barato que un join por fila.
 */
export async function fetchComandasPorImprimir(tenantId, sectorId, { branchId = null } = {}) {
  exigirTenant(tenantId, 'fetchComandasPorImprimir');
  if (!sectorId) return [];

  const { data, error } = await supabase.rpc('comandas_por_imprimir', {
    p_tenant_id: tenantId, p_sector_id: sectorId, p_branch_id: branchId,
  });
  if (error) { console.error('fetchComandasPorImprimir:', error.message); return []; }
  if (!data?.length) return [];

  return hidratar(tenantId, data);
}

/**
 * Las que ya salieron por la impresora y nadie cerro todavia.
 *
 * Es el papel que esta dando vueltas por la cocina. La comandera las muestra
 * para poder reimprimir una que se perdio, y el mozo las ve en Salon.
 */
export async function fetchComandasAbiertas(tenantId, sectorId, { branchId = null } = {}) {
  exigirTenant(tenantId, 'fetchComandasAbiertas');

  const { data, error } = await supabase.rpc('comandas_abiertas', {
    p_tenant_id: tenantId, p_sector_id: sectorId || null, p_branch_id: branchId,
  });
  if (error) { console.error('fetchComandasAbiertas:', error.message); return []; }
  if (!data?.length) return [];

  const ids = [...new Set(data.map(d => d.order_id))];
  const { data: pedidos, error: errP } = await supabase
    .from('orders')
    .select(`${COLS_TICKET}, order_items(${COLS_ITEM}), resources(name), staff(name)`)
    .eq('tenant_id', tenantId)
    .in('id', ids);
  if (errP) { console.error('fetchComandasAbiertas (pedidos):', errP.message); return []; }

  const ahora = new Date();
  const porId = new Map((pedidos || []).map(p => [p.id, normalizarTicket(p, ahora)]));
  return data
    .map(d => {
      const ticket = porId.get(d.order_id);
      if (!ticket) return null;
      return { ...ticket, sector_id: d.sector_id, printed_at: d.printed_at, impresiones: d.impresiones };
    })
    .filter(Boolean);
}

async function hidratar(tenantId, filas) {
  const ids = filas.map(f => f.id);
  const { data: items, error } = await supabase
    .from('order_items')
    .select(COLS_ITEM)
    .eq('tenant_id', tenantId)
    .in('order_id', ids);
  if (error) { console.error('fetchComandasPorImprimir (platos):', error.message); return []; }

  const { data: mesas } = await supabase
    .from('resources').select('id, name').eq('tenant_id', tenantId)
    .in('id', filas.map(f => f.resource_id).filter(Boolean));
  const { data: gente } = await supabase
    .from('staff').select('id, name').eq('tenant_id', tenantId)
    .in('id', filas.map(f => f.staff_id).filter(Boolean));

  const nombreMesa = new Map((mesas || []).map(m => [m.id, m.name]));
  const nombreStaff = new Map((gente || []).map(s => [s.id, s.name]));
  const ahora = new Date();

  return filas.map(f => normalizarTicket({
    ...f,
    order_items: (items || []).filter(i => i.order_id === f.id),
    resources: f.resource_id ? { name: nombreMesa.get(f.resource_id) } : null,
    staff: f.staff_id ? { name: nombreStaff.get(f.staff_id) } : null,
  }, ahora));
}

/* ─────────────────────────── Escritura ────────────────────────────── */

/** Queda anotado que el papel salio. Sin `reimprimir`, no vuelve a salir. */
export async function marcarComandaImpresa(tenantId, orderId, sectorId, { reimprimir = false } = {}) {
  exigirTenant(tenantId, 'marcarComandaImpresa');
  const { data, error } = await supabase.rpc('marcar_comanda_impresa', {
    p_tenant_id: tenantId, p_order_id: orderId, p_sector_id: sectorId, p_reimprimir: reimprimir,
  });
  if (error) { console.error('marcarComandaImpresa:', error.message); return { __error: 'db', message: traducir(error.message) }; }
  return data;
}

/**
 * Cerrar lo de UN sector. Lo usa la comandera y lo usa el mozo desde Salon.
 *
 * Sin sector cierra el pedido entero, que es lo que hacia antes. El pedido se
 * sella recien cuando no queda ningun plato pendiente: el cocinero que cierra
 * lo suyo no esta diciendo que la barra ya sirvio los tragos.
 */
export async function cerrarSectorDelTicket(tenantId, orderId, sectorId = null) {
  exigirTenant(tenantId, 'cerrarSectorDelTicket');
  // Sin sector van dos argumentos y no tres con null: ver la nota en
  // `cerrarTicket`, que es la misma funcion vista desde el KDS.
  const args = { p_tenant_id: tenantId, p_order_id: orderId };
  if (sectorId) args.p_sector_id = sectorId;
  const { data, error } = await supabase.rpc('cerrar_ticket_de_cocina', args);
  if (error) { console.error('cerrarSectorDelTicket:', error.message); return { __error: 'db', message: traducir(error.message) }; }
  return data;
}

/* ────────────────────── Reglas de la pantalla ─────────────────────── */

/**
 * La comanda en texto plano, tal como sale por la termica.
 *
 * Texto y no HTML porque una termica imprime CARACTERES: 32 columnas en 58 mm
 * y 48 en 80 mm. Devolverla armada aca —y no dentro del componente— permite
 * probarla sin impresora y sin renderizar nada.
 *
 * LA ESTACION VA EN CADA PLATO
 * En pantalla la estacion es un filtro; en papel es como se REPARTE la hoja
 * en el pasaplatos. Sin ella, la comanda de un sector de cuatro estaciones es
 * una lista que alguien tiene que clasificar a mano.
 */
export function comandaDeSector(ticket, {
  sector = null,
  anchoCols = 32,
  ahora = new Date(),
  timezone,
  reimpresion = false,
} = {}) {
  const linea = (izq, der) => {
    const hueco = Math.max(1, anchoCols - izq.length - der.length);
    return izq + ' '.repeat(hueco) + der;
  };
  const corte = '-'.repeat(anchoCols);
  const hora = (fecha) => (fecha
    ? new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone || undefined,
    }).format(new Date(fecha))
    : '--:--');

  const zona = zonaDelTicket(ticket, ahora);
  const filas = [];

  // La reimpresion se anuncia ARRIBA de todo y ocupa dos renglones. Dos
  // comandas identicas en el pasaplatos son dos platos cocinados: esto es lo
  // unico que lo evita.
  if (reimpresion) filas.push('*** REIMPRESION ***', corte);

  filas.push(linea(
    String(sector?.name || 'PRODUCCIÓN').toLocaleUpperCase('es-AR'),
    ticket.ticket_number ? `N ${ticket.ticket_number}` : ''));
  filas.push(ticket.titulo || tituloDelTicket(ticket, ahora));

  const sub = [];
  if (zona === 'delivery') sub.push('DELIVERY');
  if (zona === 'programado') sub.push('PROGRAMADO');
  if (Number(ticket.diners) > 0) sub.push(`${ticket.diners} comensales`);
  if (ticket.staff_nombre) sub.push(ticket.staff_nombre);
  if (sub.length) filas.push(sub.join(' · '));

  // La alergia va antes de los platos, como en la etiqueta del pasador: quien
  // cocina lee de corrido y esto no puede quedar al final.
  if (ticket.allergy_note) filas.push(corte, `! ${ticket.allergy_note}`);

  filas.push(corte);
  const platos = (ticket.order_items || []).filter(i => !i.ready_at);
  if (!platos.length) filas.push('(sin platos pendientes)');
  for (const i of platos) {
    filas.push(`${i.qty}x ${i.name_snapshot}`);
    if (i.station) filas.push(`   [${String(i.station).toLocaleUpperCase('es-AR')}]`);
    if (i.note) filas.push(`   ${i.note}`);
  }

  filas.push(corte, linea(`Bajo ${hora(ticket.kitchen_at)}`, `Sale ${hora(ahora)}`));

  return filas.join('\n');
}

/**
 * Que sectores le faltan a un pedido, para el mozo que mira la mesa.
 *
 * Devuelve un sector por cada uno que tenga platos sin marcar, con cuantos
 * son y si se despacha en papel. El `modo` es lo que decide si el mozo ve un
 * boton o solo un estado: en un sector con pantalla, el que marca es quien
 * cocina, y dos lugares para lo mismo es la forma mas facil de que un plato
 * se de por entregado sin que nadie lo haya visto.
 */
export function sectoresPendientes(ticket, sectores = []) {
  const pendientes = (ticket?.order_items || []).filter(i => !i.ready_at);
  const porSector = new Map();
  for (const i of pendientes) {
    const id = i.sector_id || 'sin-sector';
    // Se suma la CANTIDAD y no el renglon: dos gaseosas en una linea son dos
    // bebidas que alguien tiene que llevar a la mesa.
    porSector.set(id, (porSector.get(id) || 0) + (Number(i.qty) || 1));
  }

  const salida = [];
  for (const s of sectores) {
    const n = porSector.get(s.id);
    if (!n) continue;
    salida.push({ id: s.id, nombre: s.name, modo: s.mode === 'papel' ? 'papel' : 'pantalla', platos: n });
  }
  // Los huerfanos van al final y con nombre propio: un plato sin sector no
  // aparece en ninguna pantalla, y esconderlo aca seria esconderlo dos veces.
  if (porSector.get('sin-sector')) {
    salida.push({
      id: 'sin-sector', nombre: 'Sin sector', modo: 'papel',
      platos: porSector.get('sin-sector'), huerfano: true,
    });
  }
  return salida;
}

/** Minutos que hace que salio el papel. Lo que la comandera muestra y ordena. */
export function minutosDesde(fecha, ahora = new Date()) {
  if (!fecha) return 0;
  return Math.max(0, (ahora.getTime() - new Date(fecha).getTime()) / 60000);
}
