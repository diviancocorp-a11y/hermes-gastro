import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockStorageFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockStorageFrom: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    storage: { from: mockStorageFrom },
  },
}));

import {
  fetchOrders, fetchActiveOrders, fetchOrderHistory,
  updateOrderStatus, verifyReceipt, getReceiptUrl,
} from '../services/orders';

import { chain } from './_chain.js';

beforeEach(() => vi.clearAllMocks());

describe('fetchActiveOrders', () => {
  it('returns active orders', async () => {
    const orders = [{ id: 'o1', status: 'new', order_items: [] }];
    mockFrom.mockReturnValue(chain({ data: orders, error: null }));
    expect(await fetchActiveOrders()).toEqual(orders);
    expect(mockFrom).toHaveBeenCalledWith('orders');
  });

  it('returns [] on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'err' } }));
    expect(await fetchActiveOrders()).toEqual([]);
  });
});

describe('fetchOrderHistory', () => {
  it('returns paginated history with nextCursor', async () => {
    // 51 items = has more page
    const rows = Array.from({ length: 51 }, (_, i) => ({
      id: `h${i}`, status: 'completed', created_at: `2026-04-${String(20 - i).padStart(2, '0')}T00:00:00Z`,
    }));
    mockFrom.mockReturnValue(chain({ data: rows, error: null }));
    const result = await fetchOrderHistory();
    expect(result.data).toHaveLength(50);
    expect(result.nextCursor).toBeTruthy();
  });

  it('returns null nextCursor on last page', async () => {
    const rows = [{ id: 'h1', status: 'completed', created_at: '2026-04-01T00:00:00Z' }];
    mockFrom.mockReturnValue(chain({ data: rows, error: null }));
    const result = await fetchOrderHistory();
    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('accepts before cursor', async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));
    const result = await fetchOrderHistory({ before: '2026-04-10T00:00:00Z' });
    expect(result.data).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

describe('fetchOrders (backward-compatible)', () => {
  it('returns combined active + history', async () => {
    const active = [{ id: 'a1', status: 'new' }];
    const history = [{ id: 'h1', status: 'completed' }];
    // First call for active, second for history
    mockFrom
      .mockReturnValueOnce(chain({ data: active, error: null }))
      .mockReturnValueOnce(chain({ data: history, error: null }));
    const result = await fetchOrders();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a1');
    expect(result[1].id).toBe('h1');
  });
});

describe('updateOrderStatus', () => {
  it('returns true on success', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await updateOrderStatus('o1', 'preparing')).toBe(true);
  });

  it('returns false on error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'fail' } }));
    expect(await updateOrderStatus('o1', 'preparing')).toBe(false);
  });
});

describe('verifyReceipt', () => {
  it('returns true on success', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    expect(await verifyReceipt('o1')).toBe(true);
  });
});

describe('getReceiptUrl', () => {
  it('returns public URL for valid path', () => {
    mockStorageFrom.mockReturnValue({
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://storage.com/receipts/file.jpg' } })),
    });
    expect(getReceiptUrl('file.jpg')).toBe('https://storage.com/receipts/file.jpg');
    expect(mockStorageFrom).toHaveBeenCalledWith('receipts');
  });

  it('returns null for empty path', () => {
    expect(getReceiptUrl(null)).toBeNull();
    expect(getReceiptUrl('')).toBeNull();
  });
});
