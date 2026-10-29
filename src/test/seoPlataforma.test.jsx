// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { crearHtmlPlataforma, plataformaSeoPlugin } from '../../scripts/seo-platform.mjs';
import { SEO_PLATAFORMA } from '../lib/seoPlataforma';
import { supabase as datosProhibidos } from '../seo/sinDatosVisitante';

const base = `<!doctype html><html lang="es"><head><title>Dico</title><meta name="description" content="Base"><meta property="og:title" content="Base"><meta property="og:description" content="Base"></head><body><script>/* tema por host */</script><div id="root"><div>Abriendo la tienda</div><style>/* loader */</style></div><script type="module" src="/assets/app.js"></script></body></html>`;
const contenido = '<main><h1>Tu tiempo vuelve a ser tuyo.</h1><h2>Tu rubro, tu forma de trabajar.</h2><a href="/registro">Registrá tu negocio</a></main>';

describe('SEO de la plataforma sin mezclar tenants', () => {
  it('impide consultas a datos durante el prerender', () => {
    expect(() => datosProhibidos.functions).toThrow('no puede consultar datos');
  });
  it('entrega texto real, canonical, datos validos y el mismo arranque interactivo', () => {
    const html = crearHtmlPlataforma(base, contenido);
    expect(html).toContain(contenido);
    expect(html).not.toContain('Abriendo la tienda');
    expect(html).toContain('<script>/* tema por host */</script>');
    expect(html).toContain('<script type="module" src="/assets/app.js"></script>');
    expect(html).toContain(`<link rel="canonical" href="${SEO_PLATAFORMA.url}">`);
    expect(html).toContain('index,follow,max-image-preview:large');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    const datos = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    expect(datos['@graph'].map(nodo => nodo['@type'])).toEqual(['Organization', 'WebSite', 'SoftwareApplication']);
    expect(JSON.stringify(datos)).not.toMatch(/Restaurant|aggregateRating|reviewCount/);
  });
  it('solo enruta el dominio principal al HTML prerenderizado, sin discriminar bots', () => {
    const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url)));
    const regla = config.rewrites.find(r => r.destination === '/plataforma.html');
    expect(regla.source).toBe('/');
    expect(regla.has).toEqual([{ type: 'host', value: 'divianco.app' }]);
    expect(config.rewrites.at(-1).destination).toBe('/index.html');
    expect(JSON.stringify(regla)).not.toMatch(/user-agent|Googlebot/);
  });
  it('no genera la landing para el fixture de otro cliente', async () => {
    const emitFile = vi.fn();
    await plataformaSeoPlugin({ client: 'dico-qa-lite', buildId: 'abc12345' }).generateBundle.call({ emitFile }, {}, {});
    expect(emitFile).not.toHaveBeenCalled();
  });
  it('permite descubrir la home pero no anuncia formularios como paginas indexables', () => {
    const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8');
    const sitemap = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://divianco.app/sitemap.xml');
    expect(sitemap).toContain('<loc>https://divianco.app/</loc>');
    expect(sitemap).not.toMatch(/registro|consola|entrar/);
  });
});
