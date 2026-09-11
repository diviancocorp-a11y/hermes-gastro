// src/services/platformInventory.js
// Insumos del edificio (tabla `ingredients`, migracion 0026). ETAPA 1.
//
// `ingredients` existe en las dos bases, con el mismo juego de columnas salvo
// `tenant_id` (y el id, que aca es uuid). Por eso este archivo esta en
// PLATFORM_PATHS: sin eso el pre-commit lo validaria contra el snapshot legacy.
//
// Igual que en los otros services de la plataforma: RLS decide QUE PODES ver,
// el filtro por tenant_id decide QUE ESTAS MIRANDO.

import { supabase } from '../lib/supabase';
import { claveDeIdempotencia, reiniciarClave } from '../lib/idempotencia.js';

// Literal a proposito: check-supabase-columns solo resuelve constantes de
// modulo con string literal, no listas armadas en runtime.
const COLS = 'id, tenant_id, name, unit, cost, stock, min_stock, category, food_category, is_archived, created_at, supplier_id';

export { COLS as SELECT_COLS };

// Lo que el formulario puede escribir. tenant_id se agrega aparte; id y
// created_at los maneja la DB.
export const CAMPOS_EDITABLES = [
  'name', 'unit', 'cost', 'stock', 'min_stock', 'category', 'food_category', 'is_archived',
  'supplier_id',
];

// Los `raise exception` de las RPC de inventario llegan como texto crudo.
const MENSAJES_INVENTARIO = {
  no_sos_miembro: 'No sos parte de este negocio.',
  insumo_de_otro_negocio: 'Ese insumo no es de este negocio.',
  cantidad_invalida: 'La cantidad no puede ser 0.',
  movimiento_no_manual: 'Ese movimiento lo asienta el sistema, no se carga a mano.',
  conteo_invalido: 'El conteo llego mal armado.',
  falta_tenant: 'Falta el negocio.',
};

function traducirInventario(msg) {
  const codigo = Object.keys(MENSAJES_INVENTARIO).find(c => String(msg).includes(c));
  return codigo ? MENSAJES_INVENTARIO[codigo] : msg;
}

function exigirTenant(tenantId, quien) {
  if (!tenantId) throw new Error(`${quien}: falta tenantId (sin el, la consulta trae otros negocios)`);
}

/**
 * Insumos del tenant. Por defecto sin archivados: Stock.jsx espera la lista
 * viva, y el archivado es su forma de "borrar" sin perder el historico.
 */
export async function fetchIngredients(tenantId, { incluirArchivados = false } = {}) {
  exigirTenant(tenantId, 'fetchIngredients');
  let q = supabase
    .from('ingredients')
    .select(COLS)
    .eq('tenant_id', tenantId);
  if (!incluirArchivados) q = q.eq('is_archived', false);

  const { data, error } = await q.order('name');
  if (error) { console.error('fetchIngredients:', error.message); return []; }
  return data || [];
}

/** Devuelve array de errores (vacio = ok). */
export function validateIngredient(ing) {
  const errs = [];
  if (!ing?.name?.trim()) errs.push('El nombre no puede estar vacio');

  for (const [campo, etiqueta] of [['cost', 'El costo'], ['stock', 'El stock'], ['min_stock', 'El stock minimo']]) {
    const raw = ing?.[campo];
    if (raw === '' || raw == null) continue; // opcional: la DB tiene default 0
    const n = Number(raw);
    // Ojo con el vacio: Number('') es 0 y pasaria como valido. Por eso se
    // descarta arriba en vez de dejar que caiga aca.
    if (!Number.isFinite(n) || n < 0) errs.push(`${etiqueta} tiene que ser un numero de 0 o mas`);
  }
  return errs;
}

function toRow(ing, tenantId) {
  const num = (v) => (v === '' || v == null ? 0 : Number(v));
  return {
    ...(ing.id ? { id: ing.id } : {}),
    tenant_id: tenantId,
    name: ing.name.trim(),
    unit: ing.unit?.trim() || null,
    cost: num(ing.cost),
    stock: num(ing.stock),
    min_stock: num(ing.min_stock),
    category: ing.category?.trim() || null,
    food_category: ing.food_category?.trim() || null,
    is_archived: !!ing.is_archived,
    // Columna 0071. Va explicita y no por spread: si se olvidara aca, el
    // upsert la descartaria en silencio y sin error, que es el bug que este
    // repo ya se comio cuatro veces (ver CLAUDE.md).
    supplier_id: ing.supplier_id || null,
  };
}

