// Montos del catalogo con doble moneda (Cochi fase 5): carrito, checkout,
// confirmacion y mensaje de WhatsApp. Lo que no puede cambiar: un tenant sin
// moneda secundaria ve lo de siempre (ya se comparo el HTML contra el codigo
// anterior: carrito, ficha, checkout pasos 1 y 2 y pedidos, byte por byte).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useTasaCatalogo', () => ({
  default: ({ secundaria }) => ({
    activa: Boolean(secundaria),
    tasa: secundaria ? { rate: 800, fecha: '2026-11-16', fuente: 'manual', vencida: globalThis.__tasaVencida === true } : null,
    cargando: false,
  }),
}));
vi.mock('../lib/activeTenant', () => ({ resolveTenantSlug: async () => 'cochi' }));

import CartScreen from '../catalog-pro/CartScreen';
import CheckoutScreen from '../catalog-pro/CheckoutScreen';
import OrderSentView from '../components/catalog/OrderSentView';
import { MonedaCatalogoProvider, Monto, MontoCongelado } from '../catalog-pro/MonedaCatalogo';
import { armarMensajePedido, urlWhatsApp } from '../lib/mensajePedido';

const items = [{ id: 'a', name: 'Bandeja', price: 9, qty: 1, product_id: 'a' }];
const cartProps = { items, subtotal: 9, minOrder: 0, form: {}, topProducts: [] };
const con = (settings, el) => <MonedaCatalogoProvider settings={settings}>{el}</MonedaCatalogoProvider>;
const COCHI = { currency: 'USD', secondary_currency: 'VES', timezone: 'America/Caracas' };

describe('Monto', () => {
  it('sin moneda secundaria: solo el texto de siempre, sin nodos de mas', () => {
    const { container } = render(<MonedaCatalogoProvider settings={{ currency: 'ARS' }}><Monto valor={1234.5} /></MonedaCatalogoProvider>);
    expect(container.innerHTML).toBe('$1.234,5');
  });
  it('USD sin secundaria: formato de la moneda, no el de pesos', () => {
    const { container } = render(<MonedaCatalogoProvider settings={{ currency: 'USD' }}><Monto valor={9} /></MonedaCatalogoProvider>);
    expect(container.textContent).toBe('$9.00');
  });
  it('con secundaria y tasa: principal y equivalente', async () => {
    globalThis.__tasaVencida = false;
    const { container } = render(con(COCHI, <Monto valor={9} />));
    expect(container.textContent).toMatch(/\$9\.00/);
    expect(container.textContent).toMatch(/Bs\. 7\.200,00/);
    expect(container.textContent).not.toMatch(/tasa anterior/);
  });
  it('tasa vencida: lo marca', () => {
    globalThis.__tasaVencida = true;
    const { container } = render(con(COCHI, <Monto valor={9} />));
    expect(container.textContent).toMatch(/tasa anterior/);
    globalThis.__tasaVencida = false;
  });
  it('MontoCongelado usa el secundario del pedido, no la tasa de hoy', () => {
    const { container } = render(<MontoCongelado valor={9} principal="USD" secundario={6300} monedaSecundaria="VES" />);
    expect(container.textContent).toMatch(/Bs\. 6\.300,00/);
  });
});

