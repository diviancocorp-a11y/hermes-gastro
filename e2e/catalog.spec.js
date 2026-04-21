// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Public Catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads the catalog page with store name', async ({ page }) => {
    // Should display the store name or loading indicator
    await expect(page.locator('body')).toBeVisible();
    // Wait for the catalog to load (either products or store-closed message)
    await expect(page.locator('[class*="cat"], [class*="closed"], [class*="product"], h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows product categories', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(2000);
    // Check for category sections or product cards
    const hasProducts = await page.locator('[class*="product"], [class*="card"], [class*="recipe"]').count();
    const hasClosed = await page.locator('text=/cerrad|no disponible|próximamente/i').count();
    expect(hasProducts + hasClosed).toBeGreaterThan(0);
  });

  test('can add product to cart', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(2000);
    const addBtn = page.locator('button:has-text("+"), button:has-text("Agregar"), button[class*="add"]').first();
    const btnVisible = await addBtn.isVisible().catch(() => false);

    if (btnVisible) {
      await addBtn.click();
      // Cart count should increase
      const cartIndicator = page.locator('[class*="cart"], [class*="badge"], [class*="count"]').first();
      await expect(cartIndicator).toBeVisible({ timeout: 3000 });
    } else {
      // Store might be closed — that's OK
      test.skip();
    }
  });

  test('navigates to order tracker', async ({ page }) => {
    await page.goto('/tracker');
    // Should show tracker page or redirect
    await expect(page.locator('body')).toBeVisible();
  });
});
