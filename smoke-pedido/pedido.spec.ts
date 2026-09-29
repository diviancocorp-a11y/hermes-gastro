// Smoke del PEDIDO contra PRODUCCION: pedir, seguir y arrepentirse.
//
// A diferencia de smoke/edificio.spec.ts, este ESCRIBE: crea un pedido real en
// el negocio de SMOKE_PEDIDO_SLUG y lo cancela. Por eso vive aparte y corre
// solo a mano (workflow smoke-pedido, workflow_dispatch): nunca en cada deploy.
//
// Recorre lo que hace un comprador sin cuenta, por los mismos caminos:
//   1. abre el catalogo publicado y toma de SU request a get_catalog la URL de
//      Supabase y la publishable key (no hay secretos: son publicas).
//   2. pide el primer producto por submit-order.
//   3. abre /order/<id> y ve "Pedido recibido" con el boton de arrepentimiento.
//   4. cancela desde la pantalla (cancel-order) y ve "Pedido cancelado".
//   5. confirma por get_order_tracker que quedo `cancelled`, y que con el slug
//      de otro negocio el mismo uuid no devuelve nada.
//
// Queda un pedido cancelado a nombre de "Smoke Test". No se borra desde aca:
// anon no puede borrar pedidos, y darle la service role a un smoke es peor que
// una fila cancelada. Se identifica por el nombre y el telefono de abajo.
import { test, expect } from '@playwright/test'

const RAIZ = process.env.SMOKE_RAIZ || 'divianco.app'
const SLUG = (process.env.SMOKE_PEDIDO_SLUG || '').trim()
const OTRO_SLUG = (process.env.SMOKE_PEDIDO_OTRO_SLUG || '').trim()

export const CLIENTE = 'Smoke Test'
export const TELEFONO = '5490000000000'

test('pedir, seguir y cancelar dentro del minuto', async ({ page }) => {
  test.skip(!SLUG, 'SMOKE_PEDIDO_SLUG vacio: no hay negocio donde pedir')
  test.setTimeout(90_000)

  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(e.message))

  // 1. El catalogo publicado: de su propio request salen URL y key.
  const pedidoCatalogo = page.waitForRequest((r) => (
    r.url().includes('/rest/v1/rpc/get_catalog') && r.method() === 'POST'
  ))
  const respuestaCatalogo = page.waitForResponse((r) => r.url().includes('/rest/v1/rpc/get_catalog'))
  await page.goto(`https://${SLUG}.${RAIZ}/`)
  const req = await pedidoCatalogo
  const supabaseUrl = new URL(req.url()).origin
  const apikey = req.headers()['apikey']
  expect(apikey, 'el catalogo no mando apikey').toBeTruthy()
  const catalogo = await (await respuestaCatalogo).json()
  const producto = (catalogo?.products || [])[0]
  expect(producto, `${SLUG} no tiene productos activos para pedir`).toBeTruthy()

  const headers = { apikey, 'Content-Type': 'application/json' }

  // 2. El pedido, igual que el checkout.
  const alta = await page.request.post(`${supabaseUrl}/functions/v1/submit-order`, {
    headers,
    data: {
      tenant_slug: SLUG,
      customer: CLIENTE,
      phone: TELEFONO,
      delivery: 'retiro',
      payment: 'efectivo',
      note: 'smoke automatico: se cancela solo',
      items: [{ recipeId: producto.id, qty: 1 }],
      client_request_id: crypto.randomUUID(),
    },
  })
  const cuerpoAlta = await alta.json()
  expect(alta.status(), `submit-order: ${JSON.stringify(cuerpoAlta)}`).toBe(200)
  expect(cuerpoAlta.ok, JSON.stringify(cuerpoAlta)).toBe(true)
  const orderId: string = cuerpoAlta.orderId
  console.log(`pedido de smoke: ${orderId}`)

  // 3. El seguimiento, como lo abre el comprador.
  await page.goto(`https://${SLUG}.${RAIZ}/order/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Pedido recibido' })).toBeVisible()
  await expect(page.getByText(/👤 Smoke/)).toBeVisible()
  const arrepentirse = page.getByRole('button', { name: /Cancelar pedido/ })
  await expect(arrepentirse).toBeVisible()

  // 4. Arrepentirse desde la pantalla.
  const cancelacion = page.waitForResponse((r) => r.url().includes('/functions/v1/cancel-order'))
  await arrepentirse.click()
  const resCancel = await cancelacion
  expect(await resCancel.json(), 'cancel-order no confirmo').toEqual({ ok: true })
  await expect(page.getByRole('heading', { name: 'Pedido cancelado' })).toBeVisible()

  // 5. Lo que dice la base, por el mismo RPC publico.
  const tracker = async (slug: string) => {
    const r = await page.request.post(`${supabaseUrl}/rest/v1/rpc/get_order_tracker`, {
      headers, data: { p_tenant_slug: slug, p_order_id: orderId },
    })
    expect(r.status(), `get_order_tracker(${slug})`).toBe(200)
    return r.json()
  }
  expect((await tracker(SLUG))?.status).toBe('cancelled')
  if (OTRO_SLUG) expect(await tracker(OTRO_SLUG), 'el pedido se ve desde otro negocio').toBeNull()

  // Cancelar dos veces no hace nada (la regla vive en cancel_own_order).
  const otraVez = await page.request.post(`${supabaseUrl}/functions/v1/cancel-order`, {
    headers, data: { tenant_slug: SLUG, order_id: orderId },
  })
  expect(await otraVez.json()).toEqual({ ok: false })

  expect(errores, 'errores JS sin atrapar').toEqual([])
})
