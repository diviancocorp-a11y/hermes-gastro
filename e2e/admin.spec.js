// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('shows login screen when not authenticated', async ({ page }) => {
    // Should show login form
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput.or(passwordInput).first()).toBeVisible({ timeout: 10_000 });
  });

  test('login form validates empty fields', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"], button:has-text("Ingresar"), button:has-text("Login")').first();
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    await submitBtn.click();
    // Should not navigate away — still on login
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"], button:has-text("Ingresar"), button:has-text("Login")').first();

    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill('invalid@test.com');
    await passwordInput.fill('wrongpassword');
    await submitBtn.click();

    // Should show error message
    const error = page.locator('[class*="error"], [class*="alert"], [role="alert"], text=/error|inválid|incorrec/i');
    await expect(error.first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Admin Panel — Authenticated', () => {
  // These tests require valid credentials in env vars
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  test.skip(!email || !password, 'Requires ADMIN_EMAIL and ADMIN_PASSWORD env vars');

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"], button:has-text("Ingresar"), button:has-text("Login")').first();

    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await submitBtn.click();

    // Wait for dashboard to load
    await expect(page.locator('[class*="hd"], [class*="header"], nav').first()).toBeVisible({ timeout: 15_000 });
  });

  test('displays dashboard with key metrics', async ({ page }) => {
    // Should show financial metrics on the home tab
    const metrics = page.locator('[class*="stat"], [class*="metric"], [class*="card"]');
    await expect(metrics.first()).toBeVisible({ timeout: 5_000 });
  });

  test('can navigate to orders tab', async ({ page }) => {
    const ordersBtn = page.locator('button:has-text("Pedidos"), nav button:nth-child(2)').first();
    await ordersBtn.click();
    // Should show orders list or empty state
    await page.waitForTimeout(1000);
    const ordersContent = page.locator('[class*="order"], text=/pedido|sin pedidos|no hay/i');
    await expect(ordersContent.first()).toBeVisible({ timeout: 5_000 });
  });

  test('can open stock section from hamburger menu', async ({ page }) => {
    // Click "Más" hamburger button
    const moreBtn = page.locator('button:has-text("Más"), nav button:last-child').first();
    await moreBtn.click();
    // Click Stock
    const stockBtn = page.locator('button:has-text("Stock")').first();
    await expect(stockBtn).toBeVisible({ timeout: 3_000 });
    await stockBtn.click();
    // Should show ingredients list
    await page.waitForTimeout(1000);
  });

  test('can logout', async ({ page }) => {
    const logoutBtn = page.locator('button[title*="sesión"], button[title*="logout"]').first();
    await logoutBtn.click();
    // Should return to login screen
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5_000 });
  });
});
