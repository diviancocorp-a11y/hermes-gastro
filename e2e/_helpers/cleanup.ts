// Cleanup helper — removes any rows the E2E suite created so the staging DB
// stays clean. Uses the service role key (bypasses RLS) so it can DELETE
// from orders + order_items in one shot.
//
// Identification: every E2E test sets `customer` to `e2e-${Date.now()}` so
// we just match `customer LIKE 'e2e-%'`.
//
// Note: env vars are validated at FUNCTION call time, not at module load.
// This lets Playwright discover specs in CI even when E2E secrets aren't
// configured — the suite will fail loudly only when actually run.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

function getAdmin(): SupabaseClient {
  if (_admin) return _admin
  const url = process.env.E2E_SUPABASE_URL
  const serviceRole = process.env.E2E_SUPABASE_SERVICE_ROLE
  if (!url || !serviceRole) {
    throw new Error('Missing E2E_SUPABASE_URL or E2E_SUPABASE_SERVICE_ROLE — see .env.e2e.example')
  }
  _admin = createClient(url, serviceRole, { auth: { persistSession: false } })
  return _admin
}

export async function cleanupE2EOrders() {
  const admin = getAdmin()
  // Order items first (FK), then orders.
  const { data: rows } = await admin
    .from('orders')
    .select('id')
    .like('customer', 'e2e-%')
  const ids = (rows || []).map((r: { id: string }) => r.id)
  if (!ids.length) return { deleted: 0 }
  await admin.from('order_items').delete().in('order_id', ids)
  await admin.from('orders').delete().in('id', ids)
  return { deleted: ids.length }
}
