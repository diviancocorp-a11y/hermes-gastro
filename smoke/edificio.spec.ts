// smoke/edificio.spec.ts
//
// Smoke del EDIFICIO: abre produccion como la abre un cliente.
//
// ── POR QUE EXISTE ──
// Hasta el 27/sep ningun E2E tocaba <slug>.divianco.app. Los specs viejos le
// pegaban a los deploys legacy (mala-miga.vercel.app...), que dan 404, y tenian
// la suite en rojo desde mayo. morning-health mira el edificio por HTTP y por
// RPC, pero no con un navegador: un bundle que rompe al renderizar le pasa por
// al lado, porque el HTML y el RPC siguen respondiendo 200.
//
// ── QUE MIRA ──
//   - la landing de divianco.app renderiza
//   - el catalogo de cada negocio real: su get_catalog (el que pide la pagina)
//     responde con productos, el titulo es el biz_name de ESE negocio, el tema
//     salio de los settings reales y hay al menos un producto a la vista
//   - que las fotos de esos productos respondan (test aparte)
//   - con credenciales, el panel de un negocio de prueba: login y panel
//   - en todos, que no haya errores JS sin atrapar
//
// ── QUE NO HACE ──
// No crea pedidos ni escribe nada: es produccion. Tampoco prueba el codigo de
// un PR: mira lo publicado. Por eso corre despues de cada deploy y no en los
// PRs (ver .github/workflows/smoke-edificio.yml).
//
// ── USO ──
//   SMOKE_TENANTS=cochi,mala-miga npm run test:smoke
//
// SMOKE_TENANTS no tiene default: en CI sale de la variable del repo del mismo
// nombre. Sin negocios, los tests de catalogo se saltean con aviso y quedan la
// landing y el admin.
//
// El admin necesita SMOKE_ADMIN_SLUG + SMOKE_ADMIN_EMAIL + SMOKE_ADMIN_PASSWORD
// (un usuario de prueba, nunca uno real). Sin ellas ese test se saltea.

import { test, expect, devices, type Page } from '@playwright/test'

const RAIZ = process.env.SMOKE_RAIZ || 'divianco.app'

// Negocios reales andando: un demo que se cae no le importa a ningun cliente.
// Sin default a proposito: el 27/sep se vaciaron los tenants para rehacer la
// carga, y una lista fija de slugs que no existen deja el smoke en rojo en
// cada deploy (el mismo vicio que tuvo E2E cinco meses).
const TENANTS = (process.env.SMOKE_TENANTS || '')
  .split(',').map((s) => s.trim()).filter(Boolean)

const ADMIN_SLUG = process.env.SMOKE_ADMIN_SLUG
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD

function escaparRegex(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Errores JS que nadie atrapo. Es la senal que morning-health no puede ver:
 * la pagina responde 200 y aun asi el cliente ve una pantalla rota.
 */
function juntarErrores(page: Page) {
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(e.message))
  return errores
}

test('landing: divianco.app renderiza', async ({ page }) => {
  const errores = juntarErrores(page)
  const res = await page.goto(`https://${RAIZ}/`)
  expect(res?.status(), 'la landing no respondio 200').toBe(200)
  await expect(page.locator('h1.pl-titular')).toBeVisible()
  await expect(page.locator('a[href="/registro"]').first()).toBeVisible()
  expect(errores, 'errores JS sin atrapar en la landing').toEqual([])
})

/**
 * Abre el catalogo de `slug` y devuelve lo que la PROPIA pagina recibio de
 * get_catalog. Se usa la respuesta real y no una consulta aparte: asi se
 * compara lo que se ve contra lo que la app recibio, sin credenciales.
 */
async function abrirCatalogo(page: Page, slug: string) {
  const respuesta = page.waitForResponse((r) => (
    r.url().includes('/rest/v1/rpc/get_catalog')
    && r.request().method() === 'POST'
    && (r.request().postData() || '').includes(slug)
  ))
  await page.goto(`https://${slug}.${RAIZ}/`)
  const res = await respuesta
  expect(res.status(), 'get_catalog no respondio 200').toBe(200)
  return res.json()
}

