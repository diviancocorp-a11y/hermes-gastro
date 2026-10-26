import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import HomeScreen from '../catalog-pro/HomeScreen';
import ProductCharacteristics from '../catalog-pro/ProductCharacteristics';

vi.mock('../catalog-pro/OrderStatusCard', () => ({ default: () => null }));
vi.mock('../catalog-pro/ReservarEntrada', () => ({ default: () => null }));
vi.mock('../catalog-pro/CatalogMusicToggle', () => ({ default: () => null }));
vi.mock('../catalog-pro/PromoCarousel', () => ({ default: () => null }));
vi.mock('../catalog-pro/SuperCombos', () => ({ default: () => null }));
vi.mock('../catalog-pro/homeHelpers', async importOriginal => ({
  ...await importOriginal(), buildStories: () => [], buildRecos: () => [],
}));

afterEach(cleanup);
const products = [
  { id: 'a', name: 'Brut de prueba', sale_price: 100, catalog_attributes: { category: 'Espumantes', brand: 'Chandon', presentation: 'Botella', features: [] } },
  { id: 'b', name: 'Malbec de prueba', sale_price: 100, catalog_attributes: { category: 'Tintos', brand: 'Otra', varietal: 'Malbec', presentation: 'Caja x6', features: [] } },
  { id: 'c', name: 'Hielo de prueba', sale_price: 100, catalog_attributes: { category: 'Hielo', presentation: 'Bolsa 2kg', features: [] } },
];

describe('Home: filtros por rubro', () => {
  it('combina espumante y bodega sin resetear categoría y limpia facetas al elegir hielo', () => {
    render(<HomeScreen products={products} settings={{ catalog_profile: 'beverages' }} />);
    const filters = screen.getByRole('region', { name: 'Filtros del catálogo' });
    expect(within(filters).queryByRole('button', { name: 'Vegetariano' })).not.toBeInTheDocument();
    expect(within(filters).queryByText('Más filtros')).not.toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('button', { name: /^Espumantes/ }));
    fireEvent.change(within(filters).getByLabelText('Bodega o marca'), { target: { value: 'Chandon' } });
    expect(within(filters).getByRole('button', { name: /^Espumantes/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(filters).getByRole('status')).toHaveTextContent('1 producto');
    fireEvent.click(within(filters).getByRole('button', { name: /^Hielo/ }));
    expect(within(filters).queryByLabelText('Bodega o marca')).not.toBeInTheDocument();
    expect(within(filters).queryByLabelText('Cepa')).not.toBeInTheDocument();
    expect(within(filters).getByRole('status')).toHaveTextContent('1 producto');
    fireEvent.click(within(filters).getByRole('button', { name: 'Limpiar filtros' }));
    expect(within(filters).getByRole('status')).toHaveTextContent('3 productos');
  });
  it('conserva vegetariano en gastronomía y ofrece características solo cuando están declaradas', () => {
    render(<HomeScreen products={[{ ...products[0], catalog_attributes: { ...products[0].catalog_attributes, features: ['vegan'] } }]} settings={{ catalog_profile: 'gastro' }} categories={[{ name: 'Todos' }]} />);
    const filters = screen.getByRole('region', { name: 'Filtros del catálogo' });
    expect(within(filters).getByRole('button', { name: 'Vegetariano' })).toBeInTheDocument();
    expect(within(filters).getByText('Más filtros')).toBeInTheDocument();
    expect(within(filters).getByLabelText('Vegano')).not.toBeChecked();
    fireEvent.click(within(filters).getByLabelText('Vegano'));
    expect(within(filters).getByLabelText('Vegano')).toBeChecked();
    expect(within(filters).queryByLabelText('Sin TACC')).not.toBeInTheDocument();
  });
  it('no muestra badges para declaraciones vacías ni infiere texto de marketing', () => {
    const { rerender } = render(<ProductCharacteristics product={{ description: 'Vegano, sin TACC', catalog_attributes: { features: [] } }} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    rerender(<ProductCharacteristics product={{ catalog_attributes: { features: ['vegan', 'gluten_free'] } }} />);
    expect(screen.getByRole('list', { name: 'Características del producto' })).toHaveTextContent('VeganoSin TACC');
  });
});
