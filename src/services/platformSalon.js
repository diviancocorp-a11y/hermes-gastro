// Operaciones del salon del edificio: visitas, cobertura y asistencia.
import { supabase } from '../lib/supabase';

const REQUEST_COLS = 'id, tenant_id, branch_id, visit_id, resource_id, assigned_staff_id, kind, status, source, requested_at, accepted_at, resolved_at';

const VISIT_COLS = 'id, tenant_id, branch_id, resource_id, responsible_staff_id, service_mode, source, party_size, status, opened_at, preclosed_at';

/**
 * Las visitas que estan pasando ahora.
 *
 * `preclosing` cuenta como abierta: la mesa sigue ocupada mientras se cobra, y
 * sacarla del plano en ese momento la dibujaria libre con gente sentada.
 */
export async function fetchTableVisits(tenantId, branchId) {
  const { data, error } = await supabase.from('table_visits').select(VISIT_COLS)
    .eq('tenant_id', tenantId).eq('branch_id', branchId)
    .in('status', ['open', 'preclosing'])
    .order('opened_at');
  if (error) {
    console.error('fetchTableVisits:', error.message);
    return [];
  }
  return data || [];
}

export async function fetchServiceRequests(tenantId, branchId, { activeOnly = true } = {}) {
  let query = supabase.from('service_requests').select(REQUEST_COLS)
    .eq('tenant_id', tenantId).eq('branch_id', branchId)
    .order('requested_at');
  if (activeOnly) query = query.in('status', ['pending', 'accepted']);
  const { data, error } = await query;
  if (error) {
    console.error('fetchServiceRequests:', error.message);
    return [];
  }
  return data || [];
}

export async function updateServiceRequest(id, status) {
  const { data, error } = await supabase.rpc('update_service_request', {
    p_request_id: id,
    p_status: status,
  });
  if (error) {
    console.error('updateServiceRequest:', error.message);
    return { __error: 'db', message: error.message };
  }
  return data;
}

export async function openTableVisit(tenantId, resourceId, details = {}) {
  const { data, error } = await supabase.rpc('open_table_visit', {
    p_tenant_id: tenantId,
    p_resource_id: resourceId,
    p_service_mode: details.serviceMode || 'mixed',
    p_party_size: details.partySize || null,
    p_staff_id: details.staffId || null,
    p_client_request_id: details.clientRequestId || crypto.randomUUID(),
  });
  if (error) {
    console.error('openTableVisit:', error.message);
    return { __error: 'db', message: error.message };
  }
  return data;
}

export function subscribeToServiceRequests(tenantId, onChange) {
  const channel = supabase.channel(`service-requests:${tenantId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'service_requests', filter: `tenant_id=eq.${tenantId}`,
    }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
