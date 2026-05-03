import { describe, it, expect, vi } from 'vitest';
import { captureException, captureMessage, trackPageView, trackEvent, initObservability } from '@hermes/core/lib/observability.js';

describe('observability module', () => {
  it('exports all public functions', () => {
    expect(typeof captureException).toBe('function');
    expect(typeof captureMessage).toBe('function');
    expect(typeof trackPageView).toBe('function');
    expect(typeof trackEvent).toBe('function');
    expect(typeof initObservability).toBe('function');
  });

  it('captureException does not throw without DSN', () => {
    expect(() => captureException(new Error('test'))).not.toThrow();
  });

  it('captureException logs to console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('test error');
    captureException(err);
    expect(spy).toHaveBeenCalledWith('[observability]', err);
    spy.mockRestore();
  });

  it('captureMessage does not throw without DSN', () => {
    expect(() => captureMessage('hello')).not.toThrow();
  });

  it('trackPageView does not throw without analytics ID', () => {
    expect(() => trackPageView('/test')).not.toThrow();
  });

  it('trackEvent does not throw without analytics ID', () => {
    expect(() => trackEvent('click', { button: 'buy' })).not.toThrow();
  });

  it('initObservability registers global handlers without throwing', () => {
    if (typeof window === 'undefined') return; // skip in non-browser env
    expect(() => initObservability()).not.toThrow();
  });
});
