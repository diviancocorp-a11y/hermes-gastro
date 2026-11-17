// Pedidos con el envio por confirmar (Cochi fase 5): el local carga el costo
// una vez, ve el total final en las dos monedas y no cobra un total parcial.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/platformAdmin', async (orig) => {
  const real = await orig();
  return { ...real, fetchOrderItems: vi.fn().mockResolvedValue([]) };
});

import OrdersPanel from '../components/admin/platform/OrdersPanel';

const base = {
  id: 'o1', created_at: '2026-11-16T15:00:00Z', status: 'new', customer_name: 'Ana', customer_phone: '1155',
  delivery: 'envio', delivery_address: 'Calle 1', payment: 'efectivo', total: 9, subtotal: 9, discount: 0, tip_amount: 0, delivery_cost: 0,
};
const pendiente = { ...base, delivery_pending: true, fx_rate: 800, fx_currency: 'VES', total_secondary: 7200 };
const MONEDA = { monedaPrincipal: 'USD', monedaSecundaria: 'VES' };
const props = (orders, extra = {}) => ({ orders, loading: false, onSetStatus: vi.fn(), showToast: vi.fn(), moneda: MONEDA, ...extra });

describe('OrdersPanel: envio por confirmar', () => {
  it('avisa cuantos pedidos esperan el envio y marca la tarjeta', () => {
    render(<OrdersPanel {...props([pendiente], { onSetDeliveryCost: vi.fn() })} />);
    expect(screen.getByRole('status').textContent).toMatch(/1 pedido espera el costo del envío/);
    expect(screen.getByText('Envío por confirmar')).toBeTruthy();
  });

  it('carga el costo una vez: llama con el numero y muestra el error del servidor', async () => {
    const onSetDeliveryCost = vi.fn().mockResolvedValue({ __error: 'db', message: 'El pedido no tiene el envio pendiente de confirmar' });
    render(<OrdersPanel {...props([pendiente], { onSetDeliveryCost })} />);
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }));
    const input = await screen.findByLabelText(/Costo del envío \(USD\)/);
    fireEvent.click(screen.getByText('Cargar envío'));
    expect(screen.getByRole('alert').textContent).toMatch(/Escribí el costo/);
    expect(onSetDeliveryCost).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '2.5' } });
    fireEvent.click(screen.getByText('Cargar envío'));
    await waitFor(() => expect(onSetDeliveryCost).toHaveBeenCalledWith('o1', 2.5));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/no tiene el envio pendiente/));
  });

  it('con el envio pendiente no se ofrece cobrar (el total es parcial)', () => {
    const { rerender } = render(<OrdersPanel {...props([pendiente], { tenantId: 't1', onSetDeliveryCost: vi.fn() })} />);
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }));
    expect(screen.queryByText(/^Cobrar/)).toBeNull();
    rerender(<OrdersPanel {...props([{ ...pendiente, delivery_pending: false, delivery_cost: 2.5, total: 11.5, total_secondary: 9200 }], { tenantId: 't1', onSetDeliveryCost: vi.fn() })} />);
    expect(screen.getByText(/^Cobrar \$11\.50/)).toBeTruthy();
  });

  it('el total se ve en las dos monedas, con la tasa del pedido', async () => {
    render(<OrdersPanel {...props([{ ...pendiente, delivery_pending: false, delivery_cost: 2.5, total: 11.5, total_secondary: 9200 }])} />);
    expect(screen.getByText('$11.50')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }));
    expect(await screen.findByText('Total en VES')).toBeTruthy();
    expect(screen.getByText('Tasa del pedido')).toBeTruthy();
  });

  it('un tenant en pesos sin pedidos pendientes se ve como siempre', () => {
    render(<OrdersPanel {...props([{ ...base, total: 1500 }], { moneda: null })} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('$1.500')).toBeTruthy();
  });
});
