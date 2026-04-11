import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Separar chunks para mejor caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Supabase SDK en su propio chunk (no cambia seguido → se cachea)
          supabase: ['@supabase/supabase-js'],
          // React core en su propio chunk
          react: ['react', 'react-dom', 'react-router-dom'],
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
