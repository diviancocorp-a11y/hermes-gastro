// src/lib/webVitals.js
// Reporta Core Web Vitals (LCP, CLS, INP, FCP, TTFB) a observability.js
// Solo se ejecuta en cliente, una vez post-mount. Sin libs externas — usa
// la API nativa PerformanceObserver donde está disponible.
//
// Para tracking robusto con buckets (good/needs-improvement/poor), instalar
// la lib `web-vitals` de Google. Acá usamos un tracker liviano (~1KB).

import { trackEvent } from './observability';

const TARGETS = {
  // Umbrales de Google (good / poor)
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

function bucket(metric, value) {
  const t = TARGETS[metric];
  if (!t) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

function report(metric, value) {
  const rounded = metric === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value);
  const rating = bucket(metric, value);
  try {
    trackEvent('web_vital', { metric, value: rounded, rating });
  } catch { /* swallow */ }
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[vitals] ${metric}=${rounded} (${rating})`);
  }
}

function observeLCP() {
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) report('LCP', last.startTime);
    });
    po.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* not supported */ }
}

function observeCLS() {
  if (typeof PerformanceObserver === 'undefined') return;
  let cls = 0;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) cls += entry.value;
      }
    });
    po.observe({ type: 'layout-shift', buffered: true });
    // Reportar al unload (CLS es acumulativo)
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') report('CLS', cls);
    }, { once: true });
  } catch { /* not supported */ }
}

function observeINP() {
  if (typeof PerformanceObserver === 'undefined') return;
  let maxDuration = 0;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > maxDuration) maxDuration = entry.duration;
      }
    });
    po.observe({ type: 'event', buffered: true, durationThreshold: 40 });
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && maxDuration > 0) {
        report('INP', maxDuration);
      }
    }, { once: true });
  } catch { /* not supported */ }
}

function observeFCPandTTFB() {
  if (typeof performance === 'undefined') return;
  // FCP
  try {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcp) report('FCP', fcp.startTime);
  } catch { /* swallow */ }
  // TTFB
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.responseStart) report('TTFB', nav.responseStart);
  } catch { /* swallow */ }
}

export function initWebVitals() {
  if (typeof window === 'undefined') return;
  observeLCP();
  observeCLS();
  observeINP();
  // Defer FCP/TTFB un tick para que existan en perf timeline
  setTimeout(observeFCPandTTFB, 0);
}
