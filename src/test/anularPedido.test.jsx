// Anular un pedido completado (0149): quien ve el boton, que el motivo sea
// obligatorio, que se llame una sola vez y que un error no cierre el dialogo.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/platformAdmin', async (orig) => {
  const real = await orig();
  return { ...real, fetchOrderItems: vi.fn().mockResolvedValue([]) };
});

import OrdersPanel from '../components/admin/platform/OrdersPanel';
import AnularPedido from '../components/admin/platform/AnularPedido';
import { puedeAnularPedido, motivoValido } from '../lib/anularPedido';

const base = {
  id: 'o1', created_at: '2026-11-16T15:00:00Z', status: 'completed', customer_name: 'Ana',
  customer_phone: '1155', delivery: 'retiro', payment: 'efectivo', total: 9, subtotal: 9,
  discount: 0, tip_amount: 0, delivery_cost: 0,
};

function panel(extra = {}, orders = [base]) {
  return render(
    <OrdersPanel
      orders={orders} loading={false} onSetStatus={vi.fn()} showToast={vi.fn()}
      roles={['owner']} onAnular={vi.fn().mockResolvedValue({ ok: true })}
      abiertoId="o1" itemsIniciales={[]} {...extra}
    />,
  );
}

describe('reglas', () => {
  it('solo dueño y encargado pueden anular', () => {
    expect(puedeAnularPedido(['owner'])).toBe(true);
    expect(puedeAnularPedido(['cashier', 'manager'])).toBe(true);
    expect(puedeAnularPedido(['cashier'])).toBe(false);
    expect(puedeAnularPedido([])).toBe(false);
  });
  it('el motivo se limpia y pide al menos 3 caracteres', () => {
    expect(motivoValido('  por error ')).toBe('por error');
    expect(motivoValido('ab')).toBeNull();
    expect(motivoValido('x'.repeat(301))).toBeNull();
  });
});

describe('boton Anular en la tarjeta', () => {
  it('aparece en un pedido completado para el dueño', () => {
    panel();
    expect(screen.getByRole('button', { name: 'Anular' })).toBeTruthy();
  });
  it('no aparece para un cajero ni sin onAnular', () => {
    panel({ roles: ['cashier'] });
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull();
  });
  it('no aparece sin onAnular', () => {
    panel({ onAnular: null });
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull();
  });
  it('no aparece en un pedido que no esta completado', () => {
    panel({}, [{ ...base, status: 'preparing' }]);
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull();
  });
  it('un pedido anulado muestra el motivo', () => {
    panel({}, [{ ...base, status: 'cancelled', cancel_reason: 'Se cargó dos veces' }]);
    expect(screen.getByText('Anulado: Se cargó dos veces')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull();
  });
  it('al tocarlo abre el dialogo con el motivo en foco', async () => {
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
    const campo = await screen.findByLabelText('Motivo');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(campo).toBe(document.activeElement);
  });
});

describe('dialogo AnularPedido', () => {
  const pedido = { id: 'o1', customer_name: 'Ana' };

  it('sin motivo el boton esta deshabilitado', () => {
    render(<AnularPedido pedido={pedido} onConfirmar={vi.fn()} onCerrar={vi.fn()} />);
    const confirmar = screen.getByRole('button', { name: 'Anular pedido' });
    expect(confirmar.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'ab' } });
    expect(confirmar.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'abc' } });
    expect(confirmar.disabled).toBe(false);
  });

  it('llama con el pedido y el motivo, y un doble toque no duplica', async () => {
    let resolver;
    const onConfirmar = vi.fn(() => new Promise((r) => { resolver = r; }));
    const onCerrar = vi.fn();
    render(<AnularPedido pedido={pedido} onConfirmar={onConfirmar} onCerrar={onCerrar} />);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: '  se cargó dos veces ' } });
    const confirmar = screen.getByRole('button', { name: 'Anular pedido' });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).toHaveBeenCalledWith(pedido, 'se cargó dos veces');
    expect(screen.getByRole('button', { name: 'Anulando…' })).toBeTruthy();
    resolver({ ok: true });
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1));
  });

  it('un error se muestra y el dialogo queda abierto', async () => {
    const onConfirmar = vi.fn().mockResolvedValue({ __error: 'tiene_factura', message: 'Este pedido tiene factura' });
    const onCerrar = vi.fn();
    render(<AnularPedido pedido={pedido} onConfirmar={onConfirmar} onCerrar={onCerrar} />);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'por error' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anular pedido' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/tiene factura/);
    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Anular pedido' }).disabled).toBe(false);
  });

  it('si onConfirmar rechaza, se ve el error y el boton vuelve a quedar habilitado', async () => {
    const onConfirmar = vi.fn().mockRejectedValue(new Error('red caida'));
    const onCerrar = vi.fn();
    render(<AnularPedido pedido={pedido} onConfirmar={onConfirmar} onCerrar={onCerrar} />);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'por error' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anular pedido' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Probá de nuevo/);
    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Anular pedido' }).disabled).toBe(false);
  });

  it('la ayuda aparece mientras el motivo no alcanza', () => {
    render(<AnularPedido pedido={pedido} onConfirmar={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByText('Escribí al menos 3 caracteres')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'por error' } });
    expect(screen.queryByText('Escribí al menos 3 caracteres')).toBeNull();
  });

  it('Escape cierra', () => {
    const onCerrar = vi.fn();
    render(<AnularPedido pedido={pedido} onConfirmar={vi.fn()} onCerrar={onCerrar} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalled();
  });
});
