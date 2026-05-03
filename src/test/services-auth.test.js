import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSignIn, mockSignOut, mockGetSession } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
      getSession: mockGetSession,
    },
  },
}));

import { login, logout, getSession } from '@hermes/core/services/auth';

beforeEach(() => vi.clearAllMocks());

describe('login', () => {
  it('returns ok:true with user on success', async () => {
    const user = { id: 'u1', email: 'admin@test.com' };
    mockSignIn.mockResolvedValue({ data: { user }, error: null });
    const result = await login('admin@test.com', 'pass123');
    expect(result).toEqual({ ok: true, user });
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'admin@test.com', password: 'pass123' });
  });

  it('returns ok:false with message on error', async () => {
    mockSignIn.mockResolvedValue({ data: null, error: { message: 'Invalid credentials' } });
    const result = await login('bad@test.com', 'wrong');
    expect(result).toEqual({ ok: false, msg: 'Invalid credentials' });
  });
});

describe('logout', () => {
  it('calls signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null });
    await logout();
    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe('getSession', () => {
  it('returns session when logged in', async () => {
    const session = { user: { id: 'u1' }, access_token: 'tok' };
    mockGetSession.mockResolvedValue({ data: { session } });
    expect(await getSession()).toEqual(session);
  });

  it('returns null when not logged in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    expect(await getSession()).toBeNull();
  });
});
