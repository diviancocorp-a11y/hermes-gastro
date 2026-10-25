import { createElement } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CircuitoNegocio from '../components/landing/CircuitoNegocio';

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
    pasos[0].focus();
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
});
