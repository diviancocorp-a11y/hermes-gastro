// Facturacion ARCA del edificio. La UI solo crea y lee solicitudes; el CAE,
// la numeracion y las credenciales pertenecen a la funcion server-side.
import { supabase } from '../lib/supabase';
import { claveDeIdempotencia, reiniciarClave } from '../lib/idempotencia.js';

export async function fetchPerfilFiscal(tenantId) {
  const { data, error } = await supabase.from('fiscal_profiles').select(
    'tenant_id, legal_name, cuit, vat_condition, point_of_sale, environment, default_voucher_type, default_vat_rate, auto_issue, enabled, updated_at',
  ).eq('tenant_id', tenantId).maybeSingle();
  if (error) {
    console.error('fetchPerfilFiscal:', error.message);
    return null;
  }
  return data;
}

export async function fetchDocumentosFiscales(tenantId, { limit = 30 } = {}) {
  const { data, error } = await supabase.from('fiscal_documents').select(
    'id, tenant_id, branch_id, order_id, status, voucher_type, point_of_sale, voucher_number, issue_date, receiver_doc_type, receiver_doc_number, receiver_name, total, cae, cae_expires_on, arca_result, arca_observations, last_error_code, last_error_message, attempt_count, requested_at, authorized_at',
  ).eq('tenant_id', tenantId).order('requested_at', { ascending: false }).limit(limit);
  if (error) {
    console.error('fetchDocumentosFiscales:', error.message);
    return [];
  }
  return data || [];
}

export async function encolarFactura(tenantId, orderId, receptor = {}) {
  const requestId = claveDeIdempotencia('factura', [tenantId, orderId]);
  const { data, error } = await supabase.rpc('queue_fiscal_document', {
    p_tenant_id: tenantId,
    p_order_id: orderId,
    p_receiver_doc_type: receptor.docType ?? 99,
    p_receiver_doc_number: receptor.docNumber || '0',
    p_receiver_name: receptor.name || null,
    p_receiver_vat_condition: receptor.vatCondition ?? 5,
    p_client_request_id: requestId,
  });
  if (error) return { __error: 'db', message: error.message };
  reiniciarClave('factura');
  return { ok: true, documento: data };
}

export async function procesarFactura(documentId) {
  const { data, error } = await supabase.functions.invoke('arca-invoice', {
    body: { document_id: documentId },
  });
  if (error) return { __error: 'arca', message: error.message };
  if (data?.error) return { __error: 'arca', message: data.error, code: data.code };
  return { ok: true, documento: data?.document };
}

export async function facturarPedido(tenantId, orderId, receptor = {}) {
  const queued = await encolarFactura(tenantId, orderId, receptor);
  if (queued.__error) return queued;
  return procesarFactura(queued.documento.id);
}

export const ESTADO_FISCAL = {
  queued: 'Pendiente de enviar',
  processing: 'Enviando a ARCA',
  authorized: 'Autorizada',
  rejected: 'Rechazada',
  retry_required: 'Requiere reintento',
  cancelled: 'Cancelada',
};
