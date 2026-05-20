import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { initObservability } from './lib/observability.js'
import { loadFlags } from './services/featureFlags.js'
import { fetchActiveTheme, applyTheme } from './services/theme.js'
import business from '@business'
import './lib/i18n.js' // Initialize i18next (must be before App render)

// Initialize error tracking & analytics (no-op if env vars not set)
initObservability()

// ── Dynamic favicon & title per client ──────────────────────
;(function setBranding() {
  // Title
  document.title = business.tagline
    ? `${business.name} — ${business.tagline}`
    : business.name

  // Favicon: if client has a custom favicon, swap it (prefer PNG, fallback SVG)
  if (business.logoUrl) {
    const clientFavicon = `/clients/${__CLIENT__}/favicon.png`
    let link = document.querySelector('link[rel="icon"]')
    if (link) {
      link.type = 'image/png'
      link.href = clientFavicon
    }
  }

  // Theme color
  if (business.branding?.themeColorLight) {
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      if (m.media?.includes('light')) m.content = business.branding.themeColorLight
      else if (m.media?.includes('dark')) m.content = business.branding.themeColorDark || business.branding.themeColorLight
    })
  }
})()

// Pre-load feature flags and theme config before first render
loadFlags().catch(() => {})
fetchActiveTheme().then(t => applyTheme(t)).catch(() => {})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// Register Service Worker for offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
