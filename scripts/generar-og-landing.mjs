#!/usr/bin/env node
// Genera la imagen de vista previa (og:image) de la raiz divianco.app:
// public/brand/og/dico.png, 1200x630. Va fuera de public/brand/dico/ porque
// esa carpeta es solo de los siete assets del personaje (dicoIdentidad.test).
// Si se regenera, subir OG_VERSION en api/og.js: WhatsApp y Facebook cachean
// la imagen por URL.
//
// Uso:
//   NODE_ENV= node scripts/generar-og-landing.mjs
//   (si falta el navegador: NODE_ENV= npx playwright install chromium)
//
// Como funciona: arma un HTML en memoria que carga los MISMOS estilos que la
// landing (dico-tokens.css, dico-fonts.css y platform-landing.css) y reusa sus
// clases (.pl-root, .pl-hero, .pl-titular, .pl-pill). Asi la imagen hereda la
// paleta y las fuentes de la pagina y no hay un solo color escrito aca: si la
// landing cambia de tono, se corre de nuevo y la imagen la sigue.
//
// Los archivos se sirven desde el repo con page.route sobre un origen falso,
// sin levantar Vite y sin escribir temporales. Antes de capturar se exige que
// Overused Grotesk y Butler esten cargadas de verdad: si una fuente no carga,
// Chromium cae a una del sistema sin avisar y la imagen sale mal en silencio.

import { chromium } from '@playwright/test'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SALIDA = path.join(RAIZ, 'public', 'brand', 'og', 'dico.png')
const ORIGEN = 'https://og.dico.local'
const ANCHO = 1200
const ALTO = 630

// Lo que el origen falso sabe servir: prefijo de URL -> carpeta del repo.
const RUTAS = [
  ['/fonts/', path.join(RAIZ, 'public', 'fonts')],
  ['/brand/', path.join(RAIZ, 'public', 'brand')],
  ['/styles/', path.join(RAIZ, 'src', 'styles')],
]

// Solo medidas y composicion. Los colores salen todos de los tokens --pl-* y
// --ds-* que ya define la landing. Zona segura: 60px o mas por lado, y lo
// esencial centrado. Si WhatsApp recorta a un cuadrado del medio (630px), el
// logo y la pastilla entran pero las puntas del titular no: se eligio la
// vista apaisada, que es donde el titular se lee.
const CSS_OG = `
  html, body { margin: 0; }
  body { width: ${ANCHO}px; height: ${ALTO}px; overflow: hidden; background: var(--ds-color-zinc-950); color: var(--ds-color-zinc-50); }
  .og.pl-root { min-height: 0; height: ${ALTO}px; }
  .og .pl-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    height: ${ALTO}px;
    padding: 60px;
  }
  .og-logo { display: block; height: 92px; width: auto; }
  .og .pl-titular {
    margin: 44px 0 0;
    max-width: none;
    font-size: 84px;
    line-height: 1.08;
    gap: 6px;
  }
  .og .pl-pill {
    margin-top: 44px;
    padding: 12px 26px;
    font-size: 26px;
  }
  .og .pl-pill-dot { width: 11px; height: 11px; margin-right: 12px; }
`

const HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="/styles/dico-tokens.css" />
  <link rel="stylesheet" href="/styles/dico-fonts.css" />
  <link rel="stylesheet" href="/styles/platform-landing.css" />
  <style>${CSS_OG}</style>
</head>
<body>
  <div class="pl-root og">
    <section class="pl-hero">
      <img class="og-logo" src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" />
      <h1 class="pl-titular">
        <span class="pl-titular-fijo">Tu tiempo vuelve</span>
        <span class="pl-titular-alma pl-serif">a ser tuyo.</span>
      </h1>
      <p class="pl-pill"><span class="pl-pill-dot"></span>Gastronomía, comercios y servicios · divianco.app</p>
    </section>
  </div>
