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
    const btn = screen.getByText(/Enviar a \d+ suscriptores/);
    expect(btn.closest('button').disabled).toBe(true);
  });
});

describe('PushBanner catalog component', () => {
  it('renders without crashing (hidden by default in jsdom)', async () => {
    const React = await import('react');
    const { render } = await import('@testing-library/react');
    const { default: PushBanner } = await import('../components/catalog/PushBanner');

    const { container } = render(React.createElement(PushBanner));
    // In jsdom, push is not supported, so banner should not render
    expect(container.innerHTML).toBe('');
  });
});
