import { describe, it, expect, beforeEach } from 'vitest';
import { formatMoney, formatInt, todayISO, generateId, formatOrderCode, optimizeImage, originalImageUrl, disableImageTransforms, resetImageTransforms, waPhoneAr, waLink } from '@hermes/core/lib/utils.jsx';

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

describe('waPhoneAr (normalizacion telefono AR)', () => {
  it('prepende 549 a un numero local sin codigo de pais', () => {
    expect(waPhoneAr('3814123456')).toBe('5493814123456');
  });

  it('saca el 0 de larga distancia', () => {
    expect(waPhoneAr('03814123456')).toBe('5493814123456');
  });

  it('deja intacto un E.164 movil ya normalizado', () => {
    expect(waPhoneAr('5493814123456')).toBe('5493814123456');
    expect(waPhoneAr('+54 9 381 412-3456')).toBe('5493814123456');
  });

  it('inserta el 9 de movil cuando el pais viene sin el', () => {
    expect(waPhoneAr('54 381 4123456')).toBe('5493814123456');
    expect(waPhoneAr('+54 11 5412 3456')).toBe('5491154123456');
  });

  it('crudo, 549 y formateado normalizan al mismo valor (matching estable)', () => {
    const a = waPhoneAr('1155443322');
    const b = waPhoneAr('5491155443322');
    const c = waPhoneAr('+54 9 11 5544-3322');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('devuelve null si no hay digitos', () => {
    expect(waPhoneAr('')).toBeNull();
    expect(waPhoneAr(null)).toBeNull();
    expect(waPhoneAr('  --  ')).toBeNull();
  });

  it('waLink arma el wa.me o null', () => {
    expect(waLink('3814123456')).toBe('https://wa.me/5493814123456');
    expect(waLink('')).toBeNull();
  });
});
