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
    vi.restoreAllMocks();
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
    const count = await getSubscriberCount('customer');
    expect(supabase.rpc).toHaveBeenCalledWith('count_push_subscriptions', { p_role: 'customer' });
    expect(count).toBe(0);
  });
});

describe('PushNotifications admin component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', async () => {
    const React = await import('react');
    const { render, screen } = await import('@testing-library/react');
    const { default: PushNotifications } = await import('../components/admin/PushNotifications');

    render(React.createElement(PushNotifications, { msg: vi.fn(), onClose: vi.fn() }));
    expect(screen.getByText(/Notificaciones push/)).toBeTruthy();
  });

  it('renders send form fields', async () => {
    const React = await import('react');
    const { render } = await import('@testing-library/react');
    const { default: PushNotifications } = await import('../components/admin/PushNotifications');

    const { container } = render(React.createElement(PushNotifications, { msg: vi.fn(), onClose: vi.fn() }));
    const inputs = container.querySelectorAll('input, textarea');
    expect(inputs.length).toBeGreaterThanOrEqual(3);
  });

  it('submit button is disabled when title/body empty', async () => {
    const React = await import('react');
    const { render, screen } = await import('@testing-library/react');
    const { default: PushNotifications } = await import('../components/admin/PushNotifications');

    render(React.createElement(PushNotifications, { msg: vi.fn(), onClose: vi.fn() }));
    // Puede haber mas de un boton con este texto (segments) — alcanza con que el primero este deshabilitado
    const btns = screen.getAllByText(/Enviar a \d+ suscriptores/);
    expect(btns.length).toBeGreaterThanOrEqual(1);
    expect(btns[0].closest('button').disabled).toBe(true);
  });
});

// PushBanner tests removed in Sprint 3 — componente muerto (el vivo es catalog-pro/PushOptInBanner).