describe('carrito', () => {
  it('Cochi: subtotal en las dos monedas y la linea de la tasa', () => {
    globalThis.__tasaVencida = false;
    render(con(COCHI, <CartScreen {...cartProps} />));
    expect(screen.getAllByText(/Bs\. 7\.200,00/).length).toBeGreaterThan(0);
    expect(screen.getByRole('note').textContent).toMatch(/1 USD = Bs\. 800,00/);
  });
  it('sin secundaria: ni Bs. ni linea de tasa', () => {
    const { container } = render(con({ currency: 'ARS' }, <CartScreen {...cartProps} items={[{ ...items[0], price: 1500 }]} subtotal={1500} />));
    expect(container.textContent).toMatch(/\$1\.500/);
    expect(container.textContent).not.toMatch(/Bs\./);
    expect(container.querySelector('.cp-monto')).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('checkout con el envio a confirmar', () => {
  const form = { name: 'Ana', phone: '1155', email: '', delivery: 'envio', payment: 'efectivo', payment_account_id: null, address: 'Calle 1', change_amount: 'justo' };
  const base = {
    step: 2, onStepChange() {}, onClose() {}, form, sf() {}, navigate() {},
    settings: { biz_name: 'Cochi', payment_accounts: [{ id: 'c1', banco: 'Pago movil', moneda: 'VES', titular: 'Cochi', detalles: [{ label: 'Cedula/RIF', value: 'J-123' }, { label: 'Telefono', value: '0414-1' }] }] },
    scheduleMode: 'now', setScheduleMode() {}, storeStatus: { open: true }, addresses: [], estimateDelivery() {}, setDeliveryCost() {}, setDeliveryKm() {},
    deliveryCost: 0, deliveryKm: null, cart: items, ct: 9, ctWithDelivery: 9, discount: 0, coupon: null, couponCode: '', tipAmount: 0, tip: 0, tipCap: 100,
    receiptFile: null, setReceiptFile() {}, setReceiptPreview() {}, setTip() {}, setTipCustom() {}, setCouponCode() {}, setCoupon() {}, setCouponErr() {},
    onSubmit() {}, haversine() {}, calcDeliveryCost() {}, payments: [], paymentIcon() {}, paymentLabel() {}, getAvailableHours() {}, setGeoLoading() {},
  };
  it('muestra "a confirmar por el local" y el total como parcial', () => {
    render(con(COCHI, <CheckoutScreen {...base} envioAConfirmar />));
    expect(screen.getByText('A confirmar por el local')).toBeTruthy();
    expect(screen.getByText('Total parcial (sin envío)')).toBeTruthy();
  });
  it('sin el flag: "Total a pagar" como siempre', () => {
    render(con(COCHI, <CheckoutScreen {...base} />));
    expect(screen.getByText('Total a pagar')).toBeTruthy();
    expect(screen.queryByText('A confirmar por el local')).toBeNull();
  });
  it('cuenta en bolivares: detalles con copiar y el monto convertido con la tasa', () => {
    render(con(COCHI, <CheckoutScreen {...base} form={{ ...form, payment: 'transferencia', payment_account_id: 'c1' }} />));
    expect(screen.getByText('J-123')).toBeTruthy();
    expect(screen.getByText('Copiar todos los datos')).toBeTruthy();
    expect(screen.getByText(/Monto a transferir/).textContent).toMatch(/Bs\. 7\.200,00/);
  });
});

describe('confirmacion y mensaje de WhatsApp', () => {
  const respuesta = { ok: true, orderId: '11111111-2222-4333-8444-555555555555', total: 9, delivery_cost: 0, delivery_pending: true,
    fx: { rate: 800, currency: 'VES', total_secondary: 7200, date: '2026-11-16', status: 'ok' } };
  const form = { name: 'Ana', phone: '1155', delivery: 'envio', address: 'Calle 1', payment: 'efectivo' };

  it('con envio pendiente muestra el total parcial en las dos monedas', () => {
    render(con(COCHI, <OrderSentView orderId={respuesta.orderId} form={form} settings={{ biz_name: 'Cochi' }} respuesta={respuesta} items={[]} onReset={() => {}} />));
    const resumen = screen.getByTestId('order-summary');
    expect(resumen.textContent).toMatch(/Total parcial/);
    expect(resumen.textContent).toMatch(/Bs\. 7\.200,00/);
    expect(resumen.textContent).toMatch(/Cochi te escribe con el costo/);
  });
  it('un tenant sin doble moneda ni envio pendiente no ve el bloque ni el boton', () => {
    render(con({ currency: 'ARS' }, <OrderSentView orderId={respuesta.orderId} form={form} settings={{}} respuesta={{ ok: true, total: 1500 }} items={[]} onReset={() => {}} />));
    expect(screen.queryByTestId('order-summary')).toBeNull();
    expect(screen.queryByText(/Enviar el pedido por WhatsApp/)).toBeNull();
  });
  it('el boton de WhatsApp aparece solo con el flag y el numero', () => {
    const settings = { biz_name: 'Cochi', pedido_por_whatsapp: true, whatsapp: '584242246392' };
    render(con(COCHI, <OrderSentView orderId={respuesta.orderId} form={form} settings={settings} respuesta={respuesta} items={[{ name: 'Bandeja', qty: 1 }]} onReset={() => {}} />));
    const a = screen.getByText('Enviar el pedido por WhatsApp');
    expect(a.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/584242246392\?text=/);
  });

  it('armarMensajePedido usa los montos del servidor y avisa el envio pendiente', () => {
    const texto = armarMensajePedido({
      negocio: 'Cochi', codigo: '#ABC123', cliente: { nombre: 'Ana', telefono: '1155' }, modo: 'envio', direccion: 'Calle 1',
      items: [{ name: 'Bandeja · Alitas', qty: 2, note: 'sin sal' }], respuesta: { ...respuesta, total: 18, discount: 1.8, fx: { ...respuesta.fx, total_secondary: 14400 } }, principal: 'USD',
    });
    expect(texto).toContain('*PEDIDO COCHI Nº #ABC123*');
    expect(texto).toContain('1. 2 x Bandeja · Alitas');
    expect(texto).toContain('   Nota: sin sal');
    expect(texto).toContain('Descuento: -$1.80');
    expect(texto).toContain('Envío: a confirmar por el local');
    expect(texto).toContain('*Total parcial (sin envío): $18.00*');
    expect(texto).toContain('Parcial en VES: Bs. 14.400,00 (tasa Bs. 800,00)');
  });
  it('sin tasa lo dice, y el retiro no habla de envio', () => {
    const texto = armarMensajePedido({
      negocio: 'Cochi', codigo: '#X', cliente: { nombre: 'Ana' }, modo: 'retiro', items: [{ name: 'Pan', qty: 1 }],
      respuesta: { total: 9, fx: null }, principal: 'USD',
    });
    expect(texto).not.toContain('Envío');
    expect(texto).toContain('*Total: $9.00*');
    expect(texto).toContain('te lo confirma el local');
  });
  it('urlWhatsApp rechaza un numero que no sirve', () => {
    expect(urlWhatsApp('', 'hola')).toBeNull();
    expect(urlWhatsApp('+58 424-224-6392', 'hola amigo')).toBe('https://wa.me/584242246392?text=hola%20amigo');
  });
});
