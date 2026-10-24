import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProductsPanel from '../components/admin/platform/ProductsPanel';

vi.mock('../components/ConfirmSlideProvider', () => ({ useConfirm: () => vi.fn() }));
vi.mock('../components/admin/platform/GestionProductosPanel', () => ({ default: () => null }));
vi.mock('../components/admin/platform/RecetarioPanel', () => ({ default: () => null }));
vi.mock('../components/dico/DicoCuadro', () => ({ default: () => null }));
vi.mock('../lib/useMediaQuery', () => ({ default: () => false }));

const setup = (overrides = {}) => {
  const onSaveSettings = vi.fn().mockResolvedValue({ catalog_profile: 'beverages' });
  const props = { roles: ['owner'], products: [], vertical: 'retail', settings: {},
    onSaveSettings, onSave: vi.fn(), ...overrides };
  render(<ProductsPanel {...props} />);
  return props;
};

describe('ProductsPanel perfil del catálogo', () => {
  it('usa el rubro como default y guarda solo el patch elegido por el dueño', async () => {
    const { onSaveSettings, onSave } = setup();
    expect(screen.getByLabelText('Perfil del catálogo')).toHaveValue('retail');
    expect(screen.getByRole('button', { name: 'Guardar perfil' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Perfil del catálogo'), { target: { value: 'beverages' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() => expect(onSaveSettings).toHaveBeenCalledWith({ catalog_profile: 'beverages' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar perfil' })).toBeDisabled());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('no ofrece configuración a manager ni sin persistencia disponible', () => {
    const { rerender } = render(<ProductsPanel roles={['manager']} products={[]} vertical="retail" onSaveSettings={vi.fn()} />);
    expect(screen.queryByLabelText('Perfil del catálogo')).not.toBeInTheDocument();
    rerender(<ProductsPanel roles={['owner']} products={[]} vertical="retail" />);
    expect(screen.queryByLabelText('Perfil del catálogo')).not.toBeInTheDocument();
  });

  it.each([null, { __error: true, message: 'Falló la configuración' }])('mantiene pendiente y permite reintentar ante retorno fallido %j', async result => {
    setup({ onSaveSettings: vi.fn().mockResolvedValue(result) });
    fireEvent.change(screen.getByLabelText('Perfil del catálogo'), { target: { value: 'beverages' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Guardar perfil' })).not.toBeDisabled();
  });

  it('bloquea doble envío y recupera el selector ante excepción', async () => {
    let reject;
    const onSaveSettings = vi.fn(() => new Promise((resolve, fail) => { reject = fail; }));
    setup({ onSaveSettings });
    const select = screen.getByLabelText('Perfil del catálogo');
    fireEvent.change(select, { target: { value: 'beverages' } });
    const form = select.closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSaveSettings).toHaveBeenCalledOnce();
    expect(select).toBeDisabled();
    reject(new Error('Sin conexión'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión'));
    expect(select).not.toBeDisabled();
  });

  it('respeta perfil explícito sin inferirlo del nombre de los productos', () => {
    setup({ settings: { catalog_profile: 'gastro' }, products: [{ id: '1', name: 'Chandon espumante', category: 'Bebidas' }] });
    expect(screen.getByLabelText('Perfil del catálogo')).toHaveValue('gastro');
  });
});