test.describe('catalogo', () => {
  // El catalogo se usa desde el telefono: se mira como se ve ahi. Sin
  // `defaultBrowserType`, que no se puede cambiar dentro de un describe.
  const { defaultBrowserType: _navegador, ...telefono } = devices['Pixel 7']
  test.use(telefono)

  test('hay negocios que mirar', () => {
    test.skip(
      TENANTS.length === 0,
      'SMOKE_TENANTS vacio: no se mira ningun catalogo (variable del repo, ver docs/plataforma/TESTING.md)',
    )
  })

  for (const slug of TENANTS) {
    test(`${slug}: muestra su negocio y sus productos`, async ({ page }) => {
      const errores = juntarErrores(page)
      const data = await abrirCatalogo(page, slug)
      const nombre: string = data?.settings?.biz_name
      const productos = Array.isArray(data?.products) ? data.products.length : 0
      expect(nombre, 'get_catalog sin biz_name: el slug no resolvio a un negocio').toBeTruthy()
      expect(productos, 'catalogo vacio: el cliente ve el local cerrado').toBeGreaterThan(0)

      // El tema salio de los settings REALES y no del fallback (tenantHead.js).
      await expect(page.locator('body')).toHaveAttribute('data-cp-theme-listo', '1')
      // El negocio correcto: el titulo es el biz_name de ESTE slug, no 'Dico'
      // ni el de otro tenant.
      await expect(page).toHaveTitle(new RegExp(`^${escaparRegex(nombre)}`))
      // Un producto a la vista, por su boton y no por una clase de CSS: es lo
      // que toca el cliente para pedir.
      await expect(
        page.getByRole('button', { name: /Agregar al carrito|Producto agotado/ }).first(),
      ).toBeVisible()

      expect(errores, 'errores JS sin atrapar en el catalogo').toEqual([])
    })

    // Aparte del anterior a proposito: una foto rota no es un catalogo caido, y
    // mezclados no se sabria cual de los dos fallo.
    //
    // Por que existe: al armar este smoke (27/sep) las fotos de mala-miga y de
    // cochi apuntaban al Storage de sus proyectos Supabase legacy, no al
    // edificio. El HTML, el RPC y el catalogo responden bien; lo que se rompe
    // es lo que ve el cliente.
    test(`${slug}: las fotos de sus productos responden`, async ({ page }) => {
      const data = await abrirCatalogo(page, slug)
      const urls = [...new Set(
        (Array.isArray(data?.products) ? data.products : [])
          .map((p: { image_url?: string | null }) => p?.image_url)
          .filter((u: unknown): u is string => typeof u === 'string' && u.length > 0),
      )] as string[]
      test.skip(urls.length === 0, 'ningun producto tiene foto')

      const rotas: string[] = []
      for (const url of urls) {
        const r = await page.request.get(url, { failOnStatusCode: false }).catch(() => null)
        const tipo = r?.headers()['content-type'] || ''
        if (!r || !r.ok() || !tipo.startsWith('image/')) {
          rotas.push(`${r ? r.status() : 'sin respuesta'} ${new URL(url).host}${new URL(url).pathname}`)
        }
      }
      expect(rotas, `${rotas.length} de ${urls.length} fotos no cargan`).toEqual([])
    })
  }
})

test('admin: el negocio de prueba entra a su panel', async ({ page }) => {
  test.skip(
    !ADMIN_SLUG || !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'Faltan SMOKE_ADMIN_SLUG / SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD (ver docs/plataforma/TESTING.md)',
  )
  const errores = juntarErrores(page)

  await page.goto(`https://${ADMIN_SLUG}.${RAIZ}/admin`)
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL!)
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD!)
  await page.locator('button[type="submit"]').click()

  // La raiz del panel del edificio (PlatformAdmin). Solo aparece logueado.
  await expect(page.locator('.ag-root--con-sidebar')).toBeVisible()
  expect(errores, 'errores JS sin atrapar en el panel').toEqual([])
})
