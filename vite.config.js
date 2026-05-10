import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// ── Multi-client: select config folder via CLIENT env var ────
// Usage: CLIENT=cochi npm run build | CLIENT=la-nona-pato npm run dev
const CLIENT = process.env.CLIENT || 'la-nona-pato'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
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
