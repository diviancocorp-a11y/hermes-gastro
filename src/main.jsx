import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { initObservability } from './lib/observability.js'
import { loadFlags } from './services/featureFlags.js'
import { fetchActiveTheme, applyTheme } from './services/theme.js'
import './lib/i18n.js' // Initialize i18next (must be before App render)

// Initialize error tracking & analytics (no-op if env vars not set)
initObservability()

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