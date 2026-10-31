import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import _PlanesNegocio from '../components/landing/PlanesNegocio';
beforeEach(() => { vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });
describe('enlace directo a la comparativa', () => {
  it('abre la tabla y la lleva a la vista al entrar desde el diagnostico', () => {
    window.history.replaceState({}, '', '/#comparar-planes');
    Element.prototype.scrollIntoView = vi.fn();
    render(<_PlanesNegocio />);
    expect(document.querySelector('#comparar-planes')).toHaveAttribute('open');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });
  it('el ingreso normal conserva la tabla cerrada', () => { render(<_PlanesNegocio />); expect(document.querySelector('#comparar-planes')).not.toHaveAttribute('open'); });
});
