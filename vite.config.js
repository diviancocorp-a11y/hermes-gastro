import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'

// ── Multi-client: select config folder via CLIENT env var ────
// Usage: CLIENT=cochi npm run build | CLIENT=la-nona-pato npm run dev
const CLIENT = process.env.CLIENT || 'la-nona-pato'

// ── Load business config for HTML injection ─────────────────
function loadBusinessConfig() {
  const configPath = path.resolve(__dirname, `clients/${CLIENT}/business.js`)
  // Use file:// URL for dynamic import (works reliably on all platforms)
  return import(pathToFileURL(configPath).href)
    .then(mod => mod.default)
    .catch(() => ({ name: CLIENT, description: '', branding: {} }))
}

function businessHtmlPlugin() {
  let biz
  return {
    name: 'business-html',
    async configResolved() {
      biz = await loadBusinessConfig()
    },
    transformIndexHtml(html) {
      if (!biz) return html

      const title = biz.tagline ? `${biz.name} — ${biz.tagline}` : biz.name
      const description = biz.description || ''
      const themeLight = biz.branding?.themeColorLight || '#C45D3E'
      const themeDark = biz.branding?.themeColorDark || '#1A1210'
      const locale = (biz.locale || 'es-AR').replace('-', '_')
      const ogImage = biz.branding?.ogImage || '/og-image.png'
      const faviconSvg = biz.logoUrl ? `/clients/${CLIENT}/favicon.svg` : '/favicon.svg'
      const supabaseUrl = process.env.VITE_SUPABASE_URL || ''

      // Build structured data from business config
      const structuredData = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': biz.schemaOrgType || 'Restaurant',
        name: biz.name,
        description: biz.description || '',
        address: biz.address ? {
          '@type': 'PostalAddress',
          streetAddress: biz.address.street || '',
          addressLocality: biz.address.city || '',
          addressRegion: biz.address.region || '',
          addressCountry: biz.address.country || '',
        } : undefined,
        geo: biz.geo ? {
          '@type': 'GeoCoordinates',
          latitude: biz.geo.lat,
          longitude: biz.geo.lng,
        } : undefined,
        servesCuisine: biz.cuisines || [],
        priceRange: biz.priceRange || '$$',
        acceptsReservations: false,
        telephone: biz.phone || '',
        openingHoursSpecification: (biz.hours || []).map(h => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: h.days,
          opens: h.opens,
          closes: h.closes,
        })),
      }, null, 2)

      return html
        .replaceAll('<!-- __BIZ_TITLE__ -->', title)
        .replaceAll('<!-- __BIZ_DESCRIPTION__ -->', description)
        .replace('<!-- __BIZ_THEME_LIGHT__ -->', themeLight)
        .replace('<!-- __BIZ_THEME_DARK__ -->', themeDark)
        .replace('<!-- __BIZ_LOCALE__ -->', locale)
        .replace('<!-- __BIZ_OG_IMAGE__ -->', ogImage)
        .replace('<!-- __BIZ_FAVICON_SVG__ -->', faviconSvg)
        .replaceAll('<!-- __BIZ_SUPABASE_URL__ -->', supabaseUrl)
        .replace('<!-- __BIZ_STRUCTURED_DATA__ -->', structuredData)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [businessHtmlPlugin(), tailwindcss(), react()],
  resolve: {
    alias: {
      '@business': path.resolve(__dirname, `clients/${CLIENT}/business.js`),
    },
  },
  define: {
    __CLIENT__: JSON.stringify(CLIENT),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/lib/**', 'src/services/**', 'src/hooks/**', 'src/components/ui/**'],
      exclude: ['src/lib/supabase.js'],
      thresholds: {
        statements: 70,
      },
    },
  },
  build: {
    // Separar chunks para mejor caching (función requerida por Vite 8 / Rolldown)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) return 'supabase';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'react-vendor';
        },
      },
    },
    // Subir límite de advertencia (evita ruido en CI)
    chunkSizeWarningLimit: 300,
    // Target moderno para browsers actuales (más chico)
    target: 'es2020',
    // Minificar CSS
    cssMinify: true,
  },
})
