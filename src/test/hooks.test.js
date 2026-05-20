import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCart from '@hermes/core/hooks/useCart';
import useStoreStatus from '@hermes/core/hooks/useStoreStatus';

// ── useCart ──

describe('useCart', () => {
  const mockProduct = { id: 'p1', name: 'Alfajor', sale_price: 1000, image_url: '', related_ids: [] };
  const mockProduct2 = { id: 'p2', name: 'Torta', sale_price: 5000, image_url: '', related_ids: [] };
  const getPrice = (p) => p.sale_price;
  const products = [mockProduct, mockProduct2];

  it('starts with empty cart', () => {
    const { result } = renderHook(() => useCart(getPrice, products, null, 0, 'retiro'));
    expect(result.current.cart).toEqual([]);
    expect(result.current.cc).toBe(0);
    expect(result.current.ct).toBe(0);
  });

  it('addToCart adds a product', () => {
    const { result } = renderHook(() => useCart(getPrice, products, null, 0, 'retiro'));
    act(() => result.current.addToCart(mockProduct, { stopPropagation: () => {} }));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cc).toBe(1);
    expect(result.current.ct).toBe(1000);
  });

  it('addToCart increments existing product', () => {
    const { result } = renderHook(() => useCart(getPrice, products, null, 0, 'retiro'));
    const fakeEvent = { stopPropagation: () => {} };
    act(() => result.current.addToCart(mockProduct, fakeEvent));
    act(() => result.current.addToCart(mockProduct, fakeEvent));
    expect(result.current.cc).toBe(2);
    expect(result.current.ct).toBe(2000);
  });

  it('updateQty changes quantity', () => {
    const { result } = renderHook(() => useCart(getPrice, products, null, 0, 'retiro'));
    act(() => result.current.addToCart(mockProduct, { stopPropagation: () => {} }));
    act(() => result.current.updateQty('p1', 5));
    expect(result.current.cc).toBe(5);
    expect(result.current.ct).toBe(5000);
  });

  it('updateQty with 0 removes item', () => {
    const { result } = renderHook(() => useCart(getPrice, products, null, 0, 'retiro'));
    act(() => result.current.addToCart(mockProduct, { stopPropagation: () => {} }));
    act(() => result.current.updateQty('p1', 0));
    expect(result.current.cart).toHaveLength(0);
    expect(result.current.cc).toBe(0);
  });

  it('clearCart empties everything', () => {
    const { result } = renderHook(() => useCart(getPrice, products, null, 0, 'retiro'));
    act(() => result.current.addToCart(mockProduct, { stopPropagation: () => {} }));
    act(() => result.current.addToCart(mockProduct2, { stopPropagation: () => {} }));
    act(() => result.current.clearCart());
    expect(result.current.cart).toHaveLength(0);
  });

  it('applies coupon discount', () => {
    const coupon = { id: 'c1', discount_pct: 10 };
    const { result } = renderHook(() => useCart(getPrice, products, coupon, 0, 'retiro'));
    act(() => result.current.addToCart(mockProduct, { stopPropagation: () => {} }));
    expect(result.current.discount).toBe(100); // 10% of 1000
    expect(result.current.ct).toBe(900);
  });

  it('includes delivery cost for envio', () => {
    const { result } = renderHook(() => useCart(getPrice, products, null, 1500, 'envio'));
    act(() => result.current.addToCart(mockProduct, { stopPropagation: () => {} }));
    expect(result.current.ct).toBe(1000);
    expect(result.current.ctWithDelivery).toBe(2500);
  });

  it('no delivery cost for retiro', () => {
    const { result } = renderHook(() => useCart(getPrice, products, null, 1500, 'retiro'));
    act(() => result.current.addToCart(mockProduct, { stopPropagation: () => {} }));
    expect(result.current.ctWithDelivery).toBe(1000);
  });

  it('getQty returns correct quantity', () => {
    const { result } = renderHook(() => useCart(getPrice, products, null, 0, 'retiro'));
    act(() => result.current.addToCart(mockProduct, { stopPropagation: () => {} }));
    expect(result.current.getQty('p1')).toBe(1);
    expect(result.current.getQty('p99')).toBe(0);
  });
});

