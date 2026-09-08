#!/usr/bin/env node
/**
 * Datos locales de revision para Dico Recomienda y Dico Analiza.
 *
 *   node scripts/qa-lite/cargar-gestion-productos-demo.mjs --cerrado
 *   node scripts/qa-lite/cargar-gestion-productos-demo.mjs --abierto
 *   node scripts/qa-lite/cargar-gestion-productos-demo.mjs --limpiar
 *
 * Solo acepta la API local validada por el harness. No toca tenants reales.
 */
import { createClient } from '@supabase/supabase-js';
import { getLocalStatus, assertLocalUrl, QA_TENANT_ID } from '../../platform/qa-lite/lib.mjs';

const LIMPIAR = process.argv.includes('--limpiar');
const ABIERTO = process.argv.includes('--abierto');
const BRANCH_ID = '20000000-0000-4000-8000-000000000001';
const TURNO_ID = '70000000-0000-4000-8000-000000000090';

const PRODUCTOS = [
  { id: '30000000-0000-4000-8000-000000000001', nombre: 'Clasica QA', precio: 8500, stock: 12, unidades: [4, 6] },
  { id: '30000000-0000-4000-8000-000000000002', nombre: 'Verde QA', precio: 7900, stock: 3, unidades: [4, 4] },
  { id: '30000000-0000-4000-8000-000000000003', nombre: 'Dulce QA', precio: 4200, stock: 8, unidades: [1] },
  { id: '30000000-0000-4000-8000-000000000004', nombre: 'Bebida QA', precio: 2500, stock: 0, unidades: [1] },
];

const INGREDIENTES = [
  { id: '31000000-0000-4000-8000-000000000001', name: 'Base clasica QA', cost: 2000, stock: 20, min_stock: 4 },
  { id: '31000000-0000-4000-8000-000000000002', name: 'Vegetales QA', cost: 6500, stock: 1, min_stock: 2 },
  { id: '31000000-0000-4000-8000-000000000003', name: 'Crema dulce QA', cost: 500, stock: 12, min_stock: 3 },
  { id: '31000000-0000-4000-8000-000000000004', name: 'Bebida base QA', cost: 2200, stock: 0, min_stock: 1 },
];

const status = getLocalStatus();
assertLocalUrl(status.apiUrl, 'Supabase API URL');
const admin = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const revisar = (error, contexto) => {
  if (error) throw new Error(`${contexto}: ${error.message}`);
};

const ordenId = (n) => `40000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
const itemId = (n) => `50000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
const ordenesIds = PRODUCTOS.flatMap(p => p.unidades).map((_, i) => ordenId(i + 1));

if (LIMPIAR) {
  revisar((await admin.from('order_items').delete().in('order_id', ordenesIds)).error, 'limpiar items');
  revisar((await admin.from('orders').delete().in('id', ordenesIds)).error, 'limpiar pedidos');
  revisar((await admin.from('product_ingredients').delete().in('ingredient_id', INGREDIENTES.map(i => i.id))).error, 'limpiar recetas');
  revisar((await admin.from('ingredients').delete().in('id', INGREDIENTES.map(i => i.id))).error, 'limpiar insumos');
  revisar((await admin.from('cash_sessions').delete().eq('id', TURNO_ID)).error, 'limpiar turno');
  for (const producto of PRODUCTOS) {
    revisar((await admin.from('products').update({ stock: null }).eq('id', producto.id)).error, 'restaurar stock');
  }
  revisar((await admin.from('settings').update({ store_open: true }).eq('tenant_id', QA_TENANT_ID)).error, 'restaurar local');
  console.log('[gestion-demo] datos eliminados; fixture local restaurado');
  process.exit(0);
}

revisar((await admin.from('ingredients').upsert(INGREDIENTES.map(i => ({
  ...i,
  tenant_id: QA_TENANT_ID,
  unit: 'unidad',
  category: 'Insumos',
  is_archived: false,
  created_at: '2026-09-06T12:00:00-03:00',
})), { onConflict: 'id' })).error, 'cargar insumos');

revisar((await admin.from('product_ingredients').upsert(PRODUCTOS.map((producto, i) => ({
  tenant_id: QA_TENANT_ID,
  product_id: producto.id,
  ingredient_id: INGREDIENTES[i].id,
  qty: 1,
  created_at: '2026-09-06T12:05:00-03:00',
})), { onConflict: 'product_id,ingredient_id' })).error, 'cargar recetas');

for (const producto of PRODUCTOS) {
  revisar((await admin.from('products').update({ stock: producto.stock }).eq('id', producto.id)).error, 'cargar stock');
}

revisar((await admin.from('cash_sessions').upsert({
  id: TURNO_ID,
  tenant_id: QA_TENANT_ID,
  branch_id: BRANCH_ID,
  opened_at: '2026-09-06T17:00:00-03:00',
  closed_at: '2026-09-06T23:30:00-03:00',
  opening_amount: 20000,
  closing_amount: 88600,
  expected_amount: 88600,
  difference: 0,
  status: 'closed',
  notes: 'Turno de revision Dico Analiza',
  business_day: '2026-09-06',
}, { onConflict: 'id' })).error, 'cargar turno');

const ordenes = [];
const items = [];
let indice = 0;
for (const producto of PRODUCTOS) {
  for (const qty of producto.unidades) {
    indice += 1;
    const total = producto.precio * qty;
    const createdAt = `2026-09-06T${String(17 + indice).padStart(2, '0')}:00:00-03:00`;
    ordenes.push({
      id: ordenId(indice), tenant_id: QA_TENANT_ID, branch_id: BRANCH_ID,
      cash_session_id: TURNO_ID, status: 'completed', channel: 'pos',
      customer_name: `Mesa demo ${indice}`, subtotal: total, total,
      payment: 'efectivo', payment_status: 'paid',
      client_request_id: `91000000-0000-4000-8000-0000000001${String(indice).padStart(2, '0')}`,
      created_at: createdAt,
    });
    items.push({
      id: itemId(indice), tenant_id: QA_TENANT_ID, order_id: ordenId(indice),
      product_id: producto.id, name_snapshot: producto.nombre,
      unit_price: producto.precio, unit_cost: INGREDIENTES[PRODUCTOS.indexOf(producto)].cost,
      qty, subtotal: total, created_at: createdAt,
    });
  }
}

revisar((await admin.from('orders').upsert(ordenes, { onConflict: 'id' })).error, 'cargar pedidos');
revisar((await admin.from('order_items').upsert(items, { onConflict: 'id' })).error, 'cargar items');
revisar((await admin.from('settings').update({ store_open: ABIERTO }).eq('tenant_id', QA_TENANT_ID)).error, 'cambiar estado del local');

console.log(`[gestion-demo] ${ordenes.length} transacciones, 20 unidades, 4 recetas y un turno cerrado`);
console.log(`[gestion-demo] vista inicial: ${ABIERTO ? 'Dico Recomienda' : 'Dico Analiza'}`);
