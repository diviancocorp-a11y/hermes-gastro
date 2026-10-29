import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProductDetailScreen from '../catalog-pro/ProductDetailScreen';

afterEach(cleanup);
const base = { id: 'wine', name: 'Malbec', sale_price: 1000 };
const show = product => render(<ProductDetailScreen product={{ ...base, ...product }} />);

describe('Detalle con clasificación explícita del catálogo', () => {
  it('no muestra sección ni declaraciones inferidas del texto o alérgenos', () => {
    show({ description: 'Vegano y Sin TACC', allergens: [], is_vegetarian: true, catalog_attributes: { features: [] } });
    expect(screen.queryByRole('region', { name: 'Características' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Características del producto' })).not.toBeInTheDocument();
  });

  it('muestra clasificación y solo características declaradas', () => {
    show({ catalog_attributes: { category: 'Espumantes', brand: 'Bodega de prueba', line: 'Reserva', varietal: 'Chardonnay', presentation: 'Caja x3', features: ['vegan', 'gluten_free'] } });
    const section = screen.getByRole('region', { name: 'Características' });
    for (const value of ['Espumantes', 'Bodega de prueba', 'Reserva', 'Chardonnay', 'Caja x3', 'Vegano', 'Sin TACC']) {
      expect(within(section).getByText(value)).toBeInTheDocument();
    }
    expect(within(section).queryByText('Vegetariano')).not.toBeInTheDocument();
  });

  it('omite atributos vacíos y conserva la compra con presentación seleccionada', () => {
    const onAddToCart = vi.fn();
    const product = { ...base, catalog_attributes: { brand: '  ', features: [] }, sizes: [{ label: 'Caja x3', qty: 3, price: 2700 }] };
    render(<ProductDetailScreen product={product} onAddToCart={onAddToCart} />);
    expect(screen.queryByRole('region', { name: 'Características' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/ }));
    expect(onAddToCart).toHaveBeenCalledWith(product, 1, { size_label: 'Caja x3', size_qty: 3, size_price: 2700 });
  });
});
