import path from 'node:path';
import { SEO_PLATAFORMA, DATOS_ESTRUCTURADOS_PLATAFORMA } from '../src/lib/seoPlataforma.js';

const atributo = valor => String(valor).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function crearHtmlPlataforma(html, contenido) {
  if (!html.includes('<div id="root">') || !contenido.includes('Tu tiempo vuelve')) throw new Error('Falta la landing prerenderizada');
  const seo = SEO_PLATAFORMA;
  const tags = [
    `<link rel="canonical" href="${seo.url}">`,
    '<meta name="robots" content="index,follow,max-image-preview:large">',
    '<meta property="og:site_name" content="Dico">',
    `<meta property="og:url" content="${seo.url}">`,
    `<meta property="og:image" content="${seo.imagen}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${atributo(seo.imagenAlt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${atributo(seo.titulo)}">`,
    `<meta name="twitter:description" content="${atributo(seo.descripcion)}">`,
    `<meta name="twitter:image" content="${seo.imagen}">`,
    `<meta name="twitter:image:alt" content="${atributo(seo.imagenAlt)}">`,
    `<script type="application/ld+json">${JSON.stringify(DATOS_ESTRUCTURADOS_PLATAFORMA).replaceAll('<', '\\u003c')}</script>`,
  ].join('\n');
  const inicio = html.indexOf('<div id="root">');
  const fin = html.indexOf('</div>', html.indexOf('</style>', inicio));
  // El loader contiene un div anidado: delimitamos por el script de arranque,
  // conservando todos los scripts de tema que estan antes del root.
  const script = html.indexOf('<script type="module"', inicio);
  const cierreBody = html.indexOf('</body>', inicio);
  const despues = script >= 0 ? script : cierreBody;
  if (fin < 0 || despues < 0) throw new Error('No se pudo localizar el loader');
  return (html.slice(0, inicio) + `<div id="root">${contenido}</div>\n` + html.slice(despues))
    .replace(/<html lang="es">/, '<html lang="es-AR">')
    .replace(/<title>[^<]*<\/title>/, `<title>${atributo(seo.titulo)}</title>`)
    .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*/g, `$1${atributo(seo.descripcion)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${atributo(seo.titulo)}`)
    .replace('</head>', `${tags}\n</head>`);
}

export function plataformaSeoPlugin({ client, buildId }) {
  return {
    name: 'dico-platform-seo', apply: 'build', enforce: 'post',
    configurePreviewServer(server) {
      if (client !== 'edificio') return;
      server.middlewares.use((req, _res, next) => {
        if (req.headers.accept?.includes('text/html') && !path.extname((req.url || '').split('?')[0])) req.url = '/app.html';
        next();
      });
    },
    async generateBundle(_opciones, bundle) {
      if (client !== 'edificio') return;
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') throw new Error('Falta index.html para SEO');
      const { createServer } = await import('vite');
      const { default: react } = await import('@vitejs/plugin-react');
      const server = await createServer({ configFile: false, root: process.cwd(), mode: 'production', appType: 'custom', plugins: [react()], server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: [{ find: /^(?:.*\/)?supabase(?:\.js)?$/, replacement: path.resolve('src/seo/sinDatosVisitante.js') }, { find: '@business', replacement: path.resolve('clients/edificio/business.js') }, { find: '@dico/core', replacement: path.resolve('src') }] }, define: { __CLIENT__: JSON.stringify(client), __BUILD_ID__: JSON.stringify(buildId) } });
      try {
        const { renderLanding } = await server.ssrLoadModule('/src/seo/renderLanding.jsx');
        let contenido = renderLanding();
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset') continue;
          for (const original of asset.originalFileNames || []) contenido = contenido.replaceAll(`/${original}`, `/${asset.fileName}`);
        }
        if (/src="\/src\//.test(contenido)) throw new Error('Una imagen prerenderizada no tiene URL de produccion');
        this.emitFile({ type: 'asset', fileName: 'plataforma.html', source: crearHtmlPlataforma(String(index.source), contenido) });
        // Un index estatico gana a los rewrites de Vercel en /. Dejamos que
        // el hostname elija plataforma.html o el shell de los tenants.
        this.emitFile({ type: 'asset', fileName: 'app.html', source: index.source });
        delete bundle['index.html'];
      } finally { await server.close(); }
    },
  };
}
