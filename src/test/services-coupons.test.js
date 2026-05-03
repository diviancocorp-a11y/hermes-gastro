import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import { createCouponForOrder, validateCoupon, redeemCoupon, fetchCoupons } from '@hermes/core/services/coupons';

import { chain } from './_chain.js';

beforeEach(() => vi.clearAllMocks());

describe('createCouponForOrder', () => {
  it('returns null when email is empty', async () => {
    expect(await createCouponForOrder('ord1', '')).toBeNull();
    expect(await createCouponForOrder('ord1', null)).toBeNull();
  });

  it('creates coupon with correct structure', async () => {
    const coupon = { id: 'c1', code: 'NONA-ABC123', discount_pct: 10, email: 'test@x.com' };
    mockFrom.mockReturnValue(chain({ data: coupon, error: null }));
    const result = await createCouponForOrder('ord1', 'test@x.com', 10);
    expect(result).toEqual(coupon);
    expect(mockFrom).toHaveBeenCalledWith('coupons');
  });

  it('returns null on db error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'fail' } }));
    expect(await createCouponForOrder('ord1', 'test@x.com')).toBeNull();
  });
});

describe('validateCoupon', () => {
  it('returns coupon data for valid unused coupon', async () => {
    const coupon = { id: 'c1', code: 'NONA-ABC', email: 'test@x.com', used: false, expires_at: '2099-12-31T00:00:00Z' };
    mockFrom.mockReturnValue(chain({ data: coupon, error: null }));
    const result = await validateCoupon('nona-abc', 'test@x.com');
    expect(result).toEqual(coupon);
  });

  it('returns null when email does not match', async () => {
    const coupon = { id: 'c1', code: 'NONA-ABC', email: 'owner@x.com', used: false, expires_at: null };
    mockFrom.mockReturnValue(chain({ data: coupon, error: null }));
    expect(await validateCoupon('NONA-ABC', 'other@x.com')).toBeNull();
  });

  it('returns null when coupon is expired', async () => {
    const coupon = { id: 'c1', code: 'NONA-ABC', email: null, used: false, expires_at: '2020-01-01T00:00:00Z' };
    mockFrom.mockReturnValue(chain({ data: coupon, error: null }));
    expect(await validateCoupon('NONA-ABC', 'any@x.com')).toBeNull();
  });

  it('returns null when not found', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'not found' } }));
    expect(await validateCoupon('NOPE', 'a@b.com')).toBeNull();
  });
});

describe('redeemCoupon', () => {
  it('returns true on success', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await redeemCoupon('c1')).toBe(true);
  });

  it('returns false on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'fail' } }));
    expect(await redeemCoupon('c1')).toBe(false);
  });
});

describe('fetchCoupons', () => {
  it('returns coupons list', async () => {
    const coupons = [{ id: 'c1', code: 'NONA-X' }];
    mockFrom.mockReturnValue(chain({ data: coupons, error: null }));
    expect(await fetchCoupons()).toEqual(coupons);
  });

  it('returns [] on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'err' } }));
    expect(await fetchCoupons()).toEqual([]);
  });
});