</body>
</html>`

// Caras que tienen que quedar cargadas: familia + peso tal como las declara
// dico-fonts.css. JetBrains Mono no va: la imagen no tiene datos tecnicos.
const CARAS = [
  { familia: 'Overused Grotesk', muestra: '600 84px "Overused Grotesk"' },
  { familia: 'Butler', peso: '400', muestra: '400 89px "Butler"' },
]

async function servir(route) {
  const url = new URL(route.request().url())
  if (url.pathname === '/' || url.pathname === '/og.html') {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML })
  }
  const ruta = RUTAS.find(([prefijo]) => url.pathname.startsWith(prefijo))
  if (!ruta) return route.fulfill({ status: 404, body: 'no servido' })
  const archivo = path.join(ruta[1], decodeURIComponent(url.pathname.slice(ruta[0].length)))
  // Nada fuera de las carpetas declaradas.
  if (!archivo.startsWith(ruta[1] + path.sep)) return route.fulfill({ status: 403, body: 'fuera de raiz' })
  try {
    await stat(archivo)
    return await route.fulfill({ status: 200, path: archivo })
  } catch {
    return route.fulfill({ status: 404, body: 'no existe' })
  }
}

async function main() {
  const navegador = await chromium.launch(process.env.OG_BROWSER_CHANNEL ? { channel: process.env.OG_BROWSER_CHANNEL } : {})
  try {
    const pagina = await navegador.newPage({
      viewport: { width: ANCHO, height: ALTO },
      deviceScaleFactor: 1,
    })
    const fallidos = []
    pagina.on('requestfailed', (r) => fallidos.push(r.url()))
    pagina.on('response', (r) => { if (r.status() >= 400) fallidos.push(`${r.status()} ${r.url()}`) })

    await pagina.route(`${ORIGEN}/**`, servir)
    await pagina.goto(`${ORIGEN}/og.html`, { waitUntil: 'networkidle' })

    // Fuerza la carga de cada cara con el texto real y despues mira el estado
    // de cada FontFace: document.fonts.check() da true tambien cuando ninguna
    // cara coincide, asi que no sirve para detectar el fallback.
    const estado = await pagina.evaluate(async (caras) => {
      const d = globalThis.document
      const texto = 'Tu tiempo vuelve a ser tuyo. Gestión para gastronomía · divianco.app'
      for (const c of caras) await d.fonts.load(c.muestra, texto)
      await d.fonts.ready
      const todas = [...d.fonts].map((f) => ({
        familia: f.family.replace(/["']/g, ''),
        peso: f.weight,
        estado: f.status,
      }))
      const img = d.querySelector('.og-logo')
      return {
        todas,
        logo: Boolean(img && img.complete && img.naturalWidth > 0),
        desborde: d.documentElement.scrollWidth > globalThis.innerWidth
          || d.documentElement.scrollHeight > globalThis.innerHeight,
      }
    }, CARAS)

    const faltan = CARAS.filter((c) => !estado.todas.some(
      (f) => f.familia === c.familia && (!c.peso || f.peso === c.peso) && f.estado === 'loaded',
    ))
    if (fallidos.length) throw new Error(`Recursos que no cargaron:\n  ${fallidos.join('\n  ')}`)
    if (faltan.length) {
      throw new Error(`Fuente de marca sin cargar: ${faltan.map((c) => c.familia).join(', ')}\n`
        + JSON.stringify(estado.todas, null, 2))
    }
    if (!estado.logo) throw new Error('El logo no cargo.')
    if (estado.desborde) throw new Error('El contenido se sale de 1200x630.')

    const png = await pagina.screenshot({ type: 'png', clip: { x: 0, y: 0, width: ANCHO, height: ALTO } })
    await writeFile(SALIDA, png)

    const { size } = await stat(SALIDA)
    const cabecera = await readFile(SALIDA)
    const ancho = cabecera.readUInt32BE(16)
    const alto = cabecera.readUInt32BE(20)
    console.log('Fuentes cargadas:')
    for (const f of estado.todas.filter((x) => x.estado === 'loaded')) {
      console.log(`  ${f.familia} ${f.peso}`)
    }
    console.log(`OK ${path.relative(RAIZ, SALIDA)} ${ancho}x${alto} ${(size / 1024).toFixed(1)} KB`)
    if (size > 250 * 1024) console.warn('Aviso: pesa mas de 250 KB; WhatsApp puede descartarla.')
  } finally {
    await navegador.close()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
