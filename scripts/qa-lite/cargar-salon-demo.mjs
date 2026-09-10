#!/usr/bin/env node
/**
 * Carga salon, mesas, llamados y una mini caja sobre el fixture de QA Lite,
 * y crea un mozo con el que entrar a mirarlo.
 *
 * POR QUE EXISTE
 * El seed determinista tiene UNA mesa y ningun llamado, ninguna visita y
 * ninguna rendicion. Las pantallas de Salon y Caja dibujan sus estructuras
 * nuevas SOLO cuando hay filas, asi que con el fixture limpio se ven vacias
 * y parece que la funcionalidad no esta. Esta carga hace visible lo que la
 * 0067 y la 0069 agregaron.
 *
 * NO TOCA EL SEED. Escribe encima, con ids fijos y `upsert`, asi correrlo dos
 * veces deja lo mismo. `npm run qa:lite:setup` vuelve al fixture limpio.
 *
 * OJO CON LOS GATES DE PIXEL: visual-parity y los dico-* dependen del fixture
 * exacto. Antes de correrlos hay que volver al seed limpio.
 *
 *   node scripts/qa-lite/cargar-salon-demo.mjs
 *   node scripts/qa-lite/cargar-salon-demo.mjs --limpiar
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { REPO_ROOT, getLocalStatus, assertLocalUrl, QA_TENANT_ID } from '../../platform/qa-lite/lib.mjs';

const BRANCH_ID = '20000000-0000-4000-8000-000000000001';
const SESION_CAJA = '70000000-0000-4000-8000-000000000001';
const MESA_SEED = '80000000-0000-4000-8000-000000000001';
const EMAIL_MOZO = 'mozo.qa-lite@local.test';

// Ids fijos: correr esto dos veces tiene que dejar la base igual, no duplicar.
const id = (bloque, n) => `${bloque}000000-0000-4000-8000-00000000000${n}`;
const MESAS = [2, 3, 4, 5].map((n) => ({
  id: id('81', n),
  name: `Mesa QA ${n}`,
  zone: n > 3 ? 'Patio' : 'Salon',
  capacity: n === 5 ? 8 : 4,
  pos_x: 20 + n * 18,
  pos_y: n > 3 ? 55 : 20,
  shape: n === 5 ? 'rect' : 'round',
}));

const STAFF_ID = id('82', 1);
const VISITA_A = id('83', 1);   // Mesa QA 2 — autogestion, con comanda por revisar
const VISITA_B = id('84', 1);   // Mesa QA 5 — atendida, con llamado tomado
const ORDEN_REVISION = id('85', 1);
const RENDICION = id('86', 1);

const AHORA = new Date();
const haceMinutos = (m) => new Date(AHORA.getTime() - m * 60000).toISOString();

const status = getLocalStatus();
assertLocalUrl(status.apiUrl, 'Supabase API URL');
const db = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const morir = (paso, error) => {
  if (!error) return;
  console.error(`${paso}: ${error.message}`);
  process.exit(1);
};

async function limpiar() {
  // En orden inverso a las dependencias: la comanda cuelga de la visita.
  await db.from('staff_cash_settlements').delete().eq('id', RENDICION);
  await db.from('orders').delete().eq('id', ORDEN_REVISION);
  await db.from('service_requests').delete().in('visit_id', [VISITA_A, VISITA_B]);
  await db.from('table_visits').delete().in('id', [VISITA_A, VISITA_B]);
  await db.from('resources').delete().in('id', MESAS.map((m) => m.id));
  console.log('Salon demo limpiado. El mozo y su staff quedan: borrarlos echa la sesion abierta.');
}

async function buscarUsuario(email) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  morir('listar Auth local', error);
  return (data?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function crearMozo() {
  const clave = `Qa-${randomBytes(18).toString('base64url')}!`;
  let user = await buscarUsuario(EMAIL_MOZO);
  if (user) {
    const { data, error } = await db.auth.admin.updateUserById(user.id, {
      password: clave, user_metadata: { full_name: 'Mozo QA Lite' },
    });
    morir('actualizar el mozo', error);
    user = data.user;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: EMAIL_MOZO, password: clave, email_confirm: true,
      user_metadata: { full_name: 'Mozo QA Lite' },
    });
    morir('crear el mozo', error);
    user = data.user;
  }

  morir('perfil del mozo', (await db.from('profiles').upsert({
    id: user.id, tenant_id: QA_TENANT_ID, full_name: 'Mozo QA Lite',
    name: 'Mozo QA Lite', email: EMAIL_MOZO,
  }, { onConflict: 'id' })).error);

  // `attendant` es la capacidad; el rubro la muestra como Mozo.
  const { data: yaEs } = await db.from('tenant_members')
    .select('id').eq('tenant_id', QA_TENANT_ID).eq('user_id', user.id)
    .is('branch_id', null).maybeSingle();
  const membresia = {
    tenant_id: QA_TENANT_ID, user_id: user.id, branch_id: null,
    role: 'attendant', roles: ['attendant'],
  };
  morir('membresia del mozo', (yaEs
    ? await db.from('tenant_members').update(membresia).eq('id', yaEs.id)
    : await db.from('tenant_members').insert(membresia)).error);

  morir('ficha de staff', (await db.from('staff').upsert({
    id: STAFF_ID, tenant_id: QA_TENANT_ID, name: 'Mozo QA Lite',
    user_id: user.id, active: true,
  }, { onConflict: 'id' })).error);

  return { user, clave };
}

async function cargar() {
  const { user, clave } = await crearMozo();

  morir('mesas', (await db.from('resources').upsert(MESAS.map((m) => ({
    ...m, tenant_id: QA_TENANT_ID, branch_id: BRANCH_ID, kind: 'table',
    min_party: 1, max_party: m.capacity, combinable: m.capacity > 4,
    width: m.shape === 'rect' ? 110 : 90, height: 90, active: true,
  })), { onConflict: 'id' })).error);

  // Dos visitas que se leen distinto: una que se autogestiona desde el QR y
  // otra atendida por el mozo. La primera es la que genera comanda por revisar.
  morir('visitas', (await db.from('table_visits').upsert([
    {
      id: VISITA_A, tenant_id: QA_TENANT_ID, branch_id: BRANCH_ID,
      resource_id: MESAS[0].id, responsible_staff_id: STAFF_ID,
      service_mode: 'self_service', source: 'digital_menu', party_size: 4,
      status: 'open', opened_at: haceMinutos(38),
    },
    {
      id: VISITA_B, tenant_id: QA_TENANT_ID, branch_id: BRANCH_ID,
      resource_id: MESAS[3].id, responsible_staff_id: STAFF_ID,
      service_mode: 'waiter', source: 'staff', party_size: 6,
      status: 'open', opened_at: haceMinutos(12),
    },
  ], { onConflict: 'id' })).error);

  // Un llamado recien pedido y otro ya tomado: son los dos estados que cambian
  // el boton de la tira en el mapa de mesas.
  morir('llamados', (await db.from('service_requests').upsert([
    {
      id: id('87', 1), tenant_id: QA_TENANT_ID, branch_id: BRANCH_ID,
      visit_id: VISITA_A, resource_id: MESAS[0].id, assigned_staff_id: STAFF_ID,
      kind: 'bill', status: 'pending', source: 'digital_menu',
      requested_at: haceMinutos(3),
    },
    {
      id: id('87', 2), tenant_id: QA_TENANT_ID, branch_id: BRANCH_ID,
      visit_id: VISITA_B, resource_id: MESAS[3].id, assigned_staff_id: STAFF_ID,
      kind: 'waiter', status: 'accepted', source: 'digital_menu',
      requested_at: haceMinutos(7), accepted_by: user.id, accepted_at: haceMinutos(5),
    },
  ], { onConflict: 'id' })).error);

  // La comanda que nacio en la mesa: entra por revisar y no llega a cocina.
  morir('comanda por revisar', (await db.from('orders').upsert({
    id: ORDEN_REVISION, tenant_id: QA_TENANT_ID, branch_id: BRANCH_ID,
    resource_id: MESAS[0].id, visit_id: VISITA_A, staff_id: STAFF_ID,
    cash_session_id: SESION_CAJA, status: 'pending_review', channel: 'catalog',
    customer_name: 'Mesa QA 2', customer_phone: '1100000004',
    subtotal: 41200, total: 41200, payment: 'efectivo', payment_status: 'pending',
    review_status: 'pending', risk_flags: ['high_total_quantity', 'age_restricted'],
    created_at: haceMinutos(6),
  }, { onConflict: 'id' })).error);

  morir('items de la comanda', (await db.from('order_items').upsert([
    {
      id: id('88', 1), tenant_id: QA_TENANT_ID, order_id: ORDEN_REVISION,
      product_id: '30000000-0000-4000-8000-000000000004', name_snapshot: 'Bebida QA',
      unit_price: 2500, unit_cost: 0, qty: 12, subtotal: 30000,
    },
    {
      id: id('88', 2), tenant_id: QA_TENANT_ID, order_id: ORDEN_REVISION,
      product_id: '30000000-0000-4000-8000-000000000001', name_snapshot: 'Clasica QA',
      unit_price: 8500, unit_cost: 0, qty: 1, subtotal: 8500,
    },
  ], { onConflict: 'id' })).error);

  // La mini caja: el mozo declaro menos de lo que cobro y queda para revisar.
  morir('mini caja', (await db.from('staff_cash_settlements').upsert({
    id: RENDICION, tenant_id: QA_TENANT_ID, branch_id: BRANCH_ID,
    cash_session_id: SESION_CAJA, staff_id: STAFF_ID, status: 'submitted',
    expected_cash: 18500, declared_cash: 17000, difference: -1500,
    notes: 'Faltante que el mozo declara al presentar.',
    submitted_by: user.id, submitted_at: haceMinutos(9),
  }, { onConflict: 'id' })).error);

  const salida = join(REPO_ROOT, '.qa-lite', 'salon-demo.txt');
  mkdirSync(join(REPO_ROOT, '.qa-lite'), { recursive: true });
  writeFileSync(salida, [
    'Salon demo — QA Lite',
    '',
    `URL     http://127.0.0.1:5273/admin`,
    `Usuario ${EMAIL_MOZO}`,
    `Clave   ${clave}`,
    '',
    'Rol attendant (Mozo). Usuario de la base LOCAL de QA: se regenera cada',
    'vez que corre este script y no existe fuera de esta maquina.',
    '',
  ].join('\n'), 'utf8');

  console.log('');
  console.log('  Salon demo cargado');
  console.log(`  ${'─'.repeat(52)}`);
  console.log('  5 mesas · 2 visitas abiertas · 2 llamados');
  console.log('  1 comanda por revisar · 1 mini caja presentada');
  console.log(`  Credenciales del mozo  ${salida.replace(REPO_ROOT, '.')}`);
  console.log(`  ${'─'.repeat(52)}`);
  console.log('');
}

if (process.argv.includes('--limpiar')) await limpiar();
else await cargar();
