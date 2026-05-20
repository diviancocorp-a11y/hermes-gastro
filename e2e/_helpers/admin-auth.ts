// Logs the admin into the catalog admin panel using credentials from .env.e2e.
// Returns the authenticated Page ready for admin assertions.
import { Page, expect } from '@playwright/test'

export async function loginAdmin(page: Page) {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('Missing E2E_ADMIN_EMAIL or E2E_ADMIN_PASSWORD — see .env.e2e.example')
  }
  await page.goto('/admin')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  // Login screen disappears, admin shell shows
  await expect(page.locator('.hd')).toBeVisible({ timeout: 15_000 })
}