export async function upsertIngredient(tenantId, ing) {
  exigirTenant(tenantId, 'upsertIngredient');
  const errs = validateIngredient(ing);
  if (errs.length) return { __error: 'validation', message: errs.join('. ') };

  const { data, error } = await supabase
    .from('ingredients')
    .upsert(toRow(ing, tenantId))
    .select(COLS)
    .single();

  if (error) {
    console.error('upsertIngredient:', error.message);
    // Indice unico parcial por (tenant_id, lower(name)) sobre no archivados.
    if (error.code === '23505') {
      return { __error: 'duplicate', message: `Ya tenés un insumo que se llama "${ing.name.trim()}"` };
    }
    return { __error: 'db', message: error.message };
  }
  return data;
}

/**
 * Archivar en vez de borrar: el insumo puede estar referenciado por recetas
 * (Etapa 2) y por compras (Etapa 3). Sale del listado y libera el nombre.
 */
export async function archiveIngredient(id) {
  const { error } = await supabase.from('ingredients').update({ is_archived: true }).eq('id', id);
  if (error) { console.error('archiveIngredient:', error.message); return false; }
  return true;
}

export async function unarchiveIngredient(id) {
  const { error } = await supabase.from('ingredients').update({ is_archived: false }).eq('id', id);
  if (error) { console.error('unarchiveIngredient:', error.message); return false; }
  return true;
}

/**
 * Mueve el stock de un insumo POR EL LIBRO (migracion 0071).
 *
 * Reemplaza al viejo `adjustStock`, que leia y escribia en dos pasos —dos
 * ajustes simultaneos del mismo insumo se pisaban— y ademas no asentaba nada:
 * `ingredients.stock` quedaba corrido del libro sin que nada lo delatara.
 *
 * `qty` va FIRMADA: positiva agrega, negativa saca.
 * @returns la fila de ingredients ya actualizada, o `{ __error }`.
 */
export async function moverStock({ tenantId, ingredientId, kind, qty, note = null }) {
  exigirTenant(tenantId, 'moverStock');
  const cantidad = Number(qty);
  if (!cantidad || !Number.isFinite(cantidad)) {
    return { __error: 'cantidad_invalida', message: 'La cantidad no puede ser 0.' };
  }

  const { data, error } = await supabase.rpc('mover_stock_de_insumo', {
    p_tenant_id: tenantId,
    p_ingredient_id: ingredientId,
    p_kind: kind,
    p_qty: cantidad,
    p_note: note || null,
    p_client_request_id: claveDeIdempotencia(
      'mover-stock', [tenantId, ingredientId, kind, cantidad, note || null]),
  });

  if (error) {
    // La clave NO se reinicia: un reintento por red caida tiene que llevar la
    // misma o el insumo se mueve dos veces.
    console.error('moverStock:', error.message);
    return { __error: 'db', message: traducirInventario(error.message) };
  }
  reiniciarClave('mover-stock');
  return data;
}

/** Reponer: entra mercaderia. Siempre suma, asi que toma el valor absoluto. */
export function reponerInsumo({ tenantId, ingredientId, qty, note = null }) {
  return moverStock({
    tenantId, ingredientId, kind: 'purchase', qty: Math.abs(Number(qty) || 0), note,
  });
}

/**
 * Ajustar contra lo contado: el operador dice cuanto HAY, no cuanto cambia.
 * La diferencia la calcula esta funcion porque es la que conoce los dos
 * numeros; la RPC recibe el delta, que es lo que el libro sabe guardar.
 */
export function ajustarInsumoContado({ tenantId, ingrediente, contado, note = null }) {
  const delta = Number(contado) - Number(ingrediente?.stock || 0);
  if (!delta) return Promise.resolve(ingrediente);
  return moverStock({
    tenantId, ingredientId: ingrediente.id, kind: 'adjustment', qty: delta,
    note: note || 'ajuste por conteo',
  });
}

/**
 * El conteo de deposito entero, en UNA transaccion (RPC 0071).
 *
 * Guardar de a uno dejaria medio deposito contado si el operador corta a la
 * mitad, sin forma de saber cual mitad. Los insumos cuyo conteo coincide con
 * lo registrado no generan movimiento: el libro guarda cambios, no fotos.
 *
 * @param conteos [{ ingredient_id, contado }]
 */
