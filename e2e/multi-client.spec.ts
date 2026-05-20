// Smoke test for multi-tenant: hit each deployed client URL and verify the
// HTML title + manifest reflect that client's branding (not "Hermes" generic
// and not another client's name). This is the cheapest end-to-end check that
// the per-client build pipeline (CLIENT env, business.js, manifest plugin)
// is working in production.
import { test, expect } from '@playwright/test'

const CLIENTS = [
  { name: 'mala-miga',    expectTitle: /Mala Miga/i,   expectManifestName: /Mala Miga/i },
  { name: 'cochi',        expectTitle: /Cochi/i,       expectManifestName: /Cochi/i },
  { name: 'la-nona-pato', expectTitle: /La Nona Pato/i, expectManifestName: /La Nona Pato/i },
]

for (const c of CLIENTS) {
  test(`${c.name}: title and manifest reflect client identity`, async ({ page, request }) => {
    const url = `https://${c.name}.vercel.app`
    await page.goto(url)
    await expect(page).toHaveTitle(c.expectTitle, { timeout: 15_000 })

    // Manifest is per-client (vite plugin renders it dynamically)
    const manifestRes = await request.get(`${url}/manifest.json`)
    expect(manifestRes.ok()).toBeTruthy()
    const manifest = await manifestRes.json()
    expect(manifest.name).toMatch(c.expectManifestName)
  })
}
