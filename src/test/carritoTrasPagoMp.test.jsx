// El carrito guardado no revive despues de pagar con MercadoPago (y no se
// pierde si el pago fallo). Ver src/lib/carritoGuardado.js y MpStatus.jsx.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MpStatus from '../pages/MpStatus';
import { guardarCarrito, leerCarritoGuardado, claveCarrito } from '../lib/carritoGuardado';

vi.mock('../lib/activeTenant', () => ({ resolveTenantSlug: () => Promise.resolve('negocio-uno') }));
vi.mock('../services/orderTracker', () => ({
  fetchOrderTracker: vi.fn().mockResolvedValue({ pedido: { id: 'pedido-1', status: 'new', payment_status: 'approved' } }),
}));
vi.mock('../components/catalog/OrderSentView', () => ({ default: () => <div>pedido enviado</div> }));

const linea = { id: 'a', product_id: 'a', name: 'Producto A', price: 1000, qty: 1 };
const ver = status => render(
  <MemoryRouter initialEntries={['/pago/x?orderId=pedido-1']}><MpStatus status={status} /></MemoryRouter>,
);

beforeEach(() => {
  localStorage.clear();
  guardarCarrito('negocio-uno', [linea], Date.now(), { mpPedido: 'pedido-1' });
});
afterEach(cleanup);

describe('carrito despues de MercadoPago', () => {
  it('pago exitoso: borra el carrito guardado', async () => {
    ver('exitoso');
    await waitFor(() => expect(localStorage.getItem(claveCarrito('negocio-uno'))).toBeNull());
  });

  it('pago pendiente: tambien lo borra (no se ofrece pagar dos veces)', async () => {
    ver('pendiente');
    await waitFor(() => expect(localStorage.getItem(claveCarrito('negocio-uno'))).toBeNull());
  });

  it('pago fallido: el carrito sigue, atado al mismo pedido para reintentar sin duplicarlo', async () => {
    ver('fallido');
    await new Promise(r => setTimeout(r, 20));
    expect(leerCarritoGuardado('negocio-uno')).toEqual({ items: [linea], mpPedido: 'pedido-1' });
  });

  it('el carrito de otro negocio no se toca', async () => {
    guardarCarrito('negocio-dos', [linea]);
    ver('exitoso');
    await waitFor(() => expect(localStorage.getItem(claveCarrito('negocio-uno'))).toBeNull());
    expect(localStorage.getItem(claveCarrito('negocio-dos'))).not.toBeNull();
  });
});
