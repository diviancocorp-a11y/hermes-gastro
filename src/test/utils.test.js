import { describe, it, expect } from 'vitest';
import { fm, fi, td, uid, saleCode, imgOpt } from '../lib/utils.jsx';

describe('fm (format money)', () => {
  it('formats number with 2 decimals AR locale', () => {
    const r = fm(1500);
    // Should contain "1.500" or "1,500" depending on locale
    expect(r).toContain('00');
  });

  it('returns "0.00" for non-number', () => {
    expect(fm(null)).toBe('0.00');
    expect(fm(undefined)).toBe('0.00');
    expect(fm('abc')).toBe('0.00');
  });
});

describe('fi (format integer)', () => {
  it('formats integer with AR locale', () => {
    const r = fi(1500);
    expect(r).toBeTruthy();
  });

  it('returns "0" for non-number', () => {
    expect(fi(null)).toBe('0');
    expect(fi('abc')).toBe('0');
  });
});

describe('td (today date)', () => {
  it('returns ISO date string', () => {
    expect(td()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('uid', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, uid));
    expect(ids.size).toBe(100);
  });
});

describe('saleCode', () => {
  it('returns # + last 6 chars uppercased', () => {
    expect(saleCode('abc-def-123456')).toBe('#123456');
  });

  it('handles null/undefined', () => {
    expect(saleCode(null)).toBe('#');
    expect(saleCode(undefined)).toBe('#');
  });

  it('strips dashes before slicing', () => {
    expect(saleCode('a-b-c-d-e-f')).toBe('#ABCDEF');
  });
});

describe('imgOpt', () => {
  it('transforms supabase storage URL', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/bucket/img.jpg';
    const out = imgOpt(url, { width: 300 });
    expect(out).toContain('/render/image/public/');
    expect(out).toContain('width=300');
  });

  it('returns non-supabase URLs unchanged', () => {
    const url = 'https://images.unsplash.com/photo.jpg';
    expect(imgOpt(url, { width: 300 })).toBe(url);
  });

  it('handles null/undefined gracefully', () => {
    expect(imgOpt(null)).toBeNull();
    expect(imgOpt(undefined)).toBeUndefined();
  });
});
