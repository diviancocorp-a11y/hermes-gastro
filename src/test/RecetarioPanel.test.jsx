import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecetarioPanel, { recipeExportData, printRecipeCards, downloadRecipeJSON } from '../components/admin/platform/RecetarioPanel';
import { fetchRecipeCards, saveRecipeCard, saveProductAllergens } from '../services/recetario';
import { printAsPDF } from '../lib/exports';
vi.mock('../services/recetario', () => ({ fetchRecipeCards: vi.fn(), saveRecipeCard: vi.fn(), saveProductAllergens: vi.fn(), scaleRecipeIngredients: vi.fn(lines => lines) }));
vi.mock('../lib/exports', () => ({ printAsPDF: vi.fn() }));
const products = [{ id: 'p', name: 'Pan', category: 'Panadería', price: 999, allergens: ['gluten'] }];
const card = { product_id: 'p', yield_qty: 12, yield_unit: 'unidades', time_minutes: 30, steps: [{ texto: '<script>test</script>' }], notes: 'Reposar', visible_to: ['owner', 'manager', 'kitchen'] };
beforeEach(() => { vi.clearAllMocks(); fetchRecipeCards.mockResolvedValue([card]); });
afterEach(cleanup);
describe('Recetario UI', () => {
  it('kitchen reads a persisted card without edit controls or prices', async () => {
    render(<RecetarioPanel tenantId="a" roles={['kitchen']} products={products} />);
    fireEvent.click(await screen.findByRole('button', { name: /Pan.*Ficha guardada/ }));
    expect(screen.getByText('<script>test</script>')).toBeTruthy();
    expect(screen.queryByText('999')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar ficha' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Descargar ficha JSON' })).toBeTruthy();
  });
  it('retains unsaved allergens after saving the card and disables exports', async () => {
    saveRecipeCard.mockResolvedValue({ ...card, notes: 'Nueva nota' });
    render(<RecetarioPanel tenantId="a" roles={['manager']} products={products} />);
    fireEvent.click(await screen.findByRole('button', { name: /Pan.*Ficha guardada/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar ficha' }));
    fireEvent.change(screen.getByLabelText('Notas y conservación'), { target: { value: 'Nueva nota' } });
    fireEvent.change(screen.getByLabelText('Alérgenos separados por coma'), { target: { value: 'gluten, leche' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }));
    await screen.findByText('Ficha guardada.');
    expect(screen.getByLabelText('Alérgenos separados por coma').value).toBe('gluten, leche');
    expect(screen.getByRole('button', { name: 'Descargar ficha JSON' }).disabled).toBe(true);
    expect(saveProductAllergens).not.toHaveBeenCalled();
    expect(saveRecipeCard.mock.calls[0][2].visible_to).toContain('manager');
  });
  it('creates a card for an existing product and preserves editor after save failure', async () => {
    fetchRecipeCards.mockResolvedValueOnce([]);
    saveRecipeCard.mockRejectedValueOnce(new Error('No se pudo guardar'));
    render(<RecetarioPanel tenantId="a" roles={['owner']} products={products} />);
    fireEvent.click(await screen.findByRole('button', { name: /Pan.*Sin ficha/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear ficha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }));
    expect(await screen.findByText('No se pudo guardar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar ficha' })).toBeTruthy();
  });
  it('does not reveal an owner-only card to kitchen', async () => {
    fetchRecipeCards.mockResolvedValueOnce([{ ...card, visible_to: ['owner'] }]);
    render(<RecetarioPanel tenantId="a" roles={['kitchen']} products={products} />);
    await waitFor(() => expect(screen.queryByText('Cargando recetario…')).toBeNull());
    expect(screen.queryByRole('button', { name: /Descargar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pan/ })).toBeNull();
  });
  it('reports fetch failures and retries', async () => {
    fetchRecipeCards.mockRejectedValueOnce(new Error('offline'));
    render(<RecetarioPanel tenantId="a" roles={['owner']} products={products} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: /Pan.*Ficha guardada/ })).toBeTruthy();
    expect(fetchRecipeCards).toHaveBeenCalledTimes(2);
  });
  it('discards a late response from a different tenant', async () => {
    let resolveOld;
    fetchRecipeCards.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce([]);
    const view = render(<RecetarioPanel tenantId="old" roles={['kitchen']} products={products} />);
    view.rerender(<RecetarioPanel tenantId="new" roles={['kitchen']} products={products} />);
    await waitFor(() => expect(screen.queryByText('Cargando recetario…')).toBeNull());
    resolveOld([card]);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Pan.*Ficha guardada/ })).toBeNull());
  });
});
describe('recipe export projection', () => {
  it('excludes financial fields and passes all text to the escaped PDF utility', () => {
    const data = recipeExportData([card], products, new Map([['p', [{ ingredient_id: 'i', qty: 2, cost: 888 }]]]), [{ id: 'i', name: 'Harina', unit: 'kg', cost: 777 }]);
    expect(JSON.stringify(data)).not.toMatch(/price|cost|999|888|777/);
    printRecipeCards(data);
    expect(printAsPDF.mock.calls[0][2][0][3]).toContain('<script>test</script>');
    expect(data[0].ingredients).toEqual([{ name: 'Harina', qty: 2, unit: 'kg' }]);
  });
  it('downloads a JSON Blob and revokes the URL', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:recipe'); const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadRecipeJSON([{ name: 'Pan' }]);
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledOnce();
    vi.runAllTimers(); expect(revoke).toHaveBeenCalledWith('blob:recipe');
    click.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers();
  });
});
