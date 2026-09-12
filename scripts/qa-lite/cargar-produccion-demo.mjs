#!/usr/bin/env node
/**
 * Un servicio en curso sobre el fixture de QA Lite: sectores, estaciones,
 * platos con estacion asignada y tickets vivos en la cocina y en la barra.
 *
 * POR QUE EXISTE
 * El KDS y Produccion (0072-0074) dibujan sus estructuras SOLO cuando hay
 * filas. Con el fixture limpio hay cero sectores, cero estaciones y cero
 * pedidos bajados a cocina, asi que las dos pantallas se ven vacias y parece
 * que la funcionalidad no esta. Peor: el KDS vacio es indistinguible del KDS
 * roto. Esto carga lo minimo para que se vea lo que hace.
 *
 * LO QUE ESTA CARGA DEMUESTRA, Y NO SE PUEDE VER DE OTRA FORMA
 *   1. La barra no ve la milanesa y la cocina no ve la limonada. Hay tickets
 *      MIXTOS a proposito: el mismo ticket aparece en las dos pantallas con
 *      platos distintos. Un ticket de un solo sector no probaria nada.
 *   2. El umbral es del sector. La cocina espera 18 minutos y la barra 5, asi
 *      que hay un ticket de 8 minutos que en cocina esta tranquilo y en barra
 *      esta rojo. Con un umbral comun eso no se puede mostrar.
 *   3. Un ticket a medio hacer: platos marcados y platos pendientes conviviendo.
 *
 * NO TOCA EL SEED. Ids fijos y upsert: correrlo dos veces deja lo mismo.
 * `npm run qa:lite:setup` vuelve al fixture limpio.
 *
 * OJO CON LOS GATES DE PIXEL: visual-parity y los dico-* dependen del fixture
 * exacto. Antes de correrlos hay que volver al seed limpio.
 *
 *   node scripts/qa-lite/cargar-productos-demo.mjs    # primero: el catalogo
 *   node scripts/qa-lite/cargar-produccion-demo.mjs
 *   node scripts/qa-lite/cargar-produccion-demo.mjs --limpiar
 *
 * LOS MINUTOS SON RELATIVOS A AHORA, no fijos como en el seed. El cronometro
 * del KDS cuenta contra el reloj del navegador: con una hora fija, el ticket
 * "recien bajado" aparece con dos dias de demora al dia siguiente.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { REPO_ROOT, getLocalStatus, assertLocalUrl, QA_TENANT_ID } from '../../platform/qa-lite/lib.mjs';

const LIMPIAR = process.argv.includes('--limpiar');
const BRANCH_ID = '20000000-0000-4000-8000-000000000001';

/* Ids fijos en bloques que no chocan con el seed (1..9) ni con el catalogo de
   revision (3000...9xxx). */
const id = (bloque, n) => `${bloque}000000-0000-4000-8000-00000000000${n}`;

const COCINA = id('a1', 1);
const BARRA = id('a2', 1);

const EST = {
  parrilla: { id: id('a3', 1), sector_id: COCINA, name: 'Parrilla', short_name: 'PAR', orden: 0 },
  plancha: { id: id('a3', 2), sector_id: COCINA, name: 'Plancha', short_name: 'PLA', orden: 1 },
  frios: { id: id('a3', 3), sector_id: COCINA, name: 'Fríos', short_name: 'FRÍ', orden: 2 },
  postres: { id: id('a3', 4), sector_id: COCINA, name: 'Postres', short_name: 'POS', orden: 3 },
  barra: { id: id('a3', 5), sector_id: BARRA, name: 'Barra', short_name: 'BAR', orden: 0 },
  cafeteria: { id: id('a3', 6), sector_id: BARRA, name: 'Cafetería', short_name: 'CAF', orden: 1 },
};

/* ─────────────────── Que se hace donde ────────────────────────────────
 *
 * Por NOMBRE cuando importa el metodo de coccion y no el rubro: una provoleta
 * es una entrada y va a la parrilla; una milanesa es un principal y va a la
 * plancha. Por CATEGORIA para todo lo demas, que es lo que hace que esto
 * siga funcionando si Ricky agrega un producto a mano.
 */
// El orden es la regla: gana el primero que matchea. "Pollo grillado con
// ensalada" va a la parrilla, no a frios — lo que decide es como se cocina,
// y la guarnicion viene despues.
const POR_NOMBRE = [
  [/provoleta|bife|chorizo|rabas|parrilla|grillad/i, 'parrilla'],
  [/^ensalada|carpaccio|ceviche/i, 'frios'],
  [/caf[eé]|submarino|cortado|capuchino/i, 'cafeteria'],
];

const POR_CATEGORIA = {
  Principales: 'plancha',
  Entradas: 'parrilla',
  Postres: 'postres',
  Bebidas: 'barra',
  Cafeteria: 'cafeteria',
};

export function estacionDe(producto) {
  const nombre = String(producto?.name || '');
  for (const [patron, clave] of POR_NOMBRE) if (patron.test(nombre)) return clave;
  return POR_CATEGORIA[producto?.category] || 'frios';
}

