// submit-order con el payload de siempre y un tenant sin moneda secundaria:
// el mismo insert y la misma respuesta que antes de la fase 5. Los valores
// esperados se verificaron corriendo esta misma prueba contra index.ts de
// ANTES (commit 0ef3db4).
import { describe, it, expect, beforeEach } from 'vitest';
import { cargarHandler, crearEstado } from './helpers/submitOrderHarness.js';

const UUID = '00000000-0000-4000-8000-000000000001';
let estado, handler;

beforeEach(async () => {
  estado = crearEstado();
  estado.tablas.tenants = { id: 't1', settings: { delivery_pricing: [{ max_km: null, cost: 1500 }], payment_accounts: [{ id: 'c1', label: 'Galicia', banco: 'Galicia', titular: 'Pan SA', alias: 'pan.sa', cbu: '123', active: true }] }, timezone: 'America/Argentina/Buenos_Aires' };
  estado.tablas.products = [{ id: UUID, name: 'Pan de campo', price: 1000, category: 'Panes', active: true, option_groups: [] }];
  estado.tablas.product_ingredients = [];
  estado.tablas.coupons = { id: '00000000-0000-4000-8000-0000000000c1', discount_pct: 10, expires_at: null, email: null };
  handler = await cargarHandler(estado);
});

const pedir = (extra = {}) => handler(new Request('http://x', {
  method: 'POST',
  body: JSON.stringify({
    tenant_slug: 'panaderia', customer: 'Ana', phone: '+54 9 11 5555-0000', email: 'ANA@x.com', delivery: 'envio', payment: 'transferencia',
    payment_account_id: 'c1', note: 'timbre roto', address: 'Calle 1', delivery_cost: 1200, tip_pct: 10, coupon_code: 'amigos',
    items: [{ recipeId: UUID, qty: 2, unitPrice: 1 }], ...extra,
  }),
}));

describe('submit-order: payload de siempre, tenant sin secundaria', () => {
  it('la respuesta es la de siempre, sin claves nuevas', async () => {
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      ok: true, orderId: 'ord-1', total: 3200, discount: 200, tip: 200, delivery_cost: 1200,
      review_status: 'not_required', risk_flags: [],
    });
  });

  it('el insert de orders y de order_items es exactamente el de siempre', async () => {
    await pedir();
    const orden = estado.inserts.find((i) => i.tabla === 'orders').filas;
    expect(orden).toEqual({
      tenant_id: 't1', status: 'new', channel: 'catalog', customer_name: 'Ana', customer_phone: '5491155550000', customer_email: 'ana@x.com',
      delivery: 'envio', delivery_address: 'Calle 1', delivery_cost: 1200, delivery_date: null,
      payment: 'transferencia', payment_account_id: 'c1',
      payment_account_snapshot: { id: 'c1', label: 'Galicia', banco: 'Galicia', titular: 'Pan SA', alias: 'pan.sa', cbu: '123' },
      note: 'timbre roto', is_gift: false, gift_note: '', subtotal: 2000, discount: 200, tip_pct: 10, tip_amount: 200, total: 3200,
      coupon_id: '00000000-0000-4000-8000-0000000000c1', user_id: null, client_request_id: null,
      visit_id: null, resource_id: null, staff_id: null, review_status: 'not_required', risk_flags: [],
    });
    const items = estado.inserts.find((i) => i.tabla === 'order_items').filas;
    expect(items).toEqual([{
      tenant_id: 't1', order_id: 'ord-1', product_id: UUID, name_snapshot: 'Pan de campo', qty: 2,
      unit_price: 1000, unit_cost: 0, subtotal: 2000,
    }]);
  });

  it('retiro en efectivo sin cupon ni propina: total = subtotal', async () => {
    const r = await (await pedir({ delivery: 'retiro', payment: 'efectivo', payment_account_id: null, coupon_code: null, tip_pct: 0, delivery_cost: 99 })).json();
    expect(r).toMatchObject({ ok: true, total: 2000, discount: 0, tip: 0, delivery_cost: 0 });
  });
});
