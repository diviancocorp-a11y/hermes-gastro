/**
 * Observability layer for the Hermes Gastro platform.
 *
 * Provides error tracking and analytics without requiring Sentry SDK in the bundle.
 * When VITE_SENTRY_DSN is set, errors are reported via the Sentry Envelope API.
 * When VITE_ANALYTICS_ID is set, page views are tracked via a simple beacon.
 *
 * This approach adds zero dependencies — Sentry's full SDK (~30KB) is not needed
 * for basic error reporting in a small app.
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ANALYTICS_ID = import.meta.env.VITE_ANALYTICS_ID || '';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
const ENV = import.meta.env.MODE || 'production';

// ─── Sentry Lightweight Reporter ────────────────────────

let sentryEndpoint = '';
if (SENTRY_DSN) {
  try {
    const url = new URL(SENTRY_DSN);
    const projectId = url.pathname.replace('/', '');
    sentryEndpoint = `${url.protocol}//${url.host}/api/${projectId}/envelope/`;
  } catch { /* invalid DSN — silently ignore */ }
}

function buildSentryEnvelope(error, context = {}) {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID().replace(/-/g, '');

  const header = JSON.stringify({
    event_id: eventId,
    sent_at: now,
    dsn: SENTRY_DSN,
  });

  const itemHeader = JSON.stringify({ type: 'event' });

  const payload = JSON.stringify({
    event_id: eventId,
    timestamp: now,
    platform: 'javascript',
    level: 'error',
    environment: ENV,
    release: `hermes-gastro@${APP_VERSION}`,
    exception: {
      values: [{
        type: error.name || 'Error',
        value: error.message || String(error),
        stacktrace: error.stack ? { frames: parseStack(error.stack) } : undefined,
      }],
    },
    tags: context.tags || {},
    extra: context.extra || {},
    user: context.user || undefined,
  });

  return `${header}\n${itemHeader}\n${payload}`;
}

function parseStack(stack) {
  return stack.split('\n').slice(1, 10).map(line => {
    const match = line.match(/at\s+(.+?)\s*\(?(https?:\/\/.+?):(\d+):(\d+)\)?/);
    if (!match) return { filename: line.trim(), lineno: 0, colno: 0, function: '?' };
    return {
      function: match[1] || '?',
      filename: match[2],
      lineno: parseInt(match[3], 10),
      colno: parseInt(match[4], 10),
    };
  }).reverse(); // Sentry expects frames bottom-up
}

// ─── Public API ─────────────────────────────────────────

/**
 * Report an error to Sentry (if configured).
 * Safe to call even without a DSN — it's a no-op.
 */
export function captureException(error, context = {}) {
  // Always log locally
  console.error('[observability]', error);

  if (!sentryEndpoint) return;

  try {
    const envelope = buildSentryEnvelope(error, context);
    // Use sendBeacon for fire-and-forget (works even on page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(sentryEndpoint, envelope);
    } else {
      fetch(sentryEndpoint, {
        method: 'POST',
        body: envelope,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        keepalive: true,
      }).catch(() => {}); // swallow network errors
    }
  } catch { /* never throw from error reporting */ }
}

/**
 * Report a breadcrumb/message to Sentry.
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!sentryEndpoint) return;
  captureException(new Error(message), { ...context, tags: { ...context.tags, level } });
}

// ─── Analytics (simple pageview beacon) ─────────────────

/**
 * Track a page view. Uses navigator.sendBeacon to a configurable endpoint.
 * Compatible with Plausible, Umami, or any custom analytics endpoint.
 */
export function trackPageView(path) {
  if (!ANALYTICS_ID) return;

  const payload = {
    name: 'pageview',
    url: window.location.origin + (path || window.location.pathname),
    domain: window.location.hostname,
    referrer: document.referrer || '',
    screen_width: window.innerWidth,
  };

  try {
    // Plausible-compatible endpoint
    const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT || 'https://plausible.io/api/event';
    navigator.sendBeacon(endpoint, JSON.stringify(payload));
  } catch { /* swallow */ }
}

/**
 * Track a custom event (e.g., "order_placed", "recipe_viewed").
 */
export function trackEvent(name, props = {}) {
  if (!ANALYTICS_ID) return;

  try {
    const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT || 'https://plausible.io/api/event';
    navigator.sendBeacon(endpoint, JSON.stringify({
      name,
      url: window.location.href,
      domain: window.location.hostname,
      props,
    }));
  } catch { /* swallow */ }
}

// ─── Global Error Handlers ──────────────────────────────

/**
 * Install global error handlers. Call once at app startup.
 */
export function initObservability() {
  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    captureException(event.error || new Error(event.message), {
      tags: { source: 'window.onerror' },
      extra: { filename: event.filename, lineno: event.lineno },
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
    captureException(error, { tags: { source: 'unhandledrejection' } });
  });

  // Track initial page view
  trackPageView();
}
