/**
 * Lo que la landing deja de bajar al abrir (auditoria del 6/nov). Nada de esto
 * rompe un build si se pierde: el atlas de 2,4 MB vuelve a pedirse con la
 * pagina, el shader compila WebGL varias pantallas antes de verse, o el
 * celular vuelve a bajar las capas enteras del hero.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DICO_PET_PUBLIC_PATH } from '../../platform/brand/dico-pet-assets.mjs';

vi.mock('../components/landing/ShaderBackground', () => ({ default: () => <canvas data-testid="shader" /> }));

let observadores;
function stubObservador() {
  observadores = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback, opciones) { this.callback = callback; this.opciones = opciones; this.observados = []; observadores.push(this); }
    observe(el) { this.observados.push(el); }
    disconnect() { this.desconectado = true; }
  });
}
const acercar = (observador) => act(() => observador.callback([{ isIntersecting: true }]));

beforeEach(() => {
  vi.resetModules();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('el atlas de Dico se pide cuando se acerca', () => {
  const fondo = (contenedor) => contenedor.querySelector('.dico-pose-celda').style.backgroundImage;

  it('con diferir no lleva el atlas hasta que la caja entra en el margen', async () => {
    stubObservador();
    const { default: DicoPhysical } = await import('../components/dico/DicoPhysical');
    const { container } = render(createElement(DicoPhysical, { diferir: true, reducedMotion: true }));
    expect(fondo(container)).toBe('');
    const observador = observadores.find(o => o.observados.includes(container.querySelector('.dico-pose')));
    expect(observador.opciones.rootMargin).toBe('1600px 0px');
    acercar(observador);
    expect(fondo(container)).toContain(DICO_PET_PUBLIC_PATH);
    expect(observador.desconectado).toBe(true);
  });

  it('el prerender no escribe el atlas en el HTML de la landing', async () => {
    // jsdom tiene window: con el observador presente se comporta como el
    // navegador al montar; en el build (node, sin window) tambien arranca en no.
    stubObservador();
    const { default: DicoPhysical } = await import('../components/dico/DicoPhysical');
    expect(renderToStaticMarkup(createElement(DicoPhysical, { diferir: true, reducedMotion: true }))).not.toContain(DICO_PET_PUBLIC_PATH);
    expect(renderToStaticMarkup(createElement(DicoPhysical, { reducedMotion: true }))).toContain(DICO_PET_PUBLIC_PATH);
  });

  it('sin diferir (panel, flotante) lo pinta de entrada, y ya pedido no se vuelve a esperar', async () => {
    stubObservador();
    const { default: DicoPhysical } = await import('../components/dico/DicoPhysical');
    const panel = render(createElement(DicoPhysical, { reducedMotion: true }));
    expect(fondo(panel.container)).toContain(DICO_PET_PUBLIC_PATH);
    expect(observadores).toHaveLength(0);
    const despues = render(createElement(DicoPhysical, { diferir: true, reducedMotion: true }));
    expect(fondo(despues.container)).toContain(DICO_PET_PUBLIC_PATH);
    expect(observadores).toHaveLength(0);
  });

  it('sin IntersectionObserver no deja a Dico sin dibujo', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { default: DicoPhysical } = await import('../components/dico/DicoPhysical');
    const { container } = render(createElement(DicoPhysical, { diferir: true, reducedMotion: true }));
    expect(fondo(container)).toContain(DICO_PET_PUBLIC_PATH);
  });

  it('la mascota de Preguntas es la que difiere', () => {
    expect(readFileSync('src/components/landing/PreguntasNegocio.jsx', 'utf8')).toMatch(/<DicoPhysical[^>]*\bdiferir\b/);
  });
});

describe('el shader de Machine Soul arranca al acercarse', () => {
  it('no monta WebGL hasta que la seccion queda a 200 px', async () => {
    stubObservador();
    const { default: TransicionVolt } = await import('../components/landing/TransicionVolt');
    const { container, queryByTestId } = render(createElement(TransicionVolt));
    expect(queryByTestId('shader')).toBeNull();
    const seccion = container.querySelector('.hv-root');
    const cerca = observadores.find(o => o.opciones?.rootMargin === '1200px');
    expect(cerca.observados).toContain(seccion);
    acercar(cerca);
    expect(queryByTestId('shader')).not.toBeNull();
    expect(cerca.desconectado).toBe(true);
  });

  it('sin IntersectionObserver lo monta como antes', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { default: TransicionVolt } = await import('../components/landing/TransicionVolt');
    const { queryByTestId } = render(createElement(TransicionVolt));
    expect(queryByTestId('shader')).not.toBeNull();
  });
});

describe('imagenes del primer pantallazo', () => {
  it('las capas del hero tienen version movil recortada, prioridad alta y existen', async () => {
    const { default: EscenaHero } = await import('../components/landing/EscenaHero');
    const html = renderToStaticMarkup(createElement(EscenaHero));
    for (const capa of ['cielo', 'montana', 'primer-plano']) {
      expect(html).toContain(`<source media="(max-aspect-ratio: 3/4)" srcSet="/brand/landing/parallax/${capa}-movil.webp"`);
      expect(existsSync(`public/brand/landing/parallax/${capa}-movil.webp`)).toBe(true);
      expect(existsSync(`public/brand/landing/parallax/${capa}.webp`)).toBe(true);
    }
    expect(html.match(/fetchPriority="high"/g)).toHaveLength(3);
    expect(html).not.toContain('loading="lazy"');
  });

  it('cabecera, navegacion y cortina usan el logo liviano; el PNG original sigue para los demas', () => {
    expect(readFileSync('src/pages/PlatformLanding.jsx', 'utf8')).toContain('/brand/dico/logo/dico-oscuro-400.webp');
    expect(readFileSync('src/components/landing/NavegacionLanding.jsx', 'utf8')).toContain('/brand/dico/logo/dico-oscuro-400.webp');
    const cortina = readFileSync('index.html', 'utf8').match(/<div id="dico-entrada"[\s\S]*?<\/div>\s*<\/div>/)[0];
    expect(cortina).not.toContain('dico-oscuro.png');
    expect(cortina.match(/dico-oscuro\.webp/g)).toHaveLength(2);
    for (const archivo of ['dico-oscuro.png', 'dico-oscuro.webp', 'dico-oscuro-400.webp']) {
      expect(existsSync(`public/brand/dico/logo/${archivo}`)).toBe(true);
    }
  });
});
