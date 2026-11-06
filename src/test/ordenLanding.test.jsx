// @vitest-environment node
// Orden de las secciones de la landing y sus anclas. La navegacion fija, el
// pie y links de afuera apuntan a estos ids: si un reordenamiento pierde uno,
// el link cae arriba de la pagina sin que nada avise. Si el orden cambia a
// proposito, se cambia ORDEN aca.
import { describe, expect, it } from 'vitest';
import { renderLanding } from '../seo/renderLanding';

const ORDEN = ['negocios', 'que-es', 'rubros', 'como-empezar', 'machine-soul', 'precios', 'preguntas', 'contacto'];
// Alias de la landing vieja (ver PlatformLanding.jsx): siguen existiendo.
const ALIAS = ['que-hace', 'pilares', 'flujo', 'modulos', 'integraciones', 'seguridad', 'contacto'];

const html = renderLanding();
const posicion = id => html.indexOf(`id="${id}"`);

describe('orden y anclas de la landing', () => {
  it('las secciones van en el orden declarado', () => {
    const posiciones = ORDEN.map(posicion);
    expect(posiciones.every(p => p >= 0), `falta alguna: ${ORDEN.filter(id => posicion(id) < 0)}`).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  it('cada link interno apunta a un id que existe una sola vez', () => {
    const destinos = [...new Set([...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1]))];
    expect(destinos.length).toBeGreaterThan(0);
    for (const id of destinos) {
      expect(html.split(`id="${id}"`).length - 1, `#${id}`).toBe(1);
    }
  });

  it('los alias viejos siguen vivos', () => {
    for (const id of ALIAS) expect(posicion(id), `#${id}`).toBeGreaterThanOrEqual(0);
  });

  it('la navegacion fija lista las secciones en el orden de la pagina', () => {
    const nav = html.match(/<nav[^>]*class="nl-[^"]*"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const enNav = [...nav.matchAll(/href="#([^"]+)"/g)].map(m => m[1]).filter(id => ORDEN.includes(id));
    expect(enNav.length).toBeGreaterThan(0);
    expect(enNav).toEqual(ORDEN.filter(id => enNav.includes(id)));
  });

  it('el cierre conserva el titulo y el boton en el HTML de SEO', () => {
    expect(html).toContain('id="cf-titulo"');
    expect(html).toContain('Empezar mi diagnóstico');
  });
});
