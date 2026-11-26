// Marca de seguimiento de un pedido anulado (0150): quien, cuando y por que,
// en la tarjeta cerrada y abierta, con la hora en el reloj del local.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../services/platformAdmin', async (orig) => {
  const real = await orig();
  return { ...real, fetchOrderItems: vi.fn().mockResolvedValue([]) };
});

import OrdersPanel from '../components/admin/platform/OrdersPanel';
import { fechaHoraDelLocal } from '../modules/estadoOperativo';

const anulado = {
  id: 'a1', created_at: '2026-11-26T20:00:00Z', status: 'cancelled', customer_name: 'Luis',
  customer_phone: '1155', delivery: 'retiro', payment: 'efectivo', total: 9, subtotal: 9,
  discount: 0, tip_amount: 0, delivery_cost: 0,
  cancel_reason: 'estaba mal',
  // 22:56 UTC = 18:56 en Caracas (UTC-4)
  cancelled_at: '2026-11-26T22:56:00Z',
  cancelled_by_name: 'Ricardo Rodríguez', cancelled_by_email: 'ricardo@example.com',
  cancelled_by_role: 'Dueño',
};

function panel(orders, extra = {}) {
  return render(
    <OrdersPanel
      orders={orders} loading={false} onSetStatus={vi.fn()} showToast={vi.fn()}
      roles={['owner']} onAnular={vi.fn()} timezone="America/Caracas"
      itemsIniciales={[]} {...extra}
    />,
  );
}

describe('fechaHoraDelLocal', () => {
  it('muestra la hora del local y no la de UTC', () => {
    expect(fechaHoraDelLocal('2026-11-26T22:56:00Z', 'America/Caracas')).toBe('26/11 18:56');
    expect(fechaHoraDelLocal('2026-11-26T22:56:00Z', 'America/Caracas', { conAnio: true }))
      .toBe('26/11/2026 18:56');
  });
  it('una hora UTC del dia siguiente cae en el dia anterior en Caracas', () => {
    expect(fechaHoraDelLocal('2026-11-27T02:30:00Z', 'UTC')).toBe('27/11 02:30');
    expect(fechaHoraDelLocal('2026-11-27T02:30:00Z', 'America/Caracas')).toBe('26/11 22:30');
  });
  it('acepta el formato de Postgres con espacio y devuelve vacio si no es fecha', () => {
    expect(fechaHoraDelLocal('2026-11-26 22:56:00+00', 'America/Caracas')).toBe('26/11 18:56');
    expect(fechaHoraDelLocal(null, 'America/Caracas')).toBe('');
    expect(fechaHoraDelLocal('nada', 'America/Caracas')).toBe('');
  });
  it('una zona invalida cae en UTC, nunca en la del navegador', () => {
    expect(fechaHoraDelLocal('2026-11-26T22:56:00Z', 'No/Existe')).toBe('26/11 22:56');
  });
});

describe('tarjeta anulada, cerrada', () => {
  it('una linea con quien y cuando, y el motivo abajo', () => {
    panel([anulado]);
    expect(screen.getByText('Anulado por Ricardo Rodríguez · 26/11 18:56')).toBeTruthy();
    expect(screen.getByText('Motivo: estaba mal')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Anulación' })).toBeNull();
  });
  it('un pedido viejo sin marca dice solo "Anulado" y el motivo', () => {
    panel([{ ...anulado, cancelled_at: null, cancelled_by_name: null, cancelled_by_email: null, cancelled_by_role: null, cancel_reason: 'prueba' }]);
    expect(screen.getByText('Anulado')).toBeTruthy();
    expect(screen.getByText('Motivo: prueba')).toBeTruthy();
    expect(screen.queryByText(/Anulado por/)).toBeNull();
  });
  it('sin cancelled_at no inventa una hora', () => {
    panel([{ ...anulado, cancelled_at: null }]);
    expect(screen.getByText('Anulado por Ricardo Rodríguez')).toBeTruthy();
  });
  it('una cancelacion comun, sin motivo ni marca, no muestra nada', () => {
    panel([{ ...anulado, cancel_reason: null, cancelled_by_name: null, cancelled_at: null }]);
    expect(screen.queryByText(/Anulado/)).toBeNull();
  });
});

describe('tarjeta anulada, abierta', () => {
  it('bloque Anulacion como lista de definiciones con todos los datos', () => {
    panel([anulado], { abiertoId: 'a1' });
    const bloque = screen.getByRole('group', { name: 'Anulación' });
    const dl = bloque.querySelector('dl');
    const pares = [...dl.querySelectorAll('dt')].map(dt => [dt.textContent, dt.nextElementSibling.textContent]);
    expect(pares).toEqual([
      ['Por', 'Ricardo Rodríguez'],
      ['Rol', 'Dueño'],
      ['Correo', 'ricardo@example.com'],
      ['Fecha y hora', '26/11/2026 18:56'],
      ['Motivo', 'estaba mal'],
    ]);
    // Abierta no repite la linea compacta.
    expect(screen.queryByText(/Anulado por/)).toBeNull();
  });
  it('un pedido viejo muestra solo el motivo', () => {
    panel([{ ...anulado, cancelled_at: null, cancelled_by_name: null, cancelled_by_email: null, cancelled_by_role: null }], { abiertoId: 'a1' });
    const bloque = screen.getByRole('group', { name: 'Anulación' });
    const terminos = within(bloque).getAllByRole('term').map(t => t.textContent);
    expect(terminos).toEqual(['Motivo']);
  });
  it('la hora sigue la zona del local: 02:30 UTC es 22:30 del dia anterior en Caracas', () => {
    panel([{ ...anulado, cancelled_at: '2026-11-27T02:30:00Z' }], { abiertoId: 'a1' });
    expect(screen.getByText('26/11/2026 22:30')).toBeTruthy();
  });
});
