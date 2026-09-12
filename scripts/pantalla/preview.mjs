#!/usr/bin/env node
// scripts/pantalla/preview.mjs
//
// Arma un HTML con una pantalla del panel, a los anchos que de verdad cambian
// su layout, sin levantar la app ni tocar la base.
//
//   npm run pantalla -- stock
//   npm run pantalla -- stock conteo
//   npm run pantalla            (todas las muestras declaradas)
//
// POR QUE EXISTE
// Al rehacer Stock, la pantalla se armo a mano tres veces y se tiro. De
// mirarla salieron tres defectos que ni los tests ni el build habian visto: un
// "180% del minimo" sin topear, la etiqueta del buscador saliendo como titulo
// —la clase de solo-lectores de este sistema es `ag-sr-only`, no `sr-only`— y
// un nombre de insumo cortado justo en la pantalla donde hay que saber que se
// esta contando. Ninguno de los tres rompe un test: los tres se ven de una.
//
// LOS DOS CUIDADOS QUE COSTARON TIEMPO
//
// 1. `machine-soul.css` va PRIMERO y sin `@import`. Concatenados en un
//    <style>, un `@import` a mitad de hoja es invalido: los `--ms-*` no cargan
//    y como todos los `--ag-*` los referencian, quedan vacios. La pantalla
//    sale en blanco, sin superficies, y parece un problema de la pantalla.
//
// 2. Cada ancho va en su propio iframe. Los media queries miran el VIEWPORT,
//    no el contenedor: un div de 390px dentro de una ventana de 1400 sigue
//    viendo 1400 y muestra el layout de escritorio encogido, que es
//    exactamente lo que no se queria revisar.

import { createServer } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MUESTRAS } from './muestras.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SALIDA = path.join(RAIZ, '.preview');

// El orden importa: primitivas, tokens, compartidos y al final los de pantalla.
const CSS_BASE = [
  'src/styles/machine-soul.css',
  'src/styles/admin-tokens.css',
  'src/styles/admin-shared.css',
];

const CSS_PANTALLAS = [
  'src/styles/admin-stock.css',
  'src/styles/admin-productos.css',
  'src/styles/admin-caja.css',
  'src/styles/admin-salon.css',
  'src/styles/admin-kds.css',
];

