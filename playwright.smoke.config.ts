// Smoke del edificio contra PRODUCCION (smoke/edificio.spec.ts).
//
// Config aparte y carpeta aparte a proposito: la suite general (e2e/) corre en
// cada PR, y esta mira lo publicado. Si compartieran config, una caida de
// produccion pondria en rojo PRs que no tienen nada que ver.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './smoke',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  // Un reintento, no dos: es produccion por red. Si falla dos veces seguidas
  // no es un parpadeo.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    // El service worker puede servir un bundle cacheado de un deploy anterior:
    // el smoke tiene que ver lo que esta publicado AHORA.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
