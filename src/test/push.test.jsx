// src/test/push.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing push service
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      select: vi.fn(() => ({ count: 'exact', head: true })),
    })),
    // Sprint 1: push.js usa RPCs (upsert/delete/count_push_subscription[s])
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { ok: true, sent: 5 }, error: null }),
    },
  },
}));

describe('Push service', () => {
  beforeEach(() => {
    // clearAllMocks (no restoreAllMocks): limpia llamadas pero conserva las
    // implementaciones del vi.mock de supabase (rpc/invoke mockResolvedValue)
    vi.clearAllMocks();
  });

  it('isPushSupported detects browser support', async () => {
    const { isPushSupported } = await import('../services/push');
    // jsdom has no serviceWorker or PushManager
    expect(typeof isPushSupported()).toBe('boolean');
  });

  it('getPushPermission returns "unsupported" in jsdom', async () => {
    const { getPushPermission } = await import('../services/push');
    const perm = await getPushPermission();
    expect(perm).toBe('unsupported');
  });

  it('subscribeToPush returns null when unsupported', async () => {
    const { subscribeToPush } = await import('../services/push');
    const sub = await subscribeToPush();
    expect(sub).toBeNull();
  });

  it('isSubscribed returns false when unsupported', async () => {
    const { isSubscribed } = await import('../services/push');
    const result = await isSubscribed();
    expect(result).toBe(false);
  });

  it('sendPushNotification calls supabase function', async () => {
    const { sendPushNotification } = await import('../services/push');
    const result = await sendPushNotification({ title: 'Test', body: 'Hello', url: '/' });
    expect(result).toEqual({ ok: true, sent: 5 });
  });

  it('getSubscriberCount usa el RPC count_push_subscriptions', async () => {
    const { getSubscriberCount } = await import('../services/push');
    const { supabase } = await import('../lib/supabase');
    const { default: business } = await import('@business');
    const count = await getSubscriberCount('customer');
    // El build del edificio es platform: en jsdom el host no dice el tenant y
    // cae al slug del build.
    expect(supabase.rpc).toHaveBeenCalledWith('count_push_subscriptions', {
      p_role: 'customer', p_tenant_slug: business.slug,
    });
    expect(count).toBe(0);
  });
});

// PushBanner tests removed in Sprint 3 — componente muerto (el vivo es catalog-pro/PushOptInBanner).
// PushNotifications (pantalla del ERP legacy) se borro el 29/sep con pages/Admin.
