// Pedidos -> Cocina. "Preparar" tiene que bajar el pedido a cocina (sellar
// kitchen_at) y "Listo" cerrar su ticket; antes eran un update pelado de
// status y el KDS nunca recibia nada.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const update = vi.fn(() => ({ eq }));
  return { supabase: { rpc: vi.fn(), from: vi.fn(() => ({ update })), __update: update, __eq: eq } };
});

import { supabase } from '../lib/supabase';
import { avanzarPedido, fetchTicketsDeCocina } from '../services/platformKds';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('avanzarPedido', () => {
  it('preparing baja el pedido a cocina por la RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: { ok: true }, error: null });
    const r = await avanzarPedido('t1', { id: 'o1' }, 'preparing');
    expect(r).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('bajar_pedido_a_cocina', { p_tenant_id: 't1', p_order_id: 'o1' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('active con kitchen_at cierra el ticket, sin p_sector_id', async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });
    const r = await avanzarPedido('t1', { id: 'o1', kitchen_at: '2026-11-28T20:00:00Z' }, 'active');
    expect(r).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('cerrar_ticket_de_cocina', { p_tenant_id: 't1', p_order_id: 'o1' });
  });

  it('active sin kitchen_at (pedido viejo) sigue siendo el update de siempre', async () => {
    const r = await avanzarPedido('t1', { id: 'o1', kitchen_at: null }, 'active');
    expect(r).toBe(true);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.__update).toHaveBeenCalledWith({ status: 'active' });
    expect(supabase.__eq).toHaveBeenCalledWith('id', 'o1');
  });

  it('cualquier otro estado tambien es update', async () => {
    await avanzarPedido('t1', { id: 'o1' }, 'cancelled');
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.__update).toHaveBeenCalledWith({ status: 'cancelled' });
  });

  it('el error de la RPC vuelve como __error con el mensaje traducido', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'pedido_cancelado' } });
    const r = await avanzarPedido('t1', { id: 'o1' }, 'preparing');
    expect(r.__error).toBe('db');
    expect(r.message).toBe('El pedido está cancelado.');
  });
});

describe('fetchTicketsDeCocina', () => {
  it('no trae los pedidos cancelados', async () => {
    const q = {};
    for (const m of ['select', 'eq', 'not', 'is', 'neq']) q[m] = vi.fn(() => q);
    q.order = vi.fn(() => Promise.resolve({ data: [], error: null }));
    supabase.from.mockReturnValueOnce(q);
    await fetchTicketsDeCocina('t1');
    expect(q.neq).toHaveBeenCalledWith('status', 'cancelled');
  });
});
