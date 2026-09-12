// src/services/platformProduccion.js
// Sectores y estaciones de produccion (migracion 0074).
//
// SECTOR Y ESTACION NO SON LO MISMO
//   sector    lo que tiene pantalla propia o impresora propia. Cocina, Barra.
//   estacion  donde se hace el plato dentro del sector. Parrilla, Plancha.
//
// El sector es la unidad de DESPACHO y la estacion la unidad de TRABAJO. La
// barra no es una estacion mas de la cocina: es otro lugar, con otra gente,
// otro ritmo y otro umbral de demora. Un gin tonic sale en tres minutos y un
// asado en veinticinco.

import { supabase } from '../lib/supabase';

const COLS_SECTOR = 'id, tenant_id, name, mode, umbral_min, orden, active, created_at';
const COLS_ESTACION = 'id, tenant_id, sector_id, name, short_name, orden, active, created_at';

const MENSAJES = {
  no_sos_miembro: 'No sos parte de este negocio.',
  no_alcanza_el_rol: 'Sólo el dueño o un encargado pueden cambiar esto.',
  falta_tenant: 'Falta el negocio.',
};

function traducir(msg) {
  const codigo = Object.keys(MENSAJES).find(c => String(msg).includes(c));
  if (codigo) return MENSAJES[codigo];
  // Indice unico parcial por (tenant_id, lower(name)).
  if (String(msg).includes('production_sectors_nombre_idx')) return 'Ya tenés un sector con ese nombre.';
  if (String(msg).includes('production_stations_nombre_idx')) return 'Ya tenés una estación con ese nombre.';
  return msg;
}

function exigirTenant(tenantId, quien) {
  if (!tenantId) throw new Error(`${quien}: falta tenantId (sin el, la consulta trae otros negocios)`);
}

/* ─────────────────────────── Lectura ──────────────────────────────── */

/** Los sectores del negocio, con sus estaciones, en el orden del circuito. */
export async function fetchSectores(tenantId) {
  exigirTenant(tenantId, 'fetchSectores');
  const { data, error } = await supabase
    .from('production_sectors')
    .select(`${COLS_SECTOR}, production_stations(${COLS_ESTACION})`)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('orden');

  if (error) { console.error('fetchSectores:', error.message); return []; }
  return (data || []).map(s => ({
    ...s,
    estaciones: (s.production_stations || [])
      .filter(e => e.active)
      .sort((a, b) => a.orden - b.orden),
  }));
}

/* ─────────────────────────── Escritura ────────────────────────────── */

/**
 * El juego tipico de una cocina: Cocina con cuatro estaciones y Barra con una.
 * Es idempotente del lado de la base: llamarla dos veces no duplica nada.
 */
export async function crearSectoresTipicos(tenantId) {
  exigirTenant(tenantId, 'crearSectoresTipicos');
  const { data, error } = await supabase.rpc('crear_sectores_tipicos', { p_tenant_id: tenantId });
  if (error) { console.error('crearSectoresTipicos:', error.message); return { __error: 'db', message: traducir(error.message) }; }
  return data || [];
}

export async function guardarSector(tenantId, sector) {
  exigirTenant(tenantId, 'guardarSector');
  const nombre = String(sector?.name || '').trim();
  if (!nombre) return { __error: 'validacion', message: 'El sector necesita un nombre.' };
  const umbral = Number(sector.umbral_min);
  if (!Number.isFinite(umbral) || umbral <= 0) {
    return { __error: 'validacion', message: 'El umbral tiene que ser mayor a cero.' };
  }

  const fila = {
    ...(sector.id ? { id: sector.id } : {}),
    tenant_id: tenantId,
    name: nombre,
    mode: sector.mode === 'papel' ? 'papel' : 'pantalla',
    umbral_min: Math.round(umbral),
    orden: Number(sector.orden) || 0,
    active: sector.active !== false,
  };

  const { data, error } = await supabase
    .from('production_sectors').upsert(fila).select(COLS_SECTOR).single();
  if (error) { console.error('guardarSector:', error.message); return { __error: 'db', message: traducir(error.message) }; }
  return data;
}

