// E2E test configuration — runs the suite against the mala-miga staging
// deployment. Override TARGET_URL via env var to point at another client.
import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// Auto-load .env.e2e (gitignored) so `npx playwright test` works without
// needing to `source .env.e2e` first. CI sets the vars via repo secrets.
function loadDotenvE2E() {
  const p = path.resolve(__dirname, '.env.e2e')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf-8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!(k in process.env)) process.env[k] = v
  }
}
loadDotenvE2E()

const TARGET = process.env.TARGET_URL || 'https://mala-miga.vercel.app'

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/_helpers/**'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: TARGET,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
