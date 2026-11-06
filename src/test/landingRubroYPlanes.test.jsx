import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanesNegocio from '../components/landing/PlanesNegocio';
import PlatformLanding from '../pages/PlatformLanding';
import { PLANES_COMERCIALES } from '../lib/planesPlataforma';
import { BAJADA_POR_RUBRO, rubroDeLaUrl } from '../lib/rubroLanding';

vi.mock('../lib/analiticaPlataforma', () => ({ cargarAnalitica: vi.fn(), marcarEvento: vi.fn() }));

const JERGA = /arqueo|consolidado/i;

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('planes en criollo', () => {
  it('cada tarjeta dice para quién es, bajo el nombre', () => {
    render(createElement(PlanesNegocio, { onDiagnostico: vi.fn() }));
    for (const plan of PLANES_COMERCIALES) {
      expect(plan.quien).toMatch(/^Para /);
      const tarjeta = screen.getByRole('article', { name: plan.nombre });
      expect(within(tarjeta).getByText(plan.quien)).toBeVisible();
    }
  });

  it('la oferta no habla de arqueo ni de consolidado', () => {
    for (const plan of PLANES_COMERCIALES) {
      expect([plan.quien, plan.descripcion, plan.detalle, ...plan.incluye].join(' ')).not.toMatch(JERGA);
    }
    const { container } = render(createElement(PlanesNegocio, { onDiagnostico: vi.fn() }));
    expect(container.querySelector('#precios').textContent).not.toMatch(JERGA);
  });
});

function landingCon(busqueda) {
  window.history.replaceState({}, '', `/${busqueda}`);
  const nodo = document.createElement('div');
  nodo.innerHTML = renderToStaticMarkup(createElement(PlatformLanding));
  return nodo;
}

describe('la landing le habla a cada rubro con ?rubro=', () => {
  it('lee los tres rubros, el alias gastro y descarta lo demás', () => {
    expect(rubroDeLaUrl('?rubro=gastronomia')).toBe('gastronomia');
    expect(rubroDeLaUrl('?rubro=gastro')).toBe('gastronomia');
    expect(rubroDeLaUrl('?rubro=Comercio')).toBe('comercio');
    expect(rubroDeLaUrl('?rubro=servicios')).toBe('servicios');
    expect(rubroDeLaUrl('?rubro=toString')).toBeNull();
    expect(rubroDeLaUrl('?rubro=barber')).toBeNull();
    expect(rubroDeLaUrl('')).toBeNull();
  });

  it('con ?rubro=servicios cambia la bajada, arranca en Servicios y lleva el rubro al alta', () => {
    const landing = landingCon('?rubro=servicios');
    expect(landing.querySelector('.pl-bajada span').textContent).toBe(BAJADA_POR_RUBRO.servicios);
    expect(landing.querySelector('.rn-rubros [aria-selected="true"]').textContent).toBe('Servicios');
    expect(landing.querySelector('.rn-relato h3').textContent).toBe('Servicios');
    expect(landing.querySelector('.pl-cabecera-registro').getAttribute('href')).toBe('/registro?rubro=barber');
  });

  it('con un rubro inválido queda la landing de siempre', () => {
    const landing = landingCon('?rubro=ferreteria');
    expect(landing.querySelector('.pl-bajada span').textContent).toBe('Para gastronomía, comercios y servicios.');
    expect(landing.querySelector('.rn-rubros [aria-selected="true"]').textContent).toBe('Gastronomía');
    expect(landing.querySelector('.pl-cabecera-registro').getAttribute('href')).toBe('/registro');
  });
});
