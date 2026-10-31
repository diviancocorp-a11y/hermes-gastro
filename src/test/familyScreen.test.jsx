import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FamilyScreen from '../catalog-pro/FamilyScreen';

afterEach(cleanup);

const mk = (id, name, price, pack = '12') => ({
  id, name, sale_price: price, catalog_attributes: { family: 'Empanadas', ...(pack ? { family_pack: pack } : {}) },
});
const members = [mk('c', 'Empanada de Carne', 2000), mk('p', 'Empanada de Pollo', 2500), mk('j', 'Empanada de Jamon', 1000)];
const show = (props = {}, ms = members) => render(
  <FamilyScreen family={{ name: 'Empanadas', members: ms, pack: ms[0].catalog_attributes.family_pack ? 12 : null }} {...props} />,
);

describe('FamilyScreen', () => {
  it('muestra nombres cortos y el contador', () => {
    show();
    expect(screen.getByText('Carne')).toBeInTheDocument();
    expect(screen.getByText('Llevás 0')).toBeInTheDocument();
    expect(screen.getByText('Te faltan 12 para la docena')).toBeInTheDocument();
  });

  it('los chips suman media docena y docena, y el total es la suma real', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Sumar media docena de Carne' }));
    expect(screen.getByText('Llevás 6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sumar una docena de Pollo' }));
    expect(screen.getByText('Llevás 18')).toBeInTheDocument();
    expect(screen.getByText('1 docena + 6')).toBeInTheDocument();
    // 6 * 2000 + 12 * 2500 = 42000
    expect(screen.getByRole('button', { name: /Agregar al pedido/ }).textContent).toMatch(/42\.000/);
  });

  it('el boton esta deshabilitado en 0 y agrega una llamada por sabor con cantidad', () => {
    const onAddToCart = vi.fn();
    show({ onAddToCart });
    const cta = screen.getByRole('button', { name: /Agregar al pedido/ });
    expect(cta).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Sumar Carne' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sumar Carne' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sumar una docena de Jamon' }));
    fireEvent.click(cta);
    expect(onAddToCart).toHaveBeenCalledTimes(2);
    expect(onAddToCart).toHaveBeenCalledWith(members[0], 2);
    expect(onAddToCart).toHaveBeenCalledWith(members[2], 12);
  });

  it('los agotados quedan deshabilitados', () => {
    show({ soldOutIds: new Set(['p']) });
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sumar Pollo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sumar una docena de Pollo' })).toBeDisabled();
  });

  it('sin family_pack no hay chips ni mensaje de docena', () => {
    const ms = [mk('a', 'Pan relleno de Jamon', 10000, null), mk('b', 'Pan relleno de Queso', 13000, null)];
    show({}, ms);
    expect(screen.queryByText(/docena/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Te faltan/)).not.toBeInTheDocument();
    expect(screen.getByText('Jamon')).toBeInTheDocument();
  });

  it('volver llama onBack', () => {
    const onBack = vi.fn();
    show({ onBack });
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('un sabor que se agota en vivo sale del contador, del total y del pedido', () => {
    const onAddToCart = vi.fn();
    const onConfirm = vi.fn();
    const family = { name: 'Empanadas', members, pack: 12 };
    const { rerender } = render(<FamilyScreen family={family} onAddToCart={onAddToCart} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sumar una docena de Pollo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sumar Carne' }));
    expect(screen.getByText('Llevás 13')).toBeInTheDocument();
    rerender(<FamilyScreen family={family} soldOutIds={new Set(['p'])} onAddToCart={onAddToCart} onConfirm={onConfirm} />);
    expect(screen.getByText('Llevás 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agregar al pedido/ }).textContent).toMatch(/2.000/);
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/ }));
    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(onAddToCart).toHaveBeenCalledWith(members[0], 1);
    expect(onConfirm).toHaveBeenCalledWith(1);
  });

  it('pack impar: sin chip de mitad y con genero masculino', () => {
    const ms = [mk('a', 'Caja de Jamon', 100, '9'), mk('b', 'Caja de Queso', 100, '9')];
    render(<FamilyScreen family={{ name: 'Cajas', members: ms, pack: 9 }} />);
    expect(screen.queryByRole('button', { name: /medio pack/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Sumar un pack de Jamon' })).toHaveLength(1);
    expect(screen.getByText('Te faltan 9 para el pack')).toBeInTheDocument();
  });

  it('pack par distinto de 12 ofrece medio pack', () => {
    const ms = [mk('a', 'Caja de Jamon', 100, '6'), mk('b', 'Caja de Queso', 100, '6')];
    render(<FamilyScreen family={{ name: 'Cajas', members: ms, pack: 6 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sumar medio pack de Jamon' }));
    expect(screen.getByText('Llevás 3')).toBeInTheDocument();
  });

  it('con 12 dice la docena en femenino', () => {
    show();
    expect(screen.getByText('Te faltan 12 para la docena')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sumar una docena de Carne' })).toBeInTheDocument();
  });

  it('enfoca Volver al abrir y Escape cierra', () => {
    const onBack = vi.fn();
    show({ onBack });
    expect(screen.getByRole('button', { name: 'Volver' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onBack).toHaveBeenCalled();
  });

  it('family.css: la raiz es .cp-root.cp-fam, no un descendiente', () => {
    const css = readFileSync('src/catalog-pro/family.css', 'utf8');
    expect(css).not.toMatch(/\.cp-root \.cp-fam\s*\{/);
    expect(css).toMatch(/\.cp-root\.cp-fam\s*\{/);
  });
});
