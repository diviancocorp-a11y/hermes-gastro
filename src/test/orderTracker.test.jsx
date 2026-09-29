// src/test/orderTracker.test.jsx
// El seguimiento de pedido del comprador: el servicio que habla con
// get_order_tracker (0081), el hook que lo mantiene al dia y la pantalla.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { rpc, slug } = vi.hoisted(() => ({ rpc: vi.fn(), slug: { valor: 'cochi' } }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('../lib/activeTenant', () => ({ resolveTenantSlug: vi.fn(async () => slug.valor) }));

import { fetchOrderTracker } from '../services/orderTracker';
import usePedidoEnVivo from '../hooks/usePedidoEnVivo';
import OrderTracker from '../pages/OrderTracker';

const ID = '3f1c2b4a-1111-4222-8333-944455566677';
const pedido = (extra = {}) => ({
  id: ID, status: 'preparing', total: 2500, delivery: 'retiro', is_gift: false,
  created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  customer_first_name: 'Ana', note: null, whatsapp: '5491122334455',
  items: [{ name: 'Medialuna', qty: 3, unit_price: 500, subtotal: 1500 }],
  ...extra,
});

beforeEach(() => {
  rpc.mockReset();
  slug.valor = 'cochi';
});

describe('fetchOrderTracker', () => {
  it('pregunta por el negocio del host y el uuid del pedido', async () => {
    rpc.mockResolvedValue({ data: pedido(), error: null });
    const r = await fetchOrderTracker(ID);
    expect(rpc).toHaveBeenCalledWith('get_order_tracker', { p_tenant_slug: 'cochi', p_order_id: ID });
    expect(r).toEqual({ pedido: expect.objectContaining({ id: ID }), fallo: false });
  });

  it('un codigo corto no es un uuid: no existe, y ni siquiera se pregunta', async () => {
    expect(await fetchOrderTracker('ABC123')).toEqual({ pedido: null, fallo: false });
    expect(await fetchOrderTracker('#ABC123')).toEqual({ pedido: null, fallo: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sin negocio (la raiz de la plataforma) no pregunta', async () => {
    slug.valor = null;
    expect(await fetchOrderTracker(ID)).toEqual({ pedido: null, fallo: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('distingue "no existe" (null) de "no se pudo preguntar" (error)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await fetchOrderTracker(ID)).toEqual({ pedido: null, fallo: false });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await fetchOrderTracker(ID)).toEqual({ pedido: null, fallo: true });
  });
});

describe('usePedidoEnVivo', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('vuelve a preguntar mientras el pedido puede cambiar y marca el cambio', async () => {
    rpc
      .mockResolvedValueOnce({ data: pedido({ status: 'new' }), error: null })
      .mockResolvedValueOnce({ data: pedido({ status: 'preparing' }), error: null });
    const { result } = renderHook(() => usePedidoEnVivo(ID, { cadaMs: 1000 }));

    await waitFor(() => expect(result.current.pedido?.status).toBe('new'));
    expect(result.current.cambio).toBe(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await waitFor(() => expect(result.current.pedido?.status).toBe('preparing'));
    expect(result.current.cambio).toBe(1);
  });

  it('en un estado final deja de preguntar', async () => {
    rpc.mockResolvedValue({ data: pedido({ status: 'completed' }), error: null });
    const { result } = renderHook(() => usePedidoEnVivo(ID, { cadaMs: 1000 }));
    await waitFor(() => expect(result.current.pedido?.status).toBe('completed'));

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('un fallo de red no borra lo que ya se mostraba', async () => {
    rpc
      .mockResolvedValueOnce({ data: pedido(), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    const { result } = renderHook(() => usePedidoEnVivo(ID, { cadaMs: 1000 }));
    await waitFor(() => expect(result.current.pedido?.id).toBe(ID));

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await waitFor(() => expect(result.current.fallo).toBe(true));
    expect(result.current.pedido?.id).toBe(ID);
    expect(result.current.noEncontrado).toBe(false);
  });

  it('sin id no pregunta nada', () => {
    const { result } = renderHook(() => usePedidoEnVivo(null));
    expect(result.current.cargando).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('OrderTracker (pantalla)', () => {
  const abrir = (id) => render(
    <MemoryRouter initialEntries={[`/order/${id}`]}>
      <Routes><Route path="/order/:id" element={<OrderTracker />} /></Routes>
    </MemoryRouter>,
  );

  it('muestra el estado, el primer nombre, los items y la ayuda por WhatsApp del negocio', async () => {
    rpc.mockResolvedValue({ data: pedido(), error: null });
    abrir(ID);
    expect(await screen.findByRole('heading', { name: 'En preparación' })).toBeTruthy();
    expect(screen.getByText(/👤 Ana/)).toBeTruthy();
    expect(screen.getByText(/Medialuna × 3/)).toBeTruthy();
    const ayuda = screen.getByText(/Necesitás ayuda/).closest('a');
    expect(ayuda.getAttribute('href')).toContain('wa.me/5491122334455');
  });

  it('un pedido que no es de este negocio es "no encontrado"', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    abrir(ID);
    expect(await screen.findByText('Pedido no encontrado')).toBeTruthy();
  });
});
