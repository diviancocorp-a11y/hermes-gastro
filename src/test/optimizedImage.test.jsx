import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import OptimizedImage from '../components/ui/OptimizedImage';

describe('OptimizedImage', () => {
  it('renders null when src is empty', () => {
    const { container } = render(<OptimizedImage src="" alt="test" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders img with lazy loading by default', () => {
    const { container } = render(
      <OptimizedImage src="https://example.com/img.jpg" alt="test" />
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
  });

  it('renders with eager loading when priority is true', () => {
    const { container } = render(
      <OptimizedImage src="https://example.com/img.jpg" alt="test" priority />
    );
    const img = container.querySelector('img');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });

  it('generates srcset for Supabase Storage URLs', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/images/photo.jpg';
    const { container } = render(
      <OptimizedImage src={url} alt="test" width={120} />
    );
    const img = container.querySelector('img');
    expect(img.getAttribute('srcset')).toContain('1x');
    expect(img.getAttribute('srcset')).toContain('2x');
    expect(img.getAttribute('srcset')).toContain('3x');
  });

  it('does not generate srcset for non-Supabase URLs', () => {
    const { container } = render(
      <OptimizedImage src="https://example.com/photo.jpg" alt="test" width={120} />
    );
    const img = container.querySelector('img');
    expect(img.getAttribute('srcset')).toBeNull();
  });
});
