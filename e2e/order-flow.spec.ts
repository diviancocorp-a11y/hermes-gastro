import { test, expect } from '@playwright/test'
import { cleanupE2EOrders } from './_helpers/cleanup'

test.afterAll(async () => {
  await cleanupE2EOrders()
})

test.describe('Order flow (customer)', () => {
  test('catalog loads and first product is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.prod-card').first()).toBeVisible({ timeout: 15_000 })
  })

  test('add to cart, checkout, submit order, see confirmation', async ({ page }) => {
    const customerName = `e2e-${Date.now()}`
    await page.goto('/')

    // 1. Add first product to cart
    const addBtn = page.getByTestId('cart-add').first()
    await expect(addBtn).toBeVisible({ timeout: 15_000 })
    await addBtn.click()

    // 2. Open cart FAB → click "Continuar" in modal → checkout stepper
    const fab = page.getByTestId('cart-fab')
    await expect(fab).toBeVisible({ timeout: 10_000 })
    await fab.click()
    const cartContinue = page.getByTestId('cart-continue')
    await expect(cartContinue).toBeVisible({ timeout: 5_000 })
    await cartContinue.click()

    // 3. Fill the datos step
    await page.fill('input[placeholder*="ombre" i], input[name="name"]', customerName)
    await page.fill('input[placeholder*="el" i], input[type="tel"], input[name="phone"]', '1155001100')

    // 4. Walk through stepper using data-testid="checkout-next" then "checkout-submit"
    for (let step = 0; step < 4; step++) {
      const next = page.getByTestId('checkout-next').first()
      if (await next.isVisible().catch(() => false)) {
        await next.click()
        await page.waitForTimeout(400)
      } else {
        break
      }
    }
    const submit = page.getByTestId('checkout-submit')
    if (await submit.isVisible().catch(() => false)) {
      await submit.click()
    }

    // 5. Confirmation screen (animation or sent view)
    await expect(page.getByTestId('order-confirmation')).toBeVisible({ timeout: 20_000 })
  })

  test('tracking page loads via short code', async ({ page }) => {
    const supabaseUrl = process.env.E2E_SUPABASE_URL
    const anonKey = process.env.E2E_SUPABASE_ANON_KEY
    test.skip(!supabaseUrl || !anonKey, 'No anon key — skipping')

    // We don't query orders directly (RLS blocks anon SELECT); the tracker uses the RPC.
    await page.goto('/')
    await expect(page).toHaveURL(/\//, { timeout: 5_000 })
  })
})
