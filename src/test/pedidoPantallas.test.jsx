// Prueba de pedido de punta a punta (cochi, USD + VES): lo que encontro y se
// arreglo en las pantallas.
//   - con sesion iniciada y perfil incompleto, el checkout pide lo que falta;
//   - el panel de Pedidos muestra el precio de cada item con decimales;
//   - la confirmacion no dice "preparando" cuando el pedido esta en "Nuevo".
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';

vi.mock('../hooks/useTasaCatalogo', () => ({ default: () => ({ activa: false, tasa: null, cargando: false }) }));
vi.mock('../lib/activeTenant', () => ({ resolveTenantSlug: async () => 'cochi' }));
vi.mock('../services/platformAdmin', async (orig) => {
  const real = await orig();
  return {
    ...real,
    fetchOrderItems: vi.fn().mockResolvedValue([
      { id: 'i1', qty: 1, name_snapshot: 'Papas', unit_price: 1.5, subtotal: 1.5 },
    ]),
  };
});

import CheckoutScreen from '../catalog-pro/CheckoutScreen';
import OrderSentView from '../components/catalog/OrderSentView';
import OrdersPanel from '../components/admin/platform/OrdersPanel';
import { faltantesDelPerfil, datosParaGuardarEnPerfil } from '../lib/perfilCheckout';

const FORM_VACIO = { name: '', phone: '', email: '', delivery: 'retiro', payment: 'efectivo', payment_account_id: null, address: '', change_amount: '' };
const USER = { id: 'u1', email: 'ana@correo.com' };

// El form vive en el estado, como en Catalog: tipear tiene que habilitar "Siguiente".
function Checkout({ profile, inicial = FORM_VACIO, perfilListo = true }) {
  const [form, setForm] = useState(inicial);
  const sf = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <CheckoutScreen
      step={0} onStepChange={() => {}} onClose={() => {}} user={USER} profile={profile} perfilListo={perfilListo} form={form} sf={sf} navigate={() => {}}
      settings={{}} scheduleMode="now" setScheduleMode={() => {}} storeStatus={{ open: true }} addresses={[]}
      cart={[]} ct={10} ctWithDelivery={10} discount={0} coupon={null} couponCode="" tipAmount={0}
      setCouponCode={() => {}} setCoupon={() => {}} setCouponErr={() => {}} onSubmit={() => {}}
      payments={[]} paymentIcon={() => {}} paymentLabel={() => {}} getAvailableHours={() => []}
    />
  );
}
const siguiente = () => screen.getByRole('button', { name: /Siguiente|Continuar/ });

describe('Checkout con sesion: pide solo lo que le falta al perfil', () => {
  it('perfil vacio: aparecen nombre y telefono, y Siguiente se habilita al completarlos', () => {
    render(<Checkout profile={null} />);
    expect(screen.getByText('Completá tus datos')).toBeTruthy();
    expect(screen.getByText(/Los guardamos en tu cuenta/)).toBeTruthy();
    expect(siguiente().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Nombre y Apellido'), { target: { value: 'Ana Perez' } });
    // el campo no desaparece mientras se tipea
    expect(screen.getByLabelText('Nombre y Apellido').value).toBe('Ana Perez');
    expect(siguiente().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Teléfono/), { target: { value: '04141234567' } });
    expect(siguiente().disabled).toBe(false);
  });

  it('perfil sin cargar (null y no listo): no se pinta ningun input; listo y sin fila: los dos', () => {
    const { unmount } = render(<Checkout profile={null} perfilListo={false} />);
    expect(screen.queryByText('Completá tus datos')).toBeNull();
    expect(screen.queryByLabelText('Nombre y Apellido')).toBeNull();
    unmount();
    render(<Checkout profile={null} perfilListo />);
    expect(screen.getByLabelText('Nombre y Apellido').getAttribute('autocomplete')).toBe('name');
    expect(screen.getByLabelText(/^Teléfono/).getAttribute('inputmode')).toBe('tel');
    expect(screen.getByRole('group', { name: 'Completá tus datos' })).toBeTruthy();
  });

  it('perfil completo: no hay inputs (como hoy)', () => {
    render(<Checkout profile={{ name: 'Ana Perez', phone: '1155443322' }} inicial={{ ...FORM_VACIO, name: 'Ana Perez', phone: '1155443322' }} />);
    expect(screen.queryByText('Completá tus datos')).toBeNull();
    expect(screen.queryByLabelText(/^Teléfono/)).toBeNull();
    expect(siguiente().disabled).toBe(false);
  });

  it('falta solo el telefono: solo ese input', () => {
    render(<Checkout profile={{ name: 'Ana Perez', phone: '' }} inicial={{ ...FORM_VACIO, name: 'Ana Perez' }} />);
    expect(screen.queryByLabelText('Nombre y Apellido')).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Teléfono/), { target: { value: '12' } });
    expect(screen.getByText(/Mínimo 10 dígitos/)).toBeTruthy();
    expect(siguiente().disabled).toBe(true);
  });
});

describe('perfilCheckout', () => {
  it('detecta lo que falta', () => {
    expect(faltantesDelPerfil(null)).toEqual({ name: true, phone: true });
    expect(faltantesDelPerfil({ name: ' A ', phone: '123' })).toEqual({ name: true, phone: true });
    expect(faltantesDelPerfil({ name: 'Ana', phone: '11 5544-3322' })).toEqual({ name: false, phone: false });
  });
  it('guarda tras el pedido solo lo que faltaba; sin faltantes no hay nada que guardar', () => {
    const form = { name: ' Ana Perez ', phone: '1155443322' };
    expect(datosParaGuardarEnPerfil(null, form)).toEqual({ name: 'Ana Perez', phone: '1155443322' });
    expect(datosParaGuardarEnPerfil({ name: 'Ana', phone: '' }, form)).toEqual({ phone: '1155443322' });
    expect(datosParaGuardarEnPerfil({ name: 'Ana Perez', phone: '1155443322' }, form)).toEqual({});
  });
});

describe('Panel de Pedidos: precio por item', () => {
  it('en USD el item muestra decimales, igual que el total', async () => {
    const pedido = {
      id: 'o1', created_at: '2026-11-16T15:00:00Z', status: 'new', customer_name: 'Ana', customer_phone: '1155',
      delivery: 'retiro', payment: 'efectivo', total: 9.5, subtotal: 9.5, discount: 0, tip_amount: 0, delivery_cost: 0,
    };
    render(<OrdersPanel orders={[pedido]} loading={false} onSetStatus={vi.fn()} showToast={vi.fn()} moneda={{ monedaPrincipal: 'USD', monedaSecundaria: 'VES' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }));
    expect(await screen.findByText('$1.50')).toBeTruthy();
  });
});

describe('Confirmacion: no promete que ya se esta preparando', () => {
  const props = { orderId: 'o1', form: { name: 'Ana', phone: '1155', delivery: 'retiro', payment: 'efectivo' }, settings: {}, respuesta: { ok: true, total: 9 }, items: [{ name: 'Pan', qty: 1 }], onReset: () => {} };
  it('sin pago confirmado: recibimos el pedido', () => {
    render(<OrderSentView {...props} />);
    expect(screen.getByText('Recibimos tu pedido. Te avisamos cuando el local lo empiece a preparar.')).toBeTruthy();
    expect(screen.queryByText(/preparando todo/)).toBeNull();
  });
  it('con pago confirmado: el pedido esta en la fila del local', () => {
    render(<OrderSentView {...props} paymentConfirmed />);
    expect(screen.getByText('¡Recibimos tu pago! Tu pedido ya está en la fila del local.')).toBeTruthy();
  });
});