function hojas() {
  return [...CSS_BASE, ...CSS_PANTALLAS]
    .map((f) => {
      try {
        // Ver el cuidado 1 del encabezado: los @import se resuelven aplanando
        // la lista a mano, no dejandolos en el texto.
        return readFileSync(path.join(RAIZ, f), 'utf8').replace(/@import[^;]+;/g, '');
      } catch {
        return '';
      }
    })
    .join('\n\n');
}

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function documento(css, cuerpo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>${css}</style>
<style>
  html, body { margin: 0; background: var(--ag-bg); color: var(--ag-ink);
               font-family: var(--ag-font, system-ui); }
  .caja { padding: 20px; }
</style></head>
<body class="ag-root ag-theme-dark"><div class="caja">${cuerpo}</div></body></html>`;
}

/**
 * Las props que el componente espera y la muestra no declara. Sin esto, un
 * `onClick={onAlgo}` con `onAlgo` undefined deja el boton muerto y parece que
 * la pantalla no lo tiene.
 */
function conCallbacks(props, nombresDeProps) {
  const completas = { ...props };
  for (const n of nombresDeProps) {
    if (n.startsWith('on') && !(n in completas)) completas[n] = () => {};
  }
  return completas;
}

/** Los nombres de prop que el componente desestructura en su firma. */
function propsQueUsa(codigo) {
  const m = codigo.match(/export default function \w+\(\s*\{([^}]*)\}/s);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((p) => p.split('=')[0].trim())
    .filter(Boolean);
}

async function main() {
  const pedidas = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const nombres = pedidas.length ? pedidas : Object.keys(MUESTRAS);

  const desconocidas = nombres.filter((n) => !MUESTRAS[n]);
  if (desconocidas.length) {
    console.error(`✗ no conozco: ${desconocidas.join(', ')}`);
    console.error(`  declaradas: ${Object.keys(MUESTRAS).join(', ')}`);
    console.error('  se agregan en scripts/pantalla/muestras.mjs');
    process.exit(1);
  }

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement } = await import('react');

  const vite = await createServer({
    configFile: false,
    root: RAIZ,
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
    resolve: {
      alias: {
        '@dico/core': path.join(RAIZ, 'src'),
        // Lo usa el catalogo legacy. No lo toca ninguna pantalla del edificio,
        // pero sin el alias el escaneo de dependencias tira un error rojo que
        // parece del preview y no lo es.
        '@business': path.join(RAIZ, 'clients/dico-qa-lite/business.js'),
      },
    },
    plugins: [{
      // El doble de supabase. Va como plugin y NO como alias: el specifier
      // cambia con la profundidad del import —'../lib/supabase' desde un
      // servicio, '../../../lib/supabase' desde un componente— y un alias por
      // ruta no matchea ninguno de los dos. Intercepta cualquier forma, que es
      // lo que hace falta para que ni el servicio mas abajo abra un cliente.
      name: 'dico-doble-supabase',
      enforce: 'pre',
      resolveId(id) {
        if (/(^|[/\\])lib[/\\]supabase(\.js)?$/.test(id)) {
          return path.join(RAIZ, 'scripts/pantalla/supabase-doble.mjs');
        }
        return null;
      },
    }],
    define: { __CLIENT__: '"preview"', __BUILD_ID__: '"preview"' },
  });

  const css = hojas();
  mkdirSync(SALIDA, { recursive: true });

  const secciones = [];
  for (const nombre of nombres) {
    const m = MUESTRAS[nombre];
    const mod = await vite.ssrLoadModule('/' + m.modulo);
    const Componente = mod.default;
    const codigo = readFileSync(path.join(RAIZ, m.modulo), 'utf8');
    const props = conCallbacks(m.props, propsQueUsa(codigo));

    // renderToStaticMarkup no corre efectos. Es lo que se quiere: el preview
    // muestra el primer pintado, que es lo que ve el usuario antes de que
    // llegue cualquier dato asincrono.
    const html = renderToStaticMarkup(createElement(Componente, props));

    for (const ancho of m.anchos) {
      const alto = ancho <= 480 ? 900 : 1150;
      secciones.push(`
  <p class="rotulo">${m.titulo} · ${ancho} px</p>
  <div class="visor" style="--ancho:${ancho}px">
    <iframe title="${escapar(m.titulo)} ${ancho}" width="${ancho}" height="${alto}"
            srcdoc="${escapar(documento(css, html))}"></iframe>
  </div>`);
    }
    console.log(`  ✓ ${nombre}  (${m.anchos.join(', ')} px)`);
  }

  await vite.close();

  const destino = path.join(SALIDA, 'pantallas.html');
  writeFileSync(destino, `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pantallas · vista previa</title>
<style>
  html, body { margin: 0; background: #09090B; color: #E4E4E7;
               font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .rotulo { font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
            color: #A1A1AA; padding: 30px 24px 10px; margin: 0; }
  .visor { padding: 0 24px 36px; }
  /* El iframe se dibuja al ancho declarado y se escala si no entra: asi los
     media queries ven el ancho real aunque la ventana sea mas chica. */
  iframe { border: 1px solid #27272A; border-radius: 10px; background: #09090B;
           display: block; transform-origin: 0 0;
           transform: scale(min(1, calc((100vw - 48px) / var(--ancho)))); }
</style></head>
<body>${secciones.join('\n')}
</body></html>`, 'utf8');

  console.log(`\n→ ${path.relative(RAIZ, destino)}`);
  console.log('  abrilo en Chrome: el panel de preview interno lo achica.');
}

main().catch((e) => { console.error(e); process.exit(1); });
