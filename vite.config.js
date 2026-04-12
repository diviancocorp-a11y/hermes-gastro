import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
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
