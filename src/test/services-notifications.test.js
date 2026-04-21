import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}));

import { notifyWhatsApp } from '../services/notifications';

beforeEach(() => vi.clearAllMocks());

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('notifyWhatsApp', () => {
  it('returns true on successful invocation', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    expect(await notifyWhatsApp(UUID, 'prep')).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('notify-whatsapp', {
      body: { orderId: UUID, status: 'prep' },
    });
  });

  it('returns false on edge function error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    expect(await notifyWhatsApp(UUID, 'active')).toBe(false);
  });

  it('returns false when data.ok is not true', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: false }, error: null });
    expect(await notifyWhatsApp(UUID, 'done')).toBe(false);
  });

  it('returns false on network exception', async () => {
    mockInvoke.mockRejectedValue(new Error('network'));
    expect(await notifyWhatsApp(UUID, 'cancel')).toBe(false);
  });

  it('returns false for invalid input (empty orderId)', async () => {
    expect(await notifyWhatsApp('', 'prep')).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('returns false for invalid status', async () => {
    expect(await notifyWhatsApp(UUID, 'invalid_status')).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
