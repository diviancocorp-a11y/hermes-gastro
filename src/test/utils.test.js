import { describe, it, expect, beforeEach } from 'vitest';
import { formatMoney, formatInt, todayISO, generateId, formatOrderCode, optimizeImage, originalImageUrl, disableImageTransforms, resetImageTransforms } from '@hermes/core/lib/utils.jsx';

describe('fm (format money)', () => {
  it('formats number with 2 decimals AR locale', () => {
    const r = formatMoney(1500);
    // Should contain "1.500" or "1,500" depending on locale
    expect(r).toContain('00');
  });

  it('returns "0.00" for non-number', () => {
    expect(formatMoney(null)).toBe('0.00');
    expect(formatMoney(undefined)).toBe('0.00');
    expect(formatMoney('abc')).toBe('0.00');
  });
});

describe('fi (format integer)', () => {
  it('formats integer with AR locale', () => {
    const r = formatInt(1500);
    expect(r).toBeTruthy();
  });

  it('returns "0" for non-number', () => {
    expect(formatInt(null)).toBe('0');
    expect(formatInt('abc')).toBe('0');
  });
});

describe('td (today date)', () => {
  it('returns ISO date string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('uid', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId));
    expect(ids.size).toBe(100);
  });
});

describe('saleCode', () => {
  it('returns # + last 6 chars uppercased', () => {
    expect(formatOrderCode('abc-def-123456')).toBe('#123456');
  });

  it('handles null/undefined', () => {
    expect(formatOrderCode(null)).toBe('#');
    expect(formatOrderCode(undefined)).toBe('#');
  });

  it('strips dashes before slicing', () => {
    expect(formatOrderCode('a-b-c-d-e-f')).toBe('#ABCDEF');
  });
});

describe('imgOpt', () => {
  beforeEach(() => {
    resetImageTransforms(); // reset module-level state between tests
  });

  it('transforms supabase storage URL', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/bucket/img.jpg';
    const out = optimizeImage(url, { width: 300 });
    expect(out).toContain('/render/image/public/');
    expect(out).toContain('width=300');
  });

  it('returns non-supabase URLs unchanged', () => {
    const url = 'https://images.unsplash.com/photo.jpg';
    expect(optimizeImage(url, { width: 300 })).toBe(url);
  });

  it('handles null/undefined gracefully', () => {
    expect(optimizeImage(null)).toBeNull();
    expect(optimizeImage(undefined)).toBeUndefined();
  });

  it('returns original URL when transforms are disabled', () => {
    disableImageTransforms();
    const url = 'https://x.supabase.co/storage/v1/object/public/bucket/img.jpg';
    const out = optimizeImage(url, { width: 300 });
    expect(out).toBe(url);
    expect(out).not.toContain('/render/image/');
  });
});

describe('originalImageUrl', () => {
  it('converts render URL back to object URL', () => {
    const renderUrl = 'https://x.supabase.co/storage/v1/render/image/public/bucket/img.jpg?width=300&quality=75';
    const original = originalImageUrl(renderUrl);
    expect(original).toBe('https://x.supabase.co/storage/v1/object/public/bucket/img.jpg');
    expect(original).not.toContain('render/image');
    expect(original).not.toContain('?');
  });

  it('returns non-render URLs unchanged', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/bucket/img.jpg';
    expect(originalImageUrl(url)).toBe(url);
  });

  it('handles null/undefined gracefully', () => {
    expect(originalImageUrl(null)).toBeNull();
    expect(originalImageUrl(undefined)).toBeUndefined();
  });
});