export async function guardarConteoDeDeposito({ tenantId, conteos, note = null }) {
  exigirTenant(tenantId, 'guardarConteoDeDeposito');
  const filas = (conteos || [])
    .filter(c => c && c.ingredient_id && Number.isFinite(Number(c.contado)))
    .map(c => ({ ingredient_id: c.ingredient_id, contado: Number(c.contado) }));
  if (!filas.length) return { __error: 'conteo_vacio', message: 'No hay nada que guardar.' };

  const { data, error } = await supabase.rpc('guardar_conteo_de_deposito', {
    p_tenant_id: tenantId,
    p_conteos: filas,
    p_note: note || null,
    p_client_request_id: claveDeIdempotencia('conteo', [tenantId, filas]),
  });

  if (error) {
    console.error('guardarConteoDeDeposito:', error.message);
    return { __error: 'db', message: traducirInventario(error.message) };
  }
  reiniciarClave('conteo');
  return data || [];
}

/**
 * Cuanto se consume por dia, del libro (RPC 0071).
 *
 * Es lo que convierte "2.5 kg" en "alcanza para 0.4 dias". Un insumo sin
 * movimientos no aparece en el resultado: la pantalla omite la linea en vez
 * de mostrar un cero que se leeria como "no se consume".
 *
 * @returns {Promise<Map<string, {consumoDiario:number, dias:number}>>}
 */
export async function fetchConsumoDiario(tenantId, dias = 14) {
  exigirTenant(tenantId, 'fetchConsumoDiario');
  const { data, error } = await supabase.rpc('consumo_diario_de_insumos', {
    p_tenant_id: tenantId,
    p_dias: dias,
  });
  if (error) { console.error('fetchConsumoDiario:', error.message); return new Map(); }
  return new Map((data || []).map(r => [
    r.ingredient_id,
    { consumoDiario: Number(r.consumo_diario) || 0, dias: Number(r.dias_con_movimiento) || 0 },
  ]));
}

/**
 * Dias que alcanza el stock al ritmo actual. `null` cuando no se puede saber,
 * que NO es lo mismo que cero: sin consumo medido la pregunta no tiene
 * respuesta, y responder "0 dias" seria una alarma inventada.
 */
export function diasDeCobertura(stock, consumoDiario) {
  const c = Number(consumoDiario);
  if (!Number.isFinite(c) || c <= 0) return null;
  return Number(stock || 0) / c;
}

/**
 * Nivel del insumo contra su minimo, de 0 a 1, y el estado que le corresponde.
 *
 * `min_stock` en 0 no es "esta perfecto": es "nadie definio el minimo". Hoy
 * NINGUN insumo del edificio lo tiene cargado, asi que este caso es el normal
 * y no el borde. Devuelve `nivel: null` para que la fila muestre la barra
 * apagada y pida el dato, en vez de pintar todo en verde y mentir.
 */
export function nivelContraMinimo(ing) {
  const min = Number(ing?.min_stock) || 0;
  const stock = Number(ing?.stock) || 0;
  if (min <= 0) return { nivel: null, estado: 'sin-minimo' };
  const nivel = Math.min(stock / min, 1);
  if (stock <= min * 0.5) return { nivel, estado: 'critico' };
  if (stock < min) return { nivel, estado: 'bajo' };
  return { nivel, estado: 'ok' };
}

/**
 * Cuanto suma cada toque en el conteo de deposito. Las unidades continuas
 * —peso y volumen— se cuentan en fracciones; lo que se cuenta de a bultos va
 * de a uno, porque media caja de delivery no existe.
 */
export function pasoDe(unidad) {
  const u = String(unidad || '').trim().toLocaleLowerCase('es-AR');
  if (['kg', 'kilo', 'kilos', 'l', 'lt', 'litro', 'litros'].includes(u)) return 0.5;
  if (['g', 'gr', 'gramo', 'gramos', 'ml', 'cc'].includes(u)) return 50;
  return 1;
}

/** Insumos en o por debajo del minimo. Calculo local: la lista ya esta en memoria. */
export function bajoMinimo(ingredientes) {
  return ingredientes.filter(i => Number(i.stock) <= Number(i.min_stock) && Number(i.min_stock) > 0);
}
