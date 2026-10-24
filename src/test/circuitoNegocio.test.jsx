import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CircuitoNegocio from '../components/landing/CircuitoNegocio';

let escritorio;
let reducir;
let cuadro;
let visibilidad;
let desconectar;

beforeEach(() => {
  escritorio = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  reducir = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn((query) => query.includes('min-width') ? escritorio : reducir));
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => { cuadro = callback; return 17; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
  desconectar = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { visibilidad = callback; }
    observe() {}
    disconnect() { desconectar(); }
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('el circuito explica las acciones y el dia completo', () => {
  it('permite elegir con teclado y separa recibir, completar y cobrar', () => {
    const { container } = render(createElement(CircuitoNegocio));
    const botones = screen.getAllByRole('button');
    expect(container.querySelector('.cn-stock')).toHaveTextContent('6 kg');
    expect(container.querySelector('.cn-caja')).toHaveTextContent('Sin registrar');
    act(() => visibilidad([{ isIntersecting: true }]));
    fireEvent.keyDown(botones[0], { key: 'ArrowRight' });
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
    expect(botones[1]).toHaveFocus();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' });
    expect(botones[1]).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.cn-stock')).toHaveTextContent('5,5 kg');
    expect(container.querySelector('.cn-caja')).toHaveTextContent('Acción separada');
    fireEvent.keyDown(botones[1], { key: 'End' });
    expect(container.querySelector('.cn-resultado')).toHaveTextContent('$669.000');
    expect(container.querySelector('.cn-resultado')).toHaveTextContent('$2.168.000');
    expect(container.querySelector('.cn-resultado')).toHaveTextContent('−$1.499.000');
    expect(screen.getByText(/del día entero, no de este pedido/)).toBeInTheDocument();
  });

  it('el scroll nativo elige el momento y desmontar cancela trabajo pendiente', () => {
    const quitar = vi.spyOn(window, 'removeEventListener');
    const { container, unmount } = render(createElement(CircuitoNegocio));
    const pasos = container.querySelectorAll('.cn-paso');
    pasos.forEach((paso, indice) => {
      vi.spyOn(paso, 'getBoundingClientRect').mockReturnValue({ top: indice === 1 ? 100 : -1000, bottom: indice === 1 ? 600 : -500, height: 500 });
    });
    act(() => visibilidad([{ isIntersecting: true }]));
    fireEvent.scroll(window);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    act(() => cuadro());
    act(() => visibilidad([{ isIntersecting: false }]));
    fireEvent.scroll(window);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    act(() => visibilidad([{ isIntersecting: true }]));
    expect(container.firstChild).toHaveAttribute('data-momento', '2');
    fireEvent.scroll(window);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
    expect(desconectar).toHaveBeenCalledOnce();
    expect(quitar).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(escritorio.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('movil y movimiento reducido conservan seleccion manual sin avance al scroll', () => {
    escritorio.matches = false;
    reducir.matches = true;
    const { container } = render(createElement(CircuitoNegocio));
    act(() => visibilidad([{ isIntersecting: true }]));
    fireEvent.scroll(window);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(container.firstChild).toHaveAttribute('data-momento', '3');
  });

  it('el cambio de preferencia cancela el cuadro y el diagnostico retira la mascota', () => {
    const { rerender } = render(createElement(CircuitoNegocio));
    expect(screen.getByRole('img', { name: 'Dico, tu negocio conectado' })).toBeInTheDocument();
    act(() => visibilidad([{ isIntersecting: true }]));
    fireEvent.scroll(window);
    reducir.matches = true;
    act(() => reducir.addEventListener.mock.calls.forEach(([, callback]) => callback({ matches: true })));
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
    rerender(createElement(CircuitoNegocio, { ocultarDico: true }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
