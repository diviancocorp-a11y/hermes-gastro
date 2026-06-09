import { test, expect } from '@playwright/test'
import { cleanupE2EOrders } from './_helpers/cleanup'

/**
 * Regresion del bug Zod-strip #5 (jun 2026): delivery_address y delivery_cost
 * se perdian entre el checkout y la DB. Este test pega DIRECTO a la edge
 * function submit-order (sin UI) y verifica la fila persistida con service role.
 */

const SUPABASE_URL = process.env.E2E_SUPABASE_URL
const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY
const SERVICE_ROLE = process.env.E2E_SUPABASE_SERVICE_ROLE


/** Headers para REST/functions: con keys nuevas (sb_*) NO se manda Bearer (no son JWT). */
function authHeaders(key: string): Record<string, string> {
  return key.startsWith('sb_')
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` }
}

test.afterAll(async () => {
  await cleanupE2EOrders()
})

test.describe('submit-order persiste direccion y costo de envio', () => {
  test('pedido con envio guarda delivery_address y delivery_cost, y los suma al total', async () => {
    test.skip(!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE, 'Faltan env vars E2E_SUPABASE_*')

    // 1. Conseguir una receta visible para armar el pedido
    const recipesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/recipes?select=id,sale_price&visible=eq.true&is_archived=eq.false&limit=1`,
      { headers: authHeaders(ANON_KEY!) }
    )
    const recipes = await recipesRes.json()
    test.skip(!Array.isArray(recipes) || recipes.length === 0, 'Sin recetas visibles en la DB de staging')
    const recipe = recipes[0]

    // 2. Pedido con envio + direccion + costo
    const customerName = `e2e-${Date.now()}`
    const DELIVERY_COST = 1500
    const ADDRESS = 'Calle Falsa 123 - Piso/Depto: 4B - porton negro'

    const submitRes = await fetch(`${SUPABASE_URL}/functions/v1/submit-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(ANON_KEY!) },
      body: JSON.stringify({
        customer: customerName,
        phone: '1155001100',
        delivery: 'envio',
        payment: 'efectivo',
        address: ADDRESS,
        delivery_cost: DELIVERY_COST,
        items: [{ recipeId: recipe.id, qty: 1 }],
      }),
    })
    const submitJson = await submitRes.json()
    expect(submitRes.ok, `submit-order fallo: ${JSON.stringify(submitJson)}`).toBe(true)
    expect(submitJson.ok).toBe(true)
    expect(submitJson.orderId).toBeTruthy()

    // 3. El response debe reflejar el costo de envio
    expect(submitJson.delivery_cost).toBe(DELIVERY_COST)

    // 4. Verificar la fila persistida (service role bypasea RLS)
    const orderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${submitJson.orderId}&select=delivery_address,delivery_cost,total,delivery`,
      { headers: authHeaders(SERVICE_ROLE!) }
    )
    const rows = await orderRes.json()
    expect(rows.length).toBe(1)
    const order = rows[0]

    expect(order.delivery).toBe('envio')
    expect(order.delivery_address).toBe(ADDRESS)
    expect(Number(order.delivery_cost)).toBe(DELIVERY_COST)
    // total = precio receta + envio (sin cupon ni propina en este test)
    expect(Number(order.total)).toBe(Number(recipe.sale_price) + DELIVERY_COST)
  })

  test('pedido retiro NO cobra envio aunque el cliente lo mande (clamp server-side)', async () => {
    test.skip(!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE, 'Faltan env vars E2E_SUPABASE_*')

    const recipesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/recipes?select=id,sale_price&visible=eq.true&is_archived=eq.false&limit=1`,
      { headers: authHeaders(ANON_KEY!) }
    )
    const recipes = await recipesRes.json()
    test.skip(!Array.isArray(recipes) || recipes.length === 0, 'Sin recetas visibles')
    const recipe = recipes[0]

    const submitRes = await fetch(`${SUPABASE_URL}/functions/v1/submit-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(ANON_KEY!) },
      body: JSON.stringify({
        customer: `e2e-${Date.now()}`,
        phone: '1155001100',
        delivery: 'retiro',
        payment: 'efectivo',
        delivery_cost: 99999, // intento de manipulacion: retiro no lleva envio
        items: [{ recipeId: recipe.id, qty: 1 }],
      }),
    })
    const submitJson = await submitRes.json()
    expect(submitJson.ok).toBe(true)
    expect(submitJson.delivery_cost).toBe(0)

    const orderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${submitJson.orderId}&select=delivery_cost,total`,
      { headers: authHeaders(SERVICE_ROLE!) }
    )
    const rows = await orderRes.json()
    expect(Number(rows[0].delivery_cost)).toBe(0)
    expect(Number(rows[0].total)).toBe(Number(recipe.sale_price))
  })
})