/* ─────────────────── El servicio en curso ─────────────────────────────
 *
 * `min` son los minutos que el ticket lleva EN COCINA. Contra el umbral de
 * cocina (18) y el de barra (5) dan las tres zonas de las dos pantallas.
 */
const SERVICIO = [
  {
    n: 1, min: 2, mesa: 'Mesa QA 2', diners: 2,
    platos: [['Provoleta a la parrilla', 1], ['Milanesa napolitana con papas', 2]],
  },
  {
    n: 2, min: 12, mesa: 'Mesa QA 5', diners: 4,
    alergia: 'Una persona sin TACC: la milanesa no va',
    platos: [
      ['Bife de chorizo (300g)', 2, 'uno a punto, uno jugoso'],
      ['Ravioles de ricota y nuez', 1],
      ['Gaseosa linea Coca-Cola', 2],
      ['Vino Malbec copa', 1],
    ],
  },
  {
    n: 3, min: 26, mostrador: 'Retira Bruno', diners: 1,
    platos: [
      ['Risotto de hongos', 1, null, true],
      ['Rabas', 1],
      ['Agua mineral 500ml', 1, null, true],
    ],
  },
  {
    n: 4, min: 8, envio: true, cliente: 'Ana · delivery', diners: 2,
    platos: [
      ['Pollo grillado con ensalada', 1],
      ['Cerveza artesanal pinta', 2],
    ],
  },
  {
    n: 5, min: 1, mesa: 'Mesa QA 3', diners: 3,
    platos: [
      ['Flan casero con dulce de leche', 1],
      ['Tiramisu', 2],
      ['Cafe cortado', 3],
    ],
  },
  {
    n: 6, min: 9, mostrador: 'Barra 3', diners: 2,
    platos: [['Submarino', 2], ['Gaseosa linea Coca-Cola', 1]],
  },
];

const ORDENES = SERVICIO.map(t => id('a4', t.n));

/* La conexion se arma cuando se CORRE, no cuando se importa: `estacionDe` se
   prueba en `e2e/qa-lite/unit`, y con el cliente en el tope del modulo ese
   test levantaba Supabase para leer una tabla de reglas. */
