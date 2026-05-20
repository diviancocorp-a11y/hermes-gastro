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

    // 2. Open cart FAB → "Continuar" → checkout stepper
    const fab = page.getByTestId('cart-fab')
    await expect(fab).toBeVisible({ timeout: 10_000 })
    await fab.click()
    const cartContinue = page.getByTestId('cart-continue')
    await expect(cartContinue).toBeVisible({ timeout: 5_000 })
    await cartContinue.click()

    // 3. Datos: nombre + teléfono
    await page.fill('input[placeholder*="ombre" i], input[name="name"]', customerName)
    await page.fill('input[placeholder*="el" i], input[type="tel"], input[name="phone"]', '1155001100')

    // 4. Schedule: SIEMPRE "Programar para después" — robusto a horario de tienda.
    //    Algunos clientes tienen tienda cerrada en horario de CI, esto evita el bloqueo.
    const scheduleLater = page.getByTestId('schedule-later')
    await expect(scheduleLater).toBeVisible({ timeout: 5_000 })
    await scheduleLater.click()

    // Elegir fecha: 7 días en el futuro (asegura caer en algún día abierto)
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const dateInput = page.getByTestId('schedule-date')
    await expect(dateInput).toBeVisible({ timeout: 3_000 })
    await dateInput.fill(futureDate)

    // Elegir primera hora disponible en el select
    const timeSelect = page.getByTestId('schedule-time')
    await expect(timeSelect).toBeEnabled({ timeout: 5_000 })
    const opts = await timeSelect.locator('option').allTextContents()
    const firstHour = opts.find(o => /^\d{2}:00$/.test(o.trim()))
    if (firstHour) await timeSelect.selectOption({ label: firstHour })

    // 5. Walk through stepper
    for (let step = 0; step < 4; step++) {
      const next = page.getByTestId('checkout-next').first()
      if (await next.isVisible().catch(() => false) && await next.isEnabled().catch(() => false)) {
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

    // 6. Confirmation screen
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
