// Smoke del pedido contra PRODUCCION (smoke-pedido/pedido.spec.ts).
//
// Aparte del smoke del edificio porque ESCRIBE (crea y cancela un pedido): no
// puede colgarse del deploy ni de la suite de los PRs. Corre a mano.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './smoke-pedido',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  // Sin reintentos: cada intento crea un pedido real.
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    // Que se vea lo publicado AHORA, no un bundle cacheado por el service worker.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Telefono: el catalogo y el seguimiento se usan desde ahi.
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } }],
})
