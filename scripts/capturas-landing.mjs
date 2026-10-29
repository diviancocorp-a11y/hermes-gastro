// Capturas de los componentes reales, con datos ficticios y sin acceso a la base.
// NODE_ENV= node scripts/capturas-landing.mjs
import { createServer as crearVite } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import { INSUMOS } from './pantalla/muestras.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(raiz, 'public/brand/landing/interfaz');
const resultado = {
  dia: '2026-10-23', ventas: 2168000, descuentos: 18000, costo_mercaderia: 645000,
  lineas_sin_costo: 0, tickets: 86, nomina: 387000, horas: 43, merma: 43000,
  gastos_del_dia: 96000, gastos_fijos: 310000, ganancia_neta: 669000,
};
const pedidos = ['new', 'preparing', 'active', 'completed'].map((status, i) => ({
  id: `ejemplo-${i}`, status, customer_name: ['Pedido #1048', 'Pedido #1047', 'Pedido #1046', 'Pedido #1045'][i],
  total: [24000, 18500, 32000, 12000][i], created_at: '2026-10-23T22:10:00Z',
  delivery: i % 2 ? 'takeaway' : 'envio', payment: 'Transferencia',
}));
const muestras = [
  ['pedidos', 'OrdersPanel', { orders: pedidos, loading: false }],
  ['stock', 'StockPanel', { tenantId: 'ejemplo', insumos: INSUMOS.slice(0, 6), seleccionadoInicial: '1' }],
  ['resultado', 'ResultadoDelDia', { sucursal: { id: 'ejemplo', name: 'Casa central', timezone: 'America/Argentina/Buenos_Aires' }, resultadoInicial: resultado }],
];
const hojas = ['machine-soul', 'admin-tokens', 'admin-shared', 'admin-stock', 'admin-resultado', 'admin-sidebar'];
const css = (await Promise.all(hojas.map(n => readFile(path.join(raiz, `src/styles/${n}.css`), 'utf8'))))
  .join('\n').replace(/@import[^;]+;/g, '');
const vite = await crearVite({
  configFile: false, root: raiz, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom',
  resolve: { alias: { '@dico/core': path.join(raiz, 'src'), '@business': path.join(raiz, 'clients/dico-qa-lite/business.js') } },
  plugins: [{ name: 'sin-base', enforce: 'pre', resolveId(id) {
    return /(^|[/\\])supabase(\.js)?$/.test(id) ? path.join(raiz, 'scripts/pantalla/supabase-doble.mjs') : null;
  } }],
  define: { __CLIENT__: '"preview"', __BUILD_ID__: '"captura-landing"' },
});
let html = '';
const servidor = createServer(async (req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
  if (req.url === '/fuente.woff2') {
    res.setHeader('Content-Type', 'font/woff2');
    res.end(await readFile(path.join(raiz, 'public/fonts/dico/overused-grotesk/OverusedGrotesk-VF.woff2'))); return;
  }
  res.writeHead(404).end();
});
let navegador;
try {
  await mkdir(salida, { recursive: true });
  await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve));
  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 960, height: 700 }, deviceScaleFactor: 2 });
  for (const [nombre, modulo, props] of muestras) {
    const componente = await vite.ssrLoadModule(`/src/components/admin/platform/${modulo}.jsx`);
    html = `<!doctype html><html lang="es"><meta charset="utf-8"><style>${css}
      @font-face{font-family:'Overused Grotesk';src:url('/fuente.woff2') format('woff2');font-weight:300 900}
      *{box-sizing:border-box}html,body{margin:0}body{background:var(--ag-bg);color:var(--ag-ink);font-family:var(--ag-font)}
      #captura{padding:20px;min-height:700px}.ag-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
      </style><body class="ag-root ag-theme-dark"><div id="captura">${renderToStaticMarkup(createElement(componente.default, props))}</div></body></html>`;
    await pagina.goto(`http://127.0.0.1:${servidor.address().port}`);
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.locator('#captura').screenshot({ path: path.join(salida, `${nombre}.png`) });
    console.log(`${nombre}: componente ${modulo}, captura generada`);
  }
} finally {
  await navegador?.close();
  servidor.close();
  await vite.close();
}
