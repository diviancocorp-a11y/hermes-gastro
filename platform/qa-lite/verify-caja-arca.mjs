#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { bootstrapUser } from './bootstrap-user.mjs';
import { getLocalStatus, QA_TENANT_ID } from './lib.mjs';

const BRANCH_ID = '20000000-0000-4000-8000-000000000001';
const CASH_SESSION_ID = '70000000-0000-4000-8000-000000000001';
const CASH_METHOD_ID = '60000000-0000-4000-8000-000000000001';
const CARD_METHOD_ID = '60000000-0000-4000-8000-000000000002';

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`);
  return result.data;
}

const status = getLocalStatus();
const owner = await bootstrapUser(status);
const admin = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const client = createClient(status.apiUrl, status.anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
ok(await client.auth.signInWithPassword({ email: owner.email, password: owner.password }), 'login');

const userId = (await client.auth.getUser()).data.user.id;
const previousOrders = ok(await admin.from('orders').select('id')
  .eq('tenant_id', QA_TENANT_ID).eq('customer_name', 'Caja ARCA QA'), 'leer QA previo');
const previousOrderIds = previousOrders.map((order) => order.id);
if (previousOrderIds.length) {
  ok(await admin.from('fiscal_documents').delete().in('order_id', previousOrderIds), 'limpiar facturas QA');
  ok(await admin.from('cash_exceptions').delete().in('order_id', previousOrderIds), 'limpiar incidencias QA');
  ok(await admin.from('payments').delete().in('order_id', previousOrderIds), 'limpiar cobros QA');
  ok(await admin.from('orders').delete().in('id', previousOrderIds), 'limpiar pedidos QA');
}
let staff = ok(await admin.from('staff').select('id')
  .eq('tenant_id', QA_TENANT_ID).eq('user_id', userId).maybeSingle(), 'leer personal');
if (!staff) {
  staff = ok(await admin.from('staff').insert({
    tenant_id: QA_TENANT_ID, branch_id: BRANCH_ID, user_id: userId,
    name: 'Responsable QA Caja', job: 'caja', active: true,
  }).select('id').single(), 'crear personal');
}

// La sonda corre sobre el fixture vivo y puede repetirse sin resetearlo. Solo
// limpia una rendicion QA que una corrida interrumpida haya dejado abierta;
// los cierres previos y los datos de revision se conservan.
ok(await admin.from('staff_cash_settlements').delete()
  .eq('cash_session_id', CASH_SESSION_ID).eq('staff_id', staff.id)
  .neq('status', 'closed'), 'limpiar rendicion QA interrumpida');
const cashBefore = ok(await admin.from('payments')
  .select('amount, payment_methods!inner(kind)')
  .eq('cash_session_id', CASH_SESSION_ID).eq('collector_staff_id', staff.id)
  .eq('payment_methods.kind', 'cash'), 'leer efectivo previo');
const expectedBefore = cashBefore.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

const orderId = randomUUID();
ok(await admin.from('orders').insert({
  id: orderId,
  tenant_id: QA_TENANT_ID,
  branch_id: BRANCH_ID,
  cash_session_id: CASH_SESSION_ID,
  status: 'active',
  channel: 'pos',
  customer_name: 'Caja ARCA QA',
  subtotal: 150,
  total: 150,
  payment: 'efectivo',
  payment_status: 'pending',
  client_request_id: randomUUID(),
}), 'crear pedido');

const cashPayment = ok(await client.rpc('register_payment', {
  p_tenant_id: QA_TENANT_ID,
  p_order_id: orderId,
  p_method_id: CASH_METHOD_ID,
  p_amount: 100,
  p_client_request_id: randomUUID(),
}), 'cobro efectivo');
const invalidCard = await client.rpc('register_payment', {
  p_tenant_id: QA_TENANT_ID,
  p_order_id: orderId,
  p_method_id: CARD_METHOD_ID,
  p_amount: 50,
  p_receipt_last_four: '12',
  p_client_request_id: randomUUID(),
});
assert.match(invalidCard.error?.message || '', /ultimos_cuatro_requeridos/);
const cardPayment = ok(await client.rpc('register_payment', {
  p_tenant_id: QA_TENANT_ID,
  p_order_id: orderId,
  p_method_id: CARD_METHOD_ID,
  p_amount: 50,
  p_reference: 'QA-928177',
  p_receipt_last_four: '4312',
  p_client_request_id: randomUUID(),
}), 'cobro tarjeta');
assert.equal(cashPayment.collector_staff_id, staff.id);
assert.equal(cardPayment.verification_status, 'pending');
assert.equal(cardPayment.receipt_last_four, '4312');
assert.equal(cardPayment.reference, 'QA-928177');

const requestId = randomUUID();
const settlement = ok(await client.rpc('submit_staff_cash_settlement', {
  p_tenant_id: QA_TENANT_ID,
  p_cash_session_id: CASH_SESSION_ID,
  p_staff_id: staff.id,
  p_declared_cash: expectedBefore + 100,
  p_notes: 'Conteo QA',
  p_client_request_id: requestId,
}), 'pre-cierre');
assert.equal(Number(settlement.expected_cash), expectedBefore + 100);
assert.equal(settlement.difference, 0);
const repeated = ok(await client.rpc('submit_staff_cash_settlement', {
  p_tenant_id: QA_TENANT_ID,
  p_cash_session_id: CASH_SESSION_ID,
  p_staff_id: staff.id,
  p_declared_cash: expectedBefore + 100,
  p_client_request_id: requestId,
}), 'pre-cierre idempotente');
assert.equal(repeated.id, settlement.id);

const premature = await client.rpc('review_staff_cash_settlement', {
  p_settlement_id: settlement.id, p_decision: 'approve', p_notes: 'Revision QA',
});
assert.match(premature.error?.message || '', /faltan_comprobantes_verificados/);

const storagePath = `${QA_TENANT_ID}/${settlement.id}/${randomUUID()}.txt`;
const upload = await client.storage.from('cash-evidence')
  .upload(storagePath, new Blob(['evidencia qa'], { type: 'text/plain' }));
assert.match(upload.error?.message || '', /mime type text\/plain is not supported/i);

const imagePath = `${QA_TENANT_ID}/${settlement.id}/${randomUUID()}.png`;
ok(await client.storage.from('cash-evidence').upload(
  imagePath,
  new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
), 'subir comprobante privado');
const evidence = ok(await client.rpc('register_payment_evidence', {
  p_settlement_id: settlement.id,
  p_payment_id: cardPayment.id,
  p_storage_path: imagePath,
  p_original_filename: 'comprobante.png',
  p_mime_type: 'image/png',
  p_size_bytes: 4,
}), 'registrar comprobante');
ok(await client.rpc('verify_payment_evidence', {
  p_evidence_id: evidence.id, p_approved: true,
}), 'verificar comprobante');
const closed = ok(await client.rpc('review_staff_cash_settlement', {
  p_settlement_id: settlement.id, p_decision: 'approve', p_notes: 'Recibido conforme',
}), 'cerrar mini caja');
assert.equal(closed.status, 'closed');
assert.equal(closed.cash_received_by, userId);

const exception = ok(await client.rpc('report_cash_exception', {
  p_tenant_id: QA_TENANT_ID,
  p_branch_id: BRANCH_ID,
  p_kind: 'payment_correction',
  p_title: 'Corregir medio de pago QA',
  p_severity: 'critical',
  p_cash_session_id: CASH_SESSION_ID,
  p_order_id: orderId,
  p_client_request_id: randomUUID(),
}), 'crear incidencia');
const resolved = ok(await client.rpc('resolve_cash_exception', {
  p_exception_id: exception.id,
  p_resolution: 'Medio revisado contra el comprobante',
}), 'resolver incidencia');
assert.equal(resolved.status, 'resolved');

ok(await client.from('fiscal_profiles').upsert({
  tenant_id: QA_TENANT_ID,
  legal_name: 'Dico QA',
  cuit: '20123456786',
  vat_condition: 'monotributo',
  point_of_sale: 1,
  environment: 'homologation',
  default_voucher_type: 11,
  default_vat_rate: 0,
  credential_ref: 'qa-only',
  enabled: true,
  updated_by: userId,
}), 'configurar perfil fiscal');
const fiscalRequestId = randomUUID();
const fiscal = ok(await client.rpc('queue_fiscal_document', {
  p_tenant_id: QA_TENANT_ID,
  p_order_id: orderId,
  p_receiver_doc_type: 99,
  p_receiver_doc_number: '0',
  p_receiver_vat_condition: 5,
  p_client_request_id: fiscalRequestId,
}), 'encolar factura');
assert.equal(fiscal.status, 'queued');
assert.equal(fiscal.voucher_type, 11);
assert.equal(Number(fiscal.net_amount), 150);
const fiscalRepeated = ok(await client.rpc('queue_fiscal_document', {
  p_tenant_id: QA_TENANT_ID,
  p_order_id: orderId,
  p_client_request_id: fiscalRequestId,
}), 'factura idempotente');
assert.equal(fiscalRepeated.id, fiscal.id);

const blockers = ok(await client.rpc('cash_session_blockers', {
  p_session_id: CASH_SESSION_ID,
}), 'bloqueos del cierre');
assert.equal(blockers.pending_settlements, 0);
assert.equal(blockers.critical_exceptions, 0);
assert.equal(blockers.open_tables, 1);

console.log('Caja + ARCA QA: flujo transaccional OK');
