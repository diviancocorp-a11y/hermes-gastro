// API publica usada por el menu digital cuando el URL contiene una mesa.
import { supabase } from '../lib/supabase';
import { resolveTenantSlug } from '../lib/activeTenant';
import { claveDeIdempotencia, reiniciarClave } from '../lib/idempotencia';

async function invoke(body) {
  const tenantSlug = await resolveTenantSlug();
  if (!tenantSlug) return { __error: 'tenant', message: 'No se pudo identificar el negocio' };
  const { data, error } = await supabase.functions.invoke('table-assistance', {
    body: { ...body, tenant_slug: tenantSlug },
  });
  if (error) return { __error: 'network', message: data?.error || error.message };
  return data;
}

export async function openVisitFromMenu(tableCode, details = {}) {
  const result = await invoke({
    operation: 'open',
    table_code: tableCode,
    service_mode: details.serviceMode || 'self_service',
    party_size: details.partySize || null,
    client_request_id: claveDeIdempotencia('table-visit', [tableCode]),
  });
  if (!result?.__error) reiniciarClave('table-visit');
  return result;
}

export async function requestTableAssistance(tableCode, kind) {
  const result = await invoke({
    operation: 'request',
    table_code: tableCode,
    kind,
    client_request_id: claveDeIdempotencia(`table-request:${kind}`, [tableCode, kind]),
  });
  if (!result?.__error) reiniciarClave(`table-request:${kind}`);
  return result;
}
