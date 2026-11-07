// Hallazgos 16 a 23 de la auditoria de la landing del 6/nov: lo que tiene
// logica queda fijado aca (la medicion visual se hizo con Playwright).
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanesNegocio from '../components/landing/PlanesNegocio';
import { contextoDelRegistro, enlaceDeRegistro } from '../lib/registroPlataforma';
import QueEsDico from '../components/landing/QueEsDico';
import NavegacionLanding from '../components/landing/NavegacionLanding';
import NegociosDico from '../components/landing/NegociosDico';
import { NEGOCIOS } from '../components/landing/clientes';
import { WHATSAPP_MAGNUS_URL } from '../lib/contactoPlataforma';

vi.mock('../lib/analiticaPlataforma', () => ({ cargarAnalitica: vi.fn(), marcarEvento: vi.fn() }));
// El horizonte es WebGL: fuera del alcance de jsdom.
vi.mock('../components/landing/EarthBlaze', () => ({ default: () => null }));

let reducido = false;
let observados = [];
beforeEach(() => {
  reducido = false;
  observados = [];
  vi.stubGlobal('matchMedia', vi.fn(consulta => ({ matches: consulta.includes('reduce') ? reducido : false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { this.callback = callback; observados.push(this); }
    observe() {}
    disconnect() {}
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('23. Elegir Paris y Dante lleva al registro con el plan', () => {
  it('arma el enlace con plan, periodo anual (solo fuera de Paris) y rubro', () => {
    expect(enlaceDeRegistro('digital', false)).toBe('/registro?plan=digital');
    expect(enlaceDeRegistro('local', false)).toBe('/registro?plan=local');
    expect(enlaceDeRegistro('local', true)).toBe('/registro?plan=local&periodo=anual');
    expect(enlaceDeRegistro('digital', true)).toBe('/registro?plan=digital');
    expect(enlaceDeRegistro('local', true, 'barber')).toBe('/registro?plan=local&periodo=anual&rubro=barber');
  });

  it('el registro entiende lo que manda el enlace', () => {
    window.history.replaceState({}, '', enlaceDeRegistro('local', true, 'barber'));
    expect(contextoDelRegistro()).toMatchObject({ plan: 'local', periodo: 'anual', vertical: 'barber' });
    window.history.replaceState({}, '', enlaceDeRegistro('digital', true));
    expect(contextoDelRegistro()).toMatchObject({ plan: 'digital', periodo: 'mensual' });
    window.history.replaceState({}, '', '/');
  });

  it('las tarjetas son enlaces, siguen el toggle anual y Magnus sigue en WhatsApp', () => {
    render(createElement(PlanesNegocio, { onDiagnostico: vi.fn(), rubroRegistro: 'retail' }));
    expect(screen.getByRole('link', { name: /Elegir Paris/ })).toHaveAttribute('href', '/registro?plan=digital&rubro=retail');
    expect(screen.getByRole('link', { name: /Elegir Dante/ })).toHaveAttribute('href', '/registro?plan=local&rubro=retail');
    expect(screen.queryByRole('button', { name: /Elegir/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Anual' }));
    expect(screen.getByRole('link', { name: /Elegir Dante/ })).toHaveAttribute('href', '/registro?plan=local&periodo=anual&rubro=retail');
    expect(screen.getByRole('link', { name: /Elegir Paris/ })).toHaveAttribute('href', '/registro?plan=digital&rubro=retail');
    expect(screen.getByRole('link', { name: /Hablemos de Magnus/ })).toHaveAttribute('href', WHATSAPP_MAGNUS_URL);
  });
});

describe('21. Conocé Dico: flechas a los lados, sin botón de pausa', () => {
  const corre = contenedor => contenedor.querySelector('.qd-root').classList.contains('qd-corre');
  const verTexto = () => act(() => { observados.forEach(o => o.callback([{ isIntersecting: true }])); });
  const activa = () => screen.getByRole('tab', { selected: true }).textContent;

  it('las flechas pasan de escena en los dos sentidos y frenan la rotación', () => {
    const { container } = render(createElement(QueEsDico));
    verTexto();
    expect(corre(container)).toBe(true);
    expect(screen.queryByRole('button', { name: /Pausar|Reanudar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente: Visión' }));
    expect(activa()).toBe('Visión');
    expect(corre(container)).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente: Misión' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente: Qué es' }));
    expect(activa()).toBe('Qué es');
    fireEvent.click(screen.getByRole('button', { name: 'Anterior: Misión' }));
    expect(activa()).toBe('Misión');
  });

  it('tocar una pestaña o el texto también la deja quieta', () => {
    const { container } = render(createElement(QueEsDico));
    verTexto();
    fireEvent.click(screen.getByRole('tab', { name: /Visión/ }));
    expect(screen.getByRole('tab', { name: /Visión/ })).toHaveAttribute('aria-selected', 'true');
    expect(corre(container)).toBe(false);
    cleanup();
    const otro = render(createElement(QueEsDico));
    verTexto();
    fireEvent.click(otro.container.querySelector('.qd-paneles'));
    expect(corre(otro.container)).toBe(false);
  });

  it('con movimiento reducido no rota y las flechas siguen andando', () => {
    reducido = true;
    const { container } = render(createElement(QueEsDico));
    verTexto();
    expect(corre(container)).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente: Visión' }));
    expect(activa()).toBe('Visión');
  });
});

describe('20. Logos sin repetirse en lo que se ve', () => {
  it('cada negocio figura una vez por vuelta de la cinta', () => {
    const logos = NEGOCIOS.map(n => n.logo);
    expect(new Set(logos).size).toBe(logos.length);
    const { container } = render(createElement(NegociosDico));
    const filas = [...container.querySelectorAll('.nc-fila')];
    for (const fila of filas) {
      const srcs = [...fila.querySelectorAll('img')].map(img => img.getAttribute('src'));
      expect(new Set(srcs).size).toBe(srcs.length);
    }
  });

  it('cada vuelta mide al menos lo visible mas un hueco (la copia nunca entra a la vista a la vez)', () => {
    const css = readFileSync('src/styles/negocios-dico.css', 'utf8');
    expect(css).toMatch(/\.nc-deslizable \{ container-type: inline-size; \}/);
    expect(css).toMatch(/\.nc-cinta \.nc-fila \{[^}]*min-width: calc\(100cqi \+ var\(--nc-gap\)\)/);
  });
});

describe('16. Menú del celular: se lee que desliza y toques de 48 px', () => {
  it('marca el lado con más enlaces según el desplazamiento', () => {
    const raizRef = { current: null };
    render(createElement(NavegacionLanding, { raizRef, oculta: false, onDiagnostico: vi.fn() }));
    const fila = screen.getByRole('navigation', { hidden: true });
    Object.defineProperty(fila, 'scrollWidth', { configurable: true, value: 340 });
    Object.defineProperty(fila, 'clientWidth', { configurable: true, value: 146 });
    fila.scrollLeft = 0;
    fireEvent.scroll(fila);
    expect(fila).toHaveAttribute('data-mas-izq', 'false');
    expect(fila).toHaveAttribute('data-mas-der', 'true');
    fila.scrollLeft = 194;
    fireEvent.scroll(fila);
    expect(fila).toHaveAttribute('data-mas-izq', 'true');
    expect(fila).toHaveAttribute('data-mas-der', 'false');
  });

  it('los enlaces usan la altura táctil del sistema', () => {
    const css = readFileSync('src/styles/navegacion-landing.css', 'utf8');
    expect(css).toMatch(/\.nl-enlaces a \{[^}]*min-height: var\(--ds-control-height-touch\)/);
  });
});

describe('22. El CTA del hero tiene anillo de foco', () => {
  it('ningún outline:none le borra el foco y el foco visible pinta un anillo', () => {
    const css = readFileSync('src/styles/platform-landing.css', 'utf8');
    const regla = css.match(/\.pl-hero-tiempo \.pl-hero-origen \{[^}]*\}/)[0];
    expect(regla).not.toMatch(/outline:\s*(none|0)/);
    expect(css).toMatch(/\.pl-hero-tiempo \.pl-hero-origen:focus-visible \{ outline: 2px solid var\(--pc-producto-volt\)/);
  });
});
