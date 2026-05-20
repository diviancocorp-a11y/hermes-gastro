import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'

const CLIENT = process.env.CLIENT || 'la-nona-pato'

function loadClientEnv() {
  const envFile = path.resolve(__dirname, `.env.${CLIENT}`)
  if (!fs.existsSync(envFile)) return
  const content = fs.readFileSync(envFile, 'utf-8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = val
  }
}
loadClientEnv()

function loadBusinessConfig() {
  const configPath = path.resolve(__dirname, `clients/${CLIENT}/business.js`)
  return import(pathToFileURL(configPath).href)
    .then(mod => mod.default)
    .catch(() => ({ name: CLIENT, description: '', branding: {} }))
}

function renderManifest(biz) {
  const name = biz.name || CLIENT
  const shortName = biz.shortName || name
  const description = biz.description || ''
  const themeColor = biz.branding?.themeColorLight || '#C45D3E'
  const bgColor = biz.branding?.catalogBg || '#FFF8F0'
  const favicon = biz.faviconUrl
    || (biz.logoUrl ? `/clients/${CLIENT}/favicon.png` : '/favicon.svg')
  return JSON.stringify({
    name, short_name: shortName, description,
    start_url: '/', display: 'standalone',
    theme_color: themeColor, background_color: bgColor,
    icons: [
      { src: favicon, sizes: '192x192', type: 'image/png' },
      { src: favicon, sizes: '512x512', type: 'image/png' },
    ],
  }, null, 2)
}

function businessHtmlPlugin() {
  let biz = { name: CLIENT, description: '', branding: {} }
  return {
    name: 'business-html-injection',
    async config() { biz = await loadBusinessConfig() },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const title = biz.name || 'Hermes Gastro'
        const desc = biz.description || ''
        const themeColor = biz.branding?.themeColorLight || '#C45D3E'
        return html
          .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
          .replace(/<meta name="description" content=".*?"/, `<meta name="description" content="${desc}"`)
          .replace(/<meta name="theme-color" content=".*?"/, `<meta name="theme-color" content="${themeColor}"`)
      },
    },
    configureServer(server) {
      server.middlewares.use('/manifest.json', (req, res, next) => {
        if (req.method !== 'GET') return next()
        res.setHeader('Content-Type', 'application/manifest+json')
        res.end(renderManifest(biz))
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: renderManifest(biz),
      })
    },
  }
}

export default defineConfig({
  plugins: [businessHtmlPlugin(), tailwindcss(), react()],
  resolve: {
    alias: {
      '@business': path.resolve(__dirname, `clients/${CLIENT}/business.js`),
      '@hermes/core': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    __CLIENT__: JSON.stringify(CLIENT),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    env: {
      VITE_SUPABASE_URL: 'http://test.local',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/lib/**', 'src/services/**', 'src/hooks/**', 'src/components/ui/**'],
      exclude: ['src/lib/supabase.js'],
      // Threshold gradual — plan de subida:
      //   FASE 5b (actual): 35  — refleja estado real del repo
      //   Próxima vuelta:   45  — cuando agreguemos tests de Home/Orders/Finance
      //   Meta:             70  — cuando cubramos hooks + services + componentes críticos
      thresholds: { statements: 35 },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'react-vendor'
        },
      },
    },
    chunkSizeWarningLimit: 300,
    target: 'es2020',
    cssMinify: true,
  },
})
