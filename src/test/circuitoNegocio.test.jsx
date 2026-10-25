import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CircuitoNegocio from '../components/landing/CircuitoNegocio';

let media;
beforeEach(() => {
  media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { this.callback = callback; }
    observe() { this.callback([{ isIntersecting: true }]); }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('demostración con capturas de la interfaz real', () => {
  it('cambia entre pantallas y mantiene las aclaraciones de operación', () => {
    const { container } = render(createElement(CircuitoNegocio));
    const grupo = screen.getByRole('group', { name: 'Momentos del ejemplo' });
    const pasos = within(grupo).getAllByRole('button');
    expect(container.querySelector('.cn-captura')).toHaveAttribute('src', '/brand/landing/interfaz/pedidos.png');
    expect(screen.getByText(/todavía no descuenta stock/)).toBeInTheDocument();
    fireEvent.click(pasos[1]);
    expect(pasos[1]).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.cn-captura')).toHaveAttribute('src', '/brand/landing/interfaz/stock.png');
    expect(screen.getByText(/dos acciones distintas/)).toBeInTheDocument();
    fireEvent.click(pasos[2]);
    expect(container.querySelector('.cn-captura')).toHaveAttribute('src', '/brand/landing/interfaz/resultado.png');
    expect(screen.getByRole('link', { name: /Ampliar captura/ })).toHaveAttribute('href', '/brand/landing/interfaz/resultado.png');
    expect(screen.getByText(/no es la ganancia de un solo pedido/)).toBeInTheDocument();
  });

  it('recorre los pasos con flechas, Home y End sin mover el scroll', () => {
    render(createElement(CircuitoNegocio));
    const pasos = within(screen.getByRole('group')).getAllByRole('button');
    act(() => pasos[0].focus());
    fireEvent.keyDown(pasos[0], { key: 'ArrowRight' });
    expect(pasos[1]).toHaveFocus();
    fireEvent.keyDown(pasos[1], { key: 'End' });
    expect(pasos[2]).toHaveFocus();
    expect(pasos[2]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(pasos[2], { key: 'Home' });
    expect(pasos[0]).toHaveFocus();
  });

  it('envía el CTA al mismo diagnóstico de la landing', () => {
    const abrir = vi.fn();
    render(createElement(CircuitoNegocio, { onDiagnostico: abrir }));
    fireEvent.click(screen.getByRole('button', { name: /Quiero ordenar mi negocio/ }));
    expect(abrir).toHaveBeenCalledOnce();
  });
  it('avanza cada siete segundos y congela al explorar con cursor o teclado', () => {
    vi.useFakeTimers();
    const { container } = render(createElement(CircuitoNegocio));
    const seccion = container.firstChild;
    act(() => vi.advanceTimersByTime(7000));
    expect(seccion).toHaveAttribute('data-momento', '2');
    fireEvent.pointerEnter(seccion, { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(21000));
    expect(seccion).toHaveAttribute('data-momento', '2');
    fireEvent.pointerLeave(seccion);
    act(() => vi.advanceTimersByTime(7000));
    expect(seccion).toHaveAttribute('data-momento', '3');
    const primero = within(screen.getByRole('group')).getAllByRole('button')[0];
    act(() => primero.focus());
    act(() => vi.advanceTimersByTime(14000));
    expect(seccion).toHaveAttribute('data-momento', '3');
  });

  it('permite pausar y respeta la preferencia de movimiento reducido', () => {
    vi.useFakeTimers();
    const { container, unmount } = render(createElement(CircuitoNegocio));
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    act(() => vi.advanceTimersByTime(14000));
    expect(container.firstChild).toHaveAttribute('data-momento', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    act(() => vi.advanceTimersByTime(7000));
    expect(container.firstChild).toHaveAttribute('data-momento', '2');
    unmount();
    media.matches = true;
    const quieto = render(createElement(CircuitoNegocio));
    act(() => vi.advanceTimersByTime(21000));
    expect(quieto.container.firstChild).toHaveAttribute('data-momento', '1');
  });

});