export async function guardarEstacion(tenantId, estacion) {
  exigirTenant(tenantId, 'guardarEstacion');
  const nombre = String(estacion?.name || '').trim();
  if (!nombre) return { __error: 'validacion', message: 'La estación necesita un nombre.' };
  if (!estacion?.sector_id) return { __error: 'validacion', message: 'La estación tiene que estar en un sector.' };

  const fila = {
    ...(estacion.id ? { id: estacion.id } : {}),
    tenant_id: tenantId,
    sector_id: estacion.sector_id,
    name: nombre,
    short_name: String(estacion.short_name || '').trim() || null,
    orden: Number(estacion.orden) || 0,
    active: estacion.active !== false,
  };

  const { data, error } = await supabase
    .from('production_stations').upsert(fila).select(COLS_ESTACION).single();
  if (error) { console.error('guardarEstacion:', error.message); return { __error: 'db', message: traducir(error.message) }; }
  return data;
}

/**
 * Dar de baja, no borrar. Un sector borrado se llevaria puestas sus
 * estaciones por cascada, y con ellas la estacion que apuntan los productos.
 * Desactivar lo saca de las pantallas y deja el historico en pie.
 */
export async function desactivarSector(id) {
  const { error } = await supabase.from('production_sectors').update({ active: false }).eq('id', id);
  if (error) { console.error('desactivarSector:', error.message); return false; }
  return true;
}

export async function desactivarEstacion(id) {
  const { error } = await supabase.from('production_stations').update({ active: false }).eq('id', id);
  if (error) { console.error('desactivarEstacion:', error.message); return false; }
  return true;
}

/* ────────────────────── Reglas de la pantalla ─────────────────────── */

/**
 * La abreviatura que muestra la tablet. Si el local no la cargo, se corta el
 * nombre en tres letras, que es lo que hacia el KDS antes de que las
 * estaciones existieran como entidad.
 */
export function abreviar(estacion) {
  const corta = String(estacion?.short_name || '').trim();
  if (corta) return corta.toLocaleUpperCase('es-AR');
  return String(estacion?.name || '').trim().slice(0, 3).toLocaleUpperCase('es-AR');
}

/**
 * Los platos de UN sector dentro de un ticket.
 *
 * Es lo que hace que la barra no vea la milanesa: el ticket es el mismo, pero
 * cada pantalla muestra solo su parte. Un ticket sin nada de ese sector
 * devuelve lista vacia y la pantalla no lo dibuja.
 */
export function platosDelSector(ticket, sectorId) {
  const items = ticket?.order_items || [];
  if (!sectorId) return items;
  return items.filter(i => i.sector_id === sectorId);
}

/**
 * El ticket recortado a un sector, listo para el KDS de ese sector.
 * Devuelve `null` cuando no le toca nada: asi el filtrado es un `.filter`
 * sobre el resultado y no hay que preguntar dos veces.
 */
export function ticketDelSector(ticket, sectorId) {
  const propios = platosDelSector(ticket, sectorId);
  if (!propios.length) return null;
  return { ...ticket, order_items: propios };
}

/**
 * Cuantos tickets tiene cada sector esperando. Es el numero que decide si
 * hace falta abrir la pantalla de la barra o si esta todo en cocina.
 */
export function pendientesPorSector(tickets, sectores) {
  const cuenta = new Map(sectores.map(s => [s.id, 0]));
  for (const t of tickets) {
    for (const s of sectores) {
      const propios = platosDelSector(t, s.id);
      if (propios.some(i => !i.ready_at)) cuenta.set(s.id, (cuenta.get(s.id) || 0) + 1);
    }
  }
  return cuenta;
}