// ── useStoreStatus ──

describe('useStoreStatus', () => {
  // Build store_hours: Mon-Fri 09:00-20:00, Sat 09:00-14:00, Sun closed
  const storeHours = [
    { open: '09:00', close: '20:00' }, // Mon
    { open: '09:00', close: '20:00' }, // Tue
    { open: '09:00', close: '20:00' }, // Wed
    { open: '09:00', close: '20:00' }, // Thu
    { open: '09:00', close: '20:00' }, // Fri
    { open: '09:00', close: '14:00' }, // Sat
    { closed: true },                   // Sun
  ];
  const sett = { store_hours: storeHours };

  it('shows open during business hours', () => {
    // Wednesday 12:00 → open (Wed = getDay()=3, dayIdx=(3+6)%7=2)
    const noon = new Date(2026, 3, 15, 12, 0); // Wed Apr 15 2026
    const { result } = renderHook(() => useStoreStatus(sett, noon));
    expect(result.current.storeStatus.open).toBe(true);
  });

  it('shows closed before opening time', () => {
    const early = new Date(2026, 3, 15, 7, 0); // Wed 7am
    const { result } = renderHook(() => useStoreStatus(sett, early));
    expect(result.current.storeStatus.open).toBe(false);
    expect(result.current.storeStatus.msg).toContain('09:00');
  });

  it('shows closed after closing time', () => {
    const late = new Date(2026, 3, 15, 21, 0); // Wed 9pm
    const { result } = renderHook(() => useStoreStatus(sett, late));
    expect(result.current.storeStatus.open).toBe(false);
  });

  it('shows closed on Sunday', () => {
    const sun = new Date(2026, 3, 12, 12, 0); // Sun Apr 12 2026
    const { result } = renderHook(() => useStoreStatus(sett, sun));
    expect(result.current.storeStatus.open).toBe(false);
    expect(result.current.storeStatus.msg).toContain('no abrimos');
  });

  it('returns minDate as ISO date string', () => {
    const now = new Date(2026, 3, 15, 12, 0);
    const { result } = renderHook(() => useStoreStatus(sett, now));
    expect(result.current.minDate).toBe('2026-04-15');
  });

  it('getAvailableHours returns valid hours for a date', () => {
    const now = new Date(2026, 3, 13, 8, 0); // Mon 8am
    const { result } = renderHook(() => useStoreStatus(sett, now));
    const hours = result.current.getAvailableHours('2026-04-14'); // Tuesday (future)
    // Open 09:00, close 20:00 → first=10, last=19
    expect(hours[0]).toBe(10);
    expect(hours[hours.length - 1]).toBe(19);
  });

  it('getAvailableHours returns empty for closed day', () => {
    const now = new Date(2026, 3, 13, 8, 0);
    const { result } = renderHook(() => useStoreStatus(sett, now));
    // Sunday Apr 19 2026
    const hours = result.current.getAvailableHours('2026-04-19');
    expect(hours).toEqual([]);
  });

  it('getDayInfo returns closed for Sunday', () => {
    const { result } = renderHook(() => useStoreStatus(sett, new Date(2026, 3, 13)));
    const info = result.current.getDayInfo('2026-04-19'); // Sunday
    expect(info.closed).toBe(true);
    expect(info.dayName).toBe('Domingo');
  });

  it('getDayInfo returns open info for weekday', () => {
    const { result } = renderHook(() => useStoreStatus(sett, new Date(2026, 3, 13)));
    const info = result.current.getDayInfo('2026-04-15'); // Wednesday
    expect(info.closed).toBe(false);
    expect(info.open).toBe('09:00');
    expect(info.close).toBe('20:00');
  });

  it('returns always-open when no store_hours configured', () => {
    const { result } = renderHook(() => useStoreStatus({}, new Date()));
    expect(result.current.storeStatus.open).toBe(true);
  });
});