let db = null;
function conectar() {
  if (db) return db;
  const status = getLocalStatus();
  assertLocalUrl(status.apiUrl, 'Supabase API URL');
  db = createClient(status.apiUrl, status.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return db;
}

const morir = (paso, error) => {
  if (!error) return;
  console.error(`${paso}: ${error.message}`);
  process.exit(1);
};

const AHORA = Date.now();
const haceMinutos = (m) => new Date(AHORA - m * 60000).toISOString();

async function limpiar() {
  const db = conectar();
  // Los items cuelgan del pedido; los productos vuelven a quedar sin estacion
  // antes de borrar las estaciones, o la FK no deja.
  await db.from('order_items').delete().in('order_id', ORDENES);
  await db.from('orders').delete().in('id', ORDENES);
  morir('soltar productos', (await db.from('products')
    .update({ station_id: null, station: null })
    .eq('tenant_id', QA_TENANT_ID)).error);
  await db.from('production_stations').delete().in('id', Object.values(EST).map(e => e.id));
  await db.from('production_sectors').delete().in('id', [COCINA, BARRA]);
  console.log('[demo] produccion limpiada: sin sectores, sin estaciones, sin cocina.');
}

async function cargar() {
  const db = conectar();
  morir('sectores', (await db.from('production_sectors').upsert([
    { id: COCINA, tenant_id: QA_TENANT_ID, name: 'Cocina', mode: 'pantalla', umbral_min: 18, orden: 0, active: true },
    // La barra en PAPEL: es la configuracion por la que se hizo la 0075.
    // Cocina con monitor y barra con comandera, mezcladas en el mismo local.
    { id: BARRA, tenant_id: QA_TENANT_ID, name: 'Barra', mode: 'papel', umbral_min: 5, orden: 1, active: true },
  ], { onConflict: 'id' })).error);

  morir('estaciones', (await db.from('production_stations').upsert(
    Object.values(EST).map(e => ({ ...e, tenant_id: QA_TENANT_ID, active: true })),
    { onConflict: 'id' },
  )).error);

  // Cada producto a su estacion. Sin esto el KDS se ve vacio aunque haya
  // pedidos: es el modo de fallar mas caro del circuito.
  const { data: productos, error: errProd } = await db
    .from('products').select('id, name, category').eq('tenant_id', QA_TENANT_ID);
  morir('leer productos', errProd);

  const porNombre = new Map();
  for (const p of productos || []) {
    const est = EST[estacionDe(p)];
    porNombre.set(p.name, { ...p, est });
    morir(`estacion de ${p.name}`, (await db.from('products')
      .update({ station_id: est.id, station: est.name })
      .eq('id', p.id)).error);
  }

  // Las mesas: el KDS muestra el NOMBRE de la mesa en vez del numero de
  // ticket, y para eso el pedido tiene que apuntar a un recurso que exista.
  // Si la mesa del guion no esta —el fixture limpio trae una sola—, cae en la
  // primera disponible antes que quedar sin mesa: un ticket de salon sin
  // recurso se dibuja como mostrador y tapa justamente lo que hay que mirar.
  const { data: recursos, error: errRec } = await db
    .from('resources').select('id, name').eq('tenant_id', QA_TENANT_ID).eq('kind', 'table');
  morir('leer mesas', errRec);
  const mesas = new Map((recursos || []).map(r => [r.name, r.id]));
  const primeraMesa = recursos?.[0]?.id || null;
  const mesaDe = (nombre) => (nombre ? mesas.get(nombre) || primeraMesa : null);

  // Los pedidos se rehacen enteros: el trigger `item_hereda_su_estacion`
  // corre BEFORE INSERT y un upsert que actualiza no lo dispara. Igual se
  // manda la estacion explicita, asi la carga no depende del trigger.
  await db.from('order_items').delete().in('order_id', ORDENES);
  await db.from('orders').delete().in('id', ORDENES);

  const pedidos = [];
  const items = [];
  let faltantes = 0;

  for (const t of SERVICIO) {
    const orderId = id('a4', t.n);
    let total = 0;
    const propios = [];

    t.platos.forEach(([nombre, qty, nota, listo], i) => {
      const p = porNombre.get(nombre);
      if (!p) { faltantes += 1; return; }
      propios.push({
        // Ultimo grupo: 10 ceros + ticket + posicion. Armarlo con `id()` y
        // recortar daba el MISMO uuid para el primer plato de cada ticket.
        id: `a5000000-0000-4000-8000-0000000000${t.n}${i}`,
        tenant_id: QA_TENANT_ID,
        order_id: orderId,
        product_id: p.id,
        name_snapshot: p.name,
        unit_price: 0,
        unit_cost: 0,
        qty,
        subtotal: 0,
        station: p.est.name,
        station_id: p.est.id,
        sector_id: p.est.sector_id,
        note: nota || null,
        ready_at: listo ? haceMinutos(Math.max(1, t.min - 4)) : null,
        created_at: haceMinutos(t.min + 2),
      });
      total += qty * 1000;
    });

    pedidos.push({
      id: orderId,
      tenant_id: QA_TENANT_ID,
      branch_id: BRANCH_ID,
      resource_id: mesaDe(t.mesa),
      status: 'preparing',
      channel: t.envio ? 'catalog' : 'pos',
      // NOT NULL con default 'retiro' (0012). Los unicos dos valores que el
      // Zod acepta son esos: poner otro rompe la zona del ticket.
      delivery: t.envio ? 'envio' : 'retiro',
      customer_name: t.cliente || t.mesa || t.mostrador,
      diners: t.diners,
      allergy_note: t.alergia || null,
      ticket_number: 100 + t.n,
      subtotal: total,
      total,
      payment: 'efectivo',
      payment_status: 'pending',
      kitchen_at: haceMinutos(t.min),
      ready_at: null,
      created_at: haceMinutos(t.min + 2),
    });
    items.push(...propios);
  }

  morir('pedidos en cocina', (await db.from('orders').insert(pedidos)).error);
  morir('platos', (await db.from('order_items').insert(items)).error);

  const enCocina = items.filter(i => i.sector_id === COCINA).length;
  const enBarra = items.filter(i => i.sector_id === BARRA).length;

  const salida = join(REPO_ROOT, '.qa-lite', 'produccion-demo.txt');
  mkdirSync(join(REPO_ROOT, '.qa-lite'), { recursive: true });
  writeFileSync(salida, [
    'Produccion y KDS — QA Lite',
    '',
    `Sectores    Cocina (umbral 18 min) · Barra (umbral 5 min)`,
    `Estaciones  ${Object.values(EST).map(e => e.short_name).join(' · ')}`,
    `Productos   ${productos.length} con estacion asignada`,
    `Tickets     ${pedidos.length} en cocina · ${enCocina} platos en Cocina · ${enBarra} en Barra`,
    '',
    'Que mirar',
    '  Produccion  los dos sectores, sus estaciones y el modo de cada uno',
    '  Cocina      Mesa QA 2 en verde, Mesa QA 5 en atencion, Retira Bruno en rojo',
    '  Barra       la COMANDERA: cola de impresion y papel sin cerrar',
    '  Salon       la mesa dice que le debe cada sector, y cierra la barra',
    '',
    'Data de revision. `npm run qa:lite:setup` vuelve al fixture limpio.',
    '',
  ].join('\n'), 'utf8');

  console.log(`[demo] 2 sectores, ${Object.keys(EST).length} estaciones`);
  console.log(`[demo] ${productos.length} productos con estacion`);
  console.log(`[demo] ${pedidos.length} tickets en cocina (${enCocina} platos en Cocina, ${enBarra} en Barra)`);
  if (faltantes) {
    console.log(`[demo] ${faltantes} plato(s) del guion no existen en el catalogo.`);
    console.log('[demo] Corre antes: node scripts/qa-lite/cargar-productos-demo.mjs');
  }
  console.log(`[demo] Resumen en ${salida.replace(REPO_ROOT, '.')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (LIMPIAR) await limpiar();
  else await cargar();
}
