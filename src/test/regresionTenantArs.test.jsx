// Regresion permanente: un tenant en pesos SIN moneda secundaria ve exactamente
// lo que veia antes de la fase 5 (doble moneda, envio a confirmar, WhatsApp).
//
// Los snapshots se grabaron con los componentes de ANTES (commit 0ef3db4) y
// afirman que el HTML de hoy es byte por byte el mismo, con y sin provider de
// moneda. Si un cambio los rompe, es un cambio de lo que ven TODOS los tenants:
// revisar el diff del snapshot antes de actualizarlo con -u.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../hooks/useTasaCatalogo', () => ({ default: () => ({ activa: false, tasa: null, cargando: false }) }));
vi.mock('../lib/activeTenant', () => ({ resolveTenantSlug: async () => 'tenant-ars' }));

import CartScreen from '../catalog-pro/CartScreen';
import CheckoutScreen from '../catalog-pro/CheckoutScreen';
import ProductDetailScreen from '../catalog-pro/ProductDetailScreen';
import OrdersScreen from '../catalog-pro/OrdersScreen';
import OrderSentView from '../components/catalog/OrderSentView';
import { MonedaCatalogoProvider } from '../catalog-pro/MonedaCatalogo';

const items = [
  { id: 'a', name: 'Pan de campo', price: 1500, qty: 2, product_id: 'a' },
  { id: 'b', name: 'Torta de ricota', price: 4200.5, qty: 1, product_id: 'b' },
];
const bandeja = {
  id: 'p1', name: 'Bandeja', category: 'B', sale_price: 1700, description: 'x',
  option_groups: [{ id: 'g', name: 'Extras', type: 'multiple', max: 2, choices: [{ id: 'q', label: 'Queso', price: 150 }] }],
};
const form = { name: 'Ana', phone: '1155', email: 'a@a.com', delivery: 'envio', payment: 'efectivo', payment_account_id: null, address: 'Calle 1', change_amount: 'justo' };
const ckProps = (step) => ({
  step, onStepChange() {}, onClose() {}, form, sf() {}, navigate() {},
  settings: { payment_accounts: [{ id: 'c1', banco: 'Banco', alias: 'a.b', titular: 'T' }], free_delivery_over: 5000 },
  scheduleMode: 'now', setScheduleMode() {}, storeStatus: { open: true }, addresses: [], estimateDelivery() {}, setDeliveryCost() {}, setDeliveryKm() {},
  deliveryCost: 700, deliveryKm: 3, cart: items, ct: 7200.5, ctWithDelivery: 7900.5, discount: 100, coupon: { discount_pct: 5 }, couponCode: 'X', tipAmount: 300, tip: 5, tipCap: 5000,
  receiptFile: null, setReceiptFile() {}, setReceiptPreview() {}, setTip() {}, setTipCustom() {}, setCouponCode() {}, setCoupon() {}, setCouponErr() {}, onSubmit() {},
  haversine() {}, calcDeliveryCost() {}, payments: [], paymentIcon() {}, paymentLabel() {}, getAvailableHours() {}, setGeoLoading() {},
});

const html = (el) => { const { container, unmount } = render(el); const h = container.innerHTML; unmount(); return h; };
const envolver = (variante, el) => (variante === 'sin-provider' ? el
  : <MonedaCatalogoProvider settings={variante === 'ars' ? { currency: 'ARS' } : { currency: 'ARS', secondary_currency: null }}>{el}</MonedaCatalogoProvider>);

const LO_NUEVO = [/Bs\./, /cp-monto/, /cp-aviso-tasa/, /A confirmar por el local/, /Total parcial/, /WhatsApp/i, /1 USD/];

describe.each(['sin-provider', 'ars', 'ars-secundaria-null'])('tenant en pesos sin secundaria (%s)', (variante) => {
  it('Carrito', () => {
    const h = html(envolver(variante, <CartScreen items={items} subtotal={5200.5} minOrder={6000} topProducts={[{ id: 'z', name: 'Z', sale_price: 900 }]} form={{}} />));
    expect(h).toMatch(/\$1\.500|\$3\.000/);
    expect(h).toMatchSnapshot();
  });
  it('Ficha con opciones', () => {
    const h = html(envolver(variante, <ProductDetailScreen product={bandeja} soldOutIds={new Set()} hasDeal={() => false}
      dealPrice={(x) => Number(x.sale_price)} allProducts={[bandeja]} timezone="America/Buenos_Aires" onAddToCart={() => {}} />));
    expect(h).toMatchSnapshot();
  });
  it.each([1, 2])('Checkout paso %i', (paso) => {
    const h = html(envolver(variante, <CheckoutScreen {...ckProps(paso)} />));
    expect(h).toMatchSnapshot();
  });
  it('Pedidos', () => {
    const { container, unmount } = render(envolver(variante, <OrdersScreen loadOrders={async () => []} onBack={() => {}} onTrack={() => {}} />));
    const h = container.innerHTML; unmount();
    expect(h).toMatchSnapshot();
  });
  it('Confirmacion: sin bloque de total, sin envio pendiente, sin boton de WhatsApp', () => {
    const h = html(envolver(variante, <OrderSentView orderId="11111111-2222-4333-8444-555555555555" form={form} settings={{ biz_name: 'Panaderia' }}
      respuesta={{ ok: true, total: 7900 }} items={[{ name: 'Pan', qty: 1 }]} onReset={() => {}} />));
    expect(h).not.toMatch(/order-summary|cp-wsp-pedido|Enviar el pedido por WhatsApp|Total parcial/);
  });
  it('ningun texto de la fase 5 aparece en carrito, ficha ni checkout', () => {
    const todo = [
      html(envolver(variante, <CartScreen items={items} subtotal={5200.5} form={{}} />)),
      html(envolver(variante, <CheckoutScreen {...ckProps(2)} />)),
      html(envolver(variante, <ProductDetailScreen product={bandeja} soldOutIds={new Set()} hasDeal={() => false} dealPrice={(x) => Number(x.sale_price)} allProducts={[bandeja]} onAddToCart={() => {}} />)),
    ].join('\n');
    for (const re of LO_NUEVO) expect(todo, String(re)).not.toMatch(re);
  });
});
