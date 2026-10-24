import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProductEditor from '../components/admin/platform/ProductEditor';

vi.mock('../components/admin/platform/ImagePicker', () => ({ default: () => <div>Foto</div> }));
vi.mock('../components/admin/platform/RecipeEditor', () => ({ default: () => <div>Receta editable</div> }));

const base = { id: 'wine', name: 'Malbec vegano', price: 1000, category: 'Categoría anterior' };
const renderEditor = (props = {}) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<ProductEditor product={base} vertical="retail" settings={{ catalog_profile: 'beverages' }}
    onSave={onSave} onCancel={vi.fn()} {...props} />);
  return onSave;
};

describe('ProductEditor clasificación por rubro', () => {
  it('conserva metadatos y categoría anterior al editar clasificación y desmarcar una característica', async () => {
    const onSave = renderEditor({ product: { ...base, catalog_attributes: {
      category: 'Vinos tintos', brand: 'Bodega original', line: 'Reserva', varietal: 'Malbec',
      presentation: 'Botella', features: ['vegan', 'gluten_free'],
    } } });
    fireEvent.change(screen.getByLabelText('Bodega o marca'), { target: { value: 'Nueva bodega' } });
    expect(screen.getByLabelText('Grupo interno')).toHaveValue('Categoría anterior');
    expect(screen.getByText(/La categoría del catálogo define dónde aparece/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Vegano'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({ category: 'Categoría anterior', catalog_attributes: {
      category: 'Vinos tintos', brand: 'Nueva bodega', line: 'Reserva', varietal: 'Malbec',
      presentation: 'Botella', features: ['gluten_free'],
    } });
  });

  it('no deduce características del nombre, descripción ni alérgenos vacíos', async () => {
    const onSave = renderEditor({ product: { ...base, description: 'Sin gluten', allergens: [] } });
    expect(screen.getByLabelText('Vegano')).not.toBeChecked();
    expect(screen.getByLabelText('Sin TACC')).not.toBeChecked();
    expect(screen.queryByLabelText('Vegetariano')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].catalog_attributes.features).toEqual([]);
  });

  it('guarda una lista explícita vacía al desmarcar la última característica', async () => {
    const onSave = renderEditor({ product: { ...base, catalog_attributes: { features: ['vegan'] } } });
    fireEvent.click(screen.getByLabelText('Vegano'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].catalog_attributes.features).toEqual([]);
  });

  it('gastronomía conserva receta y características sin campos de bodega', () => {
    renderEditor({ vertical: 'gastro', settings: null });
    expect(screen.getByText('Receta editable')).toBeInTheDocument();
    expect(screen.getByLabelText('Vegetariano')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoría')).toBeInTheDocument();
    expect(screen.queryByLabelText('Bodega o marca')).not.toBeInTheDocument();
  });

  it('comercio ofrece sus campos sin cepa ni declaraciones alimentarias', () => {
    renderEditor({ settings: { catalog_profile: 'retail' } });
    expect(screen.getByLabelText('Marca')).toBeInTheDocument();
    expect(screen.getByLabelText('Presentación')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cepa')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sin TACC')).not.toBeInTheDocument();
  });

  it('bloquea edición mientras guarda y recupera el formulario tras un error', async () => {
    let reject;
    renderEditor({ onSave: vi.fn(() => new Promise((resolve, fail) => { reject = fail; })) });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByLabelText('Bodega o marca')).toBeDisabled();
    expect(screen.getByLabelText('Vegano')).toBeDisabled();
    reject(new Error('No se guardó el producto'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se guardó el producto'));
    expect(screen.getByLabelText('Bodega o marca')).not.toBeDisabled();
  });
});
